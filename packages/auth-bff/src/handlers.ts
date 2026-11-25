/**
 * Next.js API Route handler factories for Keycloak OIDC.
 *
 * Why factory pattern: Portal and Chat share identical auth logic but differ
 * only in config (redirect URI, post-login path). Factories let each app
 * create its handlers in 1 line: `export const GET = createLoginHandler(config)`.
 *
 * Security checklist:
 * - CSRF: state parameter stored in HttpOnly cookie, validated on callback
 * - XSS: tokens never reach the browser (HttpOnly cookie)
 * - Open redirect: post-login redirects are hardcoded, not from query params
 */

import { randomUUID } from "crypto";

import {
  buildChunkedClearCookies,
  buildChunkedSetCookies,
  buildClearCookie,
  buildSetCookie,
  getChunkedCookieFromRequest,
  getCookieFromRequest,
} from "./cookie";
import { decrypt, encrypt } from "./crypto";
import { decodeJwt, extractUser, isExpired } from "./jwt";
import { buildAuthorizationUrl, buildLogoutUrl, exchangeCode, refreshToken, revokeToken } from "./keycloak";
import { checkRequiredRolesAgainstUser, mockUser } from "./roles";
import type { AuthConfig, ConfigResponse, JwtPayload } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_COOKIE = "ps-token";
const STATE_COOKIE = "ps-state";
/** How long the CSRF state cookie lives (5 minutes) */
const STATE_MAX_AGE = 300;

// ---------------------------------------------------------------------------
// Handler Factories
// ---------------------------------------------------------------------------

/**
 * GET /api/auth/login
 *
 * Generates a CSRF state, stores it in a short-lived cookie, and redirects
 * the browser to Keycloak's authorization endpoint.
 *
 * Mock mode: redirects directly to the post-login path with a mock cookie.
 */
export function createLoginHandler(
  config: AuthConfig,
  postLoginPath = "/",
) {
  return async function GET(): Promise<Response> {
    // Mock mode - skip Keycloak entirely
    if (config.mockMode) {
      const mockPayload = JSON.stringify({
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
        expires_in: 300,
        refresh_expires_in: 259200,
        token_type: "Bearer",
      });
      const encrypted = encrypt(mockPayload, config.cookieSecret);
      const headers = new Headers();
      headers.set("Location", postLoginPath);
      for (const sc of buildChunkedSetCookies(TOKEN_COOKIE, encrypted, {
        maxAge: 259200,
      })) {
        headers.append("Set-Cookie", sc);
      }
      return new Response(null, { status: 302, headers });
    }

    const state = randomUUID();
    const url = buildAuthorizationUrl(config, state);

    const headers = new Headers();
    headers.set("Location", url);
    headers.append(
      "Set-Cookie",
      buildSetCookie(STATE_COOKIE, state, { maxAge: STATE_MAX_AGE }),
    );

    return new Response(null, { status: 302, headers });
  };
}

/**
 * GET /api/auth/callback?code=xxx&state=yyy
 *
 * Validates CSRF state, exchanges the authorization code for tokens at
 * Keycloak, encrypts tokens into a HttpOnly cookie, and redirects to
 * the post-login page.
 */
