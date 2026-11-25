/**
 * Server-side session check for Next.js route handlers and server components.
 *
 * Why this exists next to /api/config: the browser only calls /api/config to
 * decide what to render. Every API route that reads or changes data has to
 * decide on its own whether the caller is logged in, and app by app that
 * decision had drifted into "is there a ps-token cookie" (Edge middleware,
 * which cannot decrypt it), "does the cookie decrypt" (trusting whatever JWT
 * is inside) or nothing at all. This is the one check to call instead:
 *
 *   1. decrypt the chunked ps-token cookie (AES-GCM, AUTH_COOKIE_SECRET)
 *   2. verify the access token signature against the realm JWKS (verify.ts),
 *      so a leaked cookie secret alone cannot mint a session
 *   3. expired token: refresh it at Keycloak with the refresh token in the
 *      cookie, which also proves the Keycloak session is still alive
 *   4. enforce the app's role gate (AUTH_REQUIRED_ROLES, SuperAdmin bypass),
 *      the same rule /api/config applies
 *
 * Usage:
 * ```ts
 * const s = await requireSession(req, authConfig);
 * if (s instanceof Response) return s;
 * // s.user.id, s.user.roles, s.accessToken (verified, unexpired)
 * ```
 *
 * The refreshed token is used for this request only; the cookie is rotated by
 * /api/config as before. Keycloak's revokeRefreshToken is off in our realms,
 * so reusing the cookie's refresh token here does not invalidate it.
 */

import { createHash } from "crypto";

import { getChunkedCookieFromRequest } from "./cookie";
import { decrypt } from "./crypto";
import { decodeJwt, extractUser, isExpired } from "./jwt";
import { refreshToken } from "./keycloak";
import { checkRequiredRolesAgainstUser, mockUser } from "./roles";
import type { AuthConfig, AuthUser, JwtPayload } from "./types";
import { isJwtVerificationEnabled, TokenVerificationError, verifyAccessToken } from "./verify";

const TOKEN_COOKIE = "ps-token";

export interface VerifiedSession {
  user: AuthUser;
  /** Access token whose signature (when enabled) and expiry were checked. */
  accessToken: string;
  claims: JwtPayload;
  /** True when the cookie's token had expired and was refreshed for this call. */
  refreshed: boolean;
}

export interface RequireSessionOptions {
  /** Enforce config.requiredRoles (OR, SuperAdmin bypass). Default true. */
  enforceRequiredRoles?: boolean;
}

// A token refreshed for one request is reused until it expires, so a page
// that fires several API calls after the 5-minute access token lapses does
// not send each of them to Keycloak. Keyed by a hash of the refresh token.
const REFRESH_CACHE_MAX = 500;
const refreshCache = new Map<string, { accessToken: string; claims: JwtPayload }>();

/** Forget cached refreshed tokens. Tests use it; nothing else needs to. */
export function resetSessionCache(): void {
  refreshCache.clear();
}

function denial(status: number, error: string, message: string): Response {
  return Response.json({ error, message }, { status });
}

const unauthenticated = () =>
  denial(401, "unauthenticated", "ต้องลงชื่อเข้าใช้ก่อนเรียกใช้บริการนี้");
const invalidSession = () =>
  denial(401, "invalid_session", "เซสชันไม่ถูกต้อง กรุณาลงชื่อเข้าใช้ใหม่");
const sessionExpired = () =>
  denial(401, "session_expired", "เซสชันหมดอายุ กรุณาลงชื่อเข้าใช้ใหม่");
const authUnavailable = () =>
  denial(503, "auth_unavailable", "ไม่สามารถตรวจสอบสิทธิ์ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง");

async function readClaims(token: string, config: AuthConfig): Promise<JwtPayload> {
  if (!isJwtVerificationEnabled(config)) return decodeJwt(token);
  return verifyAccessToken(token, config);
}

function hashKey(refreshTok: string): string {
  return createHash("sha256").update(refreshTok).digest("hex");
}

async function refreshForRequest(
  config: AuthConfig,
  refreshTok: string,
): Promise<{ accessToken: string; claims: JwtPayload }> {
  const key = hashKey(refreshTok);
  const hit = refreshCache.get(key);
  if (hit && !isExpired(hit.claims.exp)) return hit;
  if (hit) refreshCache.delete(key);

  const refreshed = await refreshToken(config, refreshTok);
  const claims = await readClaims(refreshed.access_token, config);
  const entry = { accessToken: refreshed.access_token, claims };
  if (refreshCache.size >= REFRESH_CACHE_MAX) {
    const oldest = refreshCache.keys().next().value;
    if (oldest !== undefined) refreshCache.delete(oldest);
  }
  refreshCache.set(key, entry);
  return entry;
}

/**
 * Resolve the caller's session from the request cookies.
 * Returns the verified session, or a ready-to-return 401/403/503 Response.
 */
export async function requireSession(
  req: Request,
  config: AuthConfig,
  opts: RequireSessionOptions = {},
): Promise<VerifiedSession | Response> {
  const enforceRoles = opts.enforceRequiredRoles ?? true;

  // AUTH_MOCK=true: development without Keycloak. The mock cookie carries a
  // non-JWT token, so there is nothing to verify.
  if (config.mockMode) {
    const user = mockUser(config);
    if (enforceRoles) {
      const denied = checkRequiredRolesAgainstUser(config, user.roles);
      if (denied) return denied;
    }
    return {
      user,
      accessToken: "mock-access-token",
      claims: { sub: user.id, exp: Number.MAX_SAFE_INTEGER, iat: 0, realm_access: { roles: user.roles } },
      refreshed: false,
    };
  }

  const cookie = getChunkedCookieFromRequest(req, TOKEN_COOKIE);
  if (!cookie) return unauthenticated();

  let tokens: { access_token?: unknown; refresh_token?: unknown };
  try {
    tokens = JSON.parse(decrypt(cookie, config.cookieSecret)) as typeof tokens;
  } catch {
    // Not sealed with this host's cookie secret: forged, or from before a
    // secret rotation. Either way there is no session.
    return invalidSession();
  }
  const accessToken = typeof tokens.access_token === "string" ? tokens.access_token : "";
  const refreshTok = typeof tokens.refresh_token === "string" ? tokens.refresh_token : "";
  if (!accessToken) return invalidSession();

  let current = accessToken;
  let claims: JwtPayload | null = null;
  let refreshed = false;

  try {
    claims = await readClaims(accessToken, config);
  } catch (err) {
    if (err instanceof TokenVerificationError && err.kind === "unavailable") {
      console.error(`[auth-bff] session check: ${err.message}`);
      return authUnavailable();
    }
    if (err instanceof TokenVerificationError) {
      // Do not trust the token. A genuine session still owns a refresh token
      // that Keycloak will honour (this also covers a realm key rotation);
      // a forged one does not, and the refresh below fails.
      console.warn(`[auth-bff] session check: access token rejected (${err.message})`);
    }
    claims = null;
  }

  if (!claims || isExpired(claims.exp)) {
    if (!refreshTok) return claims ? sessionExpired() : invalidSession();
    try {
      const fresh = await refreshForRequest(config, refreshTok);
      current = fresh.accessToken;
      claims = fresh.claims;
      refreshed = true;
    } catch (err) {
      if (err instanceof TokenVerificationError) {
        if (err.kind === "unavailable") {
          console.error(`[auth-bff] session check: ${err.message}`);
          return authUnavailable();
        }
        // Keycloak answered with a token this host does not accept (unknown
        // kid inside the JWKS refetch window, another realm or client). That
        // is a bad session, not an outage: 401, and nothing was cached. The
        // log line shares the "access token rejected" wording of the first
        // check so one grep finds both.
        console.warn(`[auth-bff] session check: refreshed access token rejected (${err.message})`);
        return invalidSession();
      }
      // keycloak.refreshToken throws "Keycloak token refresh failed: <status>"
      // when Keycloak answered and refused. Anything else (network error) says
      // nothing about the session, so it must not log the user out.
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.startsWith("Keycloak token refresh failed")) {
        console.error(`[auth-bff] session check: refresh could not reach Keycloak: ${msg}`);
        return authUnavailable();
      }
      return claims ? sessionExpired() : invalidSession();
    }
  }

  const roles = claims.realm_access?.roles ?? [];
  if (enforceRoles) {
    const denied = checkRequiredRolesAgainstUser(config, roles, claims.sub);
    if (denied) return denied;
  }

  const user = extractUser(claims);
  if (!user.id && claims.preferred_username) user.id = claims.preferred_username;
  return { user, accessToken: current, claims, refreshed };
}

/** True when `roles` includes any of `wanted`, or SuperAdmin. */
export function hasAnyRole(roles: string[], wanted: readonly string[]): boolean {
  if (roles.includes("SuperAdmin")) return true;
  return wanted.some((r) => roles.includes(r));
}