export function createCallbackHandler(
  config: AuthConfig,
  postLoginPath = "/",
) {
  return async function GET(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Why relative Location: behind a reverse proxy (Caddy), Next.js
    // standalone sees req.url with HOSTNAME=0.0.0.0 - building redirects
    // off url.origin sends the browser to http://0.0.0.0:3006 which is
    // unreachable. Relative paths are resolved by the browser against
    // the actual address bar, which is the public domain.
    const redirect = (path: string) =>
      new Response(null, { status: 302, headers: { Location: path } });

    // Keycloak returned an error (e.g. user cancelled login)
    if (error) {
      const desc = url.searchParams.get("error_description") ?? error;
      return redirect(`/login?error=${encodeURIComponent(desc)}`);
    }

    // Validate CSRF state
    const stateCookie = getCookieFromRequest(req, STATE_COOKIE);
    if (!state || !stateCookie || state !== stateCookie) {
      return redirect("/login?error=invalid_state");
    }

    if (!code) {
      return redirect("/login?error=missing_code");
    }

    try {
      const tokens = await exchangeCode(config, code);

      // Store only essential fields - Keycloak id_token is huge and
      // would push the encrypted cookie past the browser 4KB limit.
      const minimal = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        refresh_expires_in: tokens.refresh_expires_in,
      };
      const tokenJson = JSON.stringify(minimal);
      const encrypted = encrypt(tokenJson, config.cookieSecret);

      console.log(`[auth-bff] Token exchange OK. Full: ${JSON.stringify(tokens).length}B, minimal: ${tokenJson.length}B, encrypted: ${encrypted.length}B`);

      const setCookieValues = buildChunkedSetCookies(TOKEN_COOKIE, encrypted, {
        maxAge: tokens.refresh_expires_in,
      });
      console.log(
        `[auth-bff] Set-Cookie chunks: ${setCookieValues.length}, total size: ${setCookieValues.reduce((s, v) => s + v.length, 0)}`,
      );

      const headers = new Headers();
      headers.set("Location", postLoginPath);
      // Set token cookie (chunked across `ps-token.0`, `.1`, ... if > 4KB)
      for (const sc of setCookieValues) {
        headers.append("Set-Cookie", sc);
      }
      // Clear state cookie
      headers.append("Set-Cookie", buildClearCookie(STATE_COOKIE));

      return new Response(null, { status: 302, headers });
    } catch (err) {
      console.error("[auth-bff] Code exchange failed:", err);
      return redirect("/login?error=exchange_failed");
    }
  };
}

/**
 * GET /api/config
 *
 * Validates the session cookie, auto-refreshes the access token if expired,
 * and returns user info + access_token for frontend API calls.
 *
 * This is the single auth check endpoint - identical to promptserv-chat's
 * Go BFF `/api/config` pattern.
 */
/** Options for channel-based permission check at config time */
export interface ConfigHandlerOptions {
  /** Channel UUID - when set, verifies user has access to this channel via portal-service */
  channelId?: string;
  /** Portal-service base URL (e.g. http://localhost:8080) - required when channelId is set */
  portalApiUrl?: string;
}

export function createConfigHandler(config: AuthConfig, options?: ConfigHandlerOptions) {
  return async function GET(req: Request): Promise<Response> {
    // Mock mode - return fake user
    if (config.mockMode) {
      const user = mockUser(config);
      const mockDenied = checkRequiredRolesAgainstUser(config, user.roles);
      if (mockDenied) return mockDenied;
      const resp: ConfigResponse = {
        user,
        access_token: "mock-access-token",
      };
      return Response.json(resp);
    }

    const tokenCookie = getChunkedCookieFromRequest(req, TOKEN_COOKIE);
    const cookieHeader = req.headers.get("cookie") ?? "(none)";
    console.log(`[auth-bff] /api/config - cookies present: ${cookieHeader.substring(0, 100)}...`);
    console.log(`[auth-bff] /api/config - ps-token (reassembled) found: ${!!tokenCookie}, length: ${tokenCookie?.length ?? 0}`);
    if (!tokenCookie) {
      return Response.json({ error: "unauthenticated" }, { status: 401 });
    }

    try {
      const tokens = JSON.parse(decrypt(tokenCookie, config.cookieSecret));
      let payload = decodeJwt(tokens.access_token as string);
      let currentAccessToken = tokens.access_token as string;

      // Auto-refresh if access_token expired
      if (isExpired(payload.exp)) {
        try {
          const refreshed = await refreshToken(
            config,
            tokens.refresh_token as string,
          );
          payload = decodeJwt(refreshed.access_token);
          currentAccessToken = refreshed.access_token;

          // Update cookie with refreshed tokens
          const encrypted = encrypt(
            JSON.stringify(refreshed),
            config.cookieSecret,
          );

          // Role gate check (after refresh)
          const roleDenied = checkRequiredRoles(config, payload);
          if (roleDenied) return roleDenied;

          // Channel permission check (after refresh)
          const channelDenied = await checkChannelPermission(
            options, payload.sub, currentAccessToken,
            payload.realm_access?.roles ?? [],
          );
          if (channelDenied) return channelDenied;

          const resp: ConfigResponse = {
            user: extractUser(payload),
            access_token: currentAccessToken,
          };
          const refreshHeaders = new Headers({ "Content-Type": "application/json" });
          for (const sc of buildChunkedSetCookies(TOKEN_COOKIE, encrypted, {
            maxAge: refreshed.refresh_expires_in,
          })) {
            refreshHeaders.append("Set-Cookie", sc);
          }
          return new Response(JSON.stringify(resp), {
            status: 200,
            headers: refreshHeaders,
          });
        } catch {
          // Refresh failed - session is dead, force re-login
          const clearHeaders = new Headers({ "Content-Type": "application/json" });
          for (const sc of buildChunkedClearCookies(TOKEN_COOKIE)) {
            clearHeaders.append("Set-Cookie", sc);
          }
          return new Response(JSON.stringify({ error: "session_expired" }), {
            status: 401,
            headers: clearHeaders,
          });
        }
      }

      // Role gate check
      const roleDenied = checkRequiredRoles(config, payload);
      if (roleDenied) return roleDenied;

      // Channel permission check
      const channelDenied = await checkChannelPermission(
        options, payload.sub, currentAccessToken,
        payload.realm_access?.roles ?? [],
      );
      if (channelDenied) return channelDenied;

      const resp: ConfigResponse = {
        user: extractUser(payload),
        access_token: currentAccessToken,
      };
      return Response.json(resp);
    } catch (err) {
      console.error("[auth-bff] Config check failed:", err);
      const clearHeaders = new Headers({ "Content-Type": "application/json" });
      for (const sc of buildChunkedClearCookies(TOKEN_COOKIE)) {
        clearHeaders.append("Set-Cookie", sc);
      }
      return new Response(JSON.stringify({ error: "invalid_session" }), {
        status: 401,
        headers: clearHeaders,
      });
    }
  };
}

/**
 * Verify the user's realm roles against config.requiredRoles (OR semantics).
 * Returns 403 Response on denial; null when allowed or gating disabled.
 *
 * Why no cookie clear on denial: the JWT itself is valid - the user is
 * authenticated, just not authorized. They choose to logout via the
 * forbidden panel; we don't kill the session for them.
 */
function checkRequiredRoles(
  config: AuthConfig,
  payload: JwtPayload,
): Response | null {
  const userRoles = payload.realm_access?.roles ?? [];
  return checkRequiredRolesAgainstUser(config, userRoles, payload.sub);
}

/** 403 the caller: authenticated, but not entitled to this channel. */
function denyChannel(userId: string, channelId: string, why: string): Response {
  console.info(
    `[auth-bff] Channel access denied for user ${userId}, channel ${channelId} (${why})`,
  );
  return Response.json(
    { error: "channel_access_denied", message: "คุณไม่มีสิทธิ์เข้าถึง Channel นี้" },
    { status: 403 },
  );
}

/**
 * Check if the user may open the configured channel, via portal-service.
 * Returns a 403 Response when denied, or null when allowed / not configured.
 *
 * Reads `GET /api/me/permissions`, which any authenticated principal may call
 * and which returns only the caller's own row.
 *
 * History - why not `/admin/users`: that endpoint is
 * `hasAnyRole('Admin','Manager')`, so a plain `User` received 403, which the
 * old code lumped in with "portal unreachable" and failed OPEN on. The gate
 * consequently restricted Manager accounts while waving through every ordinary
 * user, i.e. the opposite of its purpose. It also fetched every user in the
 * realm to find one row, and the Manager visibility filter could omit the
 * caller from their own listing.
 *
 * Failure policy - distinguish "denied" from "couldn't tell":
 *   401 / 403 / 4xx  → a definitive answer about this session. Fail CLOSED.
 *   404              → portal-service predates this endpoint. Fail OPEN, loudly;
 *                      deploy portal-service before the apps and this never fires.
 *   5xx / network    → infrastructure fault, says nothing about entitlement.
 *                      Fail OPEN so a portal blip can't lock every app at once.
 */
async function checkChannelPermission(
  options: ConfigHandlerOptions | undefined,
  userId: string,
  accessToken: string,
  userRoles: string[] = [],
): Promise<Response | null> {
  if (!options?.channelId || !options?.portalApiUrl) return null;

  // Admin bypass: platform Admins may access every app/channel, mirroring the
  // tenant-filter bypass in portal-service TenantContext.isAdmin. Without this,
  // an Admin whose portal_users row has an empty permissions_apps (or no row at
  // all) is 403'd on every gated app even though the role gate passed.
  //
  // SuperAdmin belongs here for the same reason and is NOT covered by "Admin" -
  // it is a separate realm role. It cleared the role gate above (which has its
  // own SuperAdmin bypass) and was then refused here, because the platform
  // operator has no portal_users permissions_apps row listing every app. The
  // symptom was a "channel_access_denied" panel on an app the operator must
  // always be able to open.
  if (userRoles.includes("SuperAdmin") || userRoles.includes("Admin")) return null;

  let res: Response;
  try {
    res = await fetch(`${options.portalApiUrl}/api/me/permissions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    console.warn(
      "[auth-bff] Channel check: portal unreachable, allowing access:",
      err,
    );
    return null;
  }

  if (res.status === 404) {
    console.error(
      "[auth-bff] Channel check: /api/me/permissions returned 404 - portal-service " +
        "is older than this app. Allowing access; deploy portal-service to close the gate.",
    );
    return null;
  }
  if (res.status >= 500) {
    console.warn(
      `[auth-bff] Channel check: portal returned ${res.status}, allowing access`,
    );
    return null;
  }
  if (!res.ok) {
    return denyChannel(userId, options.channelId, `portal returned ${res.status}`);
  }

  let allowed: string[];
  try {
    const body = (await res.json()) as { apps?: string[] };
    allowed = body.apps ?? [];
  } catch {
    return denyChannel(userId, options.channelId, "unparseable portal response");
  }

  if (!allowed.includes(options.channelId)) {
    return denyChannel(userId, options.channelId, "channel not in permissions.apps");
  }

  return null;
}

/**
 * GET /api/auth/logout
 *
 * Revokes the refresh token at Keycloak (best-effort), clears the session
 * cookie, and redirects to the login page.
 */
export function createLogoutHandler(config: AuthConfig) {
  return async function GET(req: Request): Promise<Response> {
    const tokenCookie = getChunkedCookieFromRequest(req, TOKEN_COOKIE);

    if (tokenCookie && !config.mockMode) {
      try {
        const tokens = JSON.parse(decrypt(tokenCookie, config.cookieSecret));
        if (tokens.refresh_token) {
          await revokeToken(config, tokens.refresh_token as string);
        }
      } catch {
        // Best-effort - we clear the cookie regardless
      }
    }

    const headers = new Headers();
    // Clear our own cookie on the same response that starts the redirect, so
    // the session is gone whether or not the Keycloak hop completes.
    for (const sc of buildChunkedClearCookies(TOKEN_COOKIE)) {
      headers.append("Set-Cookie", sc);
    }

    // Then end the SSO session at Keycloak. Without this hop the browser keeps
    // its Keycloak session cookie, and the next "Sign in" returns a code with
    // no prompt - so the button appears to do nothing, and on a shared machine
    // the next person is still signed in as whoever used it last.
    //
    // config.redirectUri is this app's callback on its public origin, which is
    // the one thing here that already carries the public scheme and host, so
    // the landing page is derived from it rather than from req.url (which is
    // the internal host:port behind the reverse proxy).
    const postLogoutRedirectUri = logoutLandingUrl(config);
    if (!config.mockMode && postLogoutRedirectUri) {
      headers.set("Location", buildLogoutUrl(config, postLogoutRedirectUri));
      return new Response(null, { status: 302, headers });
    }

    // Mock mode, or a redirectUri we could not parse: fall back to the local
    // login page. Relative path - the browser resolves it against the public
    // domain.
    headers.set("Location", "/login");
    return new Response(null, { status: 302, headers });
  };
}

/**
 * Where Keycloak sends the browser after it has ended the session.
 *
 * Derived from the configured callback URI so an app does not have to add a
 * second setting, and so the value is guaranteed to be on the app's own public
 * origin - which is what the client's post.logout.redirect.uris must list.
 */
function logoutLandingUrl(config: AuthConfig): string | null {
  try {
    const cb = new URL(config.redirectUri);
    return `${cb.origin}/login`;
  } catch {
    return null;
  }
}
