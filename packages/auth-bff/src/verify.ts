/**
 * Access token signature verification against the realm's JWKS.
 *
 * Why this exists: the session cookie is sealed with AES-GCM under
 * AUTH_COOKIE_SECRET, and everything downstream used to trust the JWT inside
 * it after a plain base64 decode. Whoever holds that one secret (it is shared
 * by every app on a host) could therefore mint a cookie carrying any `sub`
 * and any realm roles, including SuperAdmin. Checking the Keycloak signature
 * closes that: forging a session now also needs the realm's private key.
 *
 * Scope: signature, algorithm, issuer realm and authorized party. Expiry is
 * deliberately left to the caller, because an expired-but-genuine token is
 * not an attack, it is the normal trigger for a refresh (see session.ts).
 *
 * Switch: on by default. `AUTH_VERIFY_JWT=false` (or `verifyJwt: false` in
 * AuthConfig) turns it off and falls back to the previous decode-only
 * behaviour. That is the escape hatch if a realm is ever served with keys
 * this code does not understand; it is not meant to stay off.
 *
 * No dependency: node:crypto verifies RS/PS/ES signatures from a JWK directly.
 */

import {
  constants,
  createPublicKey,
  verify as cryptoVerify,
  type JsonWebKey,
  type KeyObject,
} from "crypto";

import type { AuthConfig, JwtPayload } from "./types";

/** Why the token could not be accepted. */
export type TokenVerificationFailure =
  /** The token itself is not acceptable (bad signature, wrong realm, ...). */
  | "invalid"
  /** The signing keys could not be fetched, so nothing can be said. */
  | "unavailable";

export class TokenVerificationError extends Error {
  readonly kind: TokenVerificationFailure;

  constructor(kind: TokenVerificationFailure, message: string) {
    super(message);
    this.name = "TokenVerificationError";
    this.kind = kind;
  }
}

interface AlgSpec {
  hash: "sha256" | "sha384" | "sha512";
  kty: "RSA" | "EC";
  pss?: boolean;
}

// Asymmetric algorithms only. "none" and the HS* family are refused outright:
// an HMAC token would be "verified" with a key the caller chooses.
const ALGORITHMS: Record<string, AlgSpec> = {
  RS256: { hash: "sha256", kty: "RSA" },
  RS384: { hash: "sha384", kty: "RSA" },
  RS512: { hash: "sha512", kty: "RSA" },
  PS256: { hash: "sha256", kty: "RSA", pss: true },
  PS384: { hash: "sha384", kty: "RSA", pss: true },
  PS512: { hash: "sha512", kty: "RSA", pss: true },
  ES256: { hash: "sha256", kty: "EC" },
  ES384: { hash: "sha384", kty: "EC" },
  ES512: { hash: "sha512", kty: "EC" },
};

/** How long a fetched key set is trusted before it is fetched again. */
const JWKS_TTL_MS = 10 * 60 * 1000;
/** Minimum gap between refetches triggered by an unknown `kid`. */
const JWKS_MIN_REFETCH_MS = 30 * 1000;
/** Clock skew allowed on `nbf`. */
const NBF_SKEW_SECONDS = 60;

interface CachedKey {
  key: KeyObject;
  kty: string;
  alg?: string;
}

interface KeySetEntry {
  keys: Map<string, CachedKey>;
  fetchedAt: number;
}

const keySets = new Map<string, KeySetEntry>();
const lastFetchAttempt = new Map<string, number>();
const inflight = new Map<string, Promise<KeySetEntry>>();

let warnedDisabled = false;

/** True unless verification was switched off by config or AUTH_VERIFY_JWT. */
export function isJwtVerificationEnabled(config: AuthConfig): boolean {
  if (typeof config.verifyJwt === "boolean") return config.verifyJwt;
  const raw = (process.env.AUTH_VERIFY_JWT ?? "").trim().toLowerCase();
  const disabled = raw === "false" || raw === "0" || raw === "off" || raw === "no";
  if (disabled && !warnedDisabled) {
    warnedDisabled = true;
    console.warn(
      "[auth-bff] AUTH_VERIFY_JWT is off: session tokens are decoded without a signature check",
    );
  }
  return !disabled;
}

/** The realm's JWKS endpoint, on the server-to-server Keycloak URL. */
export function jwksUrl(config: AuthConfig): string {
  const base = config.keycloakUrl.replace(/\/+$/, "");
  return `${base}/realms/${encodeURIComponent(config.realm)}/protocol/openid-connect/certs`;
}

/** Forget every cached key set. Tests use it; nothing else needs to. */
export function resetJwksCache(): void {
  keySets.clear();
  lastFetchAttempt.clear();
  inflight.clear();
}

function base64UrlToBuffer(segment: string): Buffer {
  return Buffer.from(segment, "base64url");
}

function parseSegment<T>(segment: string, what: string): T {
  try {
    return JSON.parse(base64UrlToBuffer(segment).toString("utf8")) as T;
  } catch {
    throw new TokenVerificationError("invalid", `malformed token ${what}`);
  }
}

async function fetchKeySet(url: string, fetchImpl: typeof fetch): Promise<KeySetEntry> {
  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { Accept: "application/json" } });
  } catch (err) {
    throw new TokenVerificationError(
      "unavailable",
      `JWKS unreachable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!res.ok) {
    throw new TokenVerificationError("unavailable", `JWKS returned ${res.status}`);
  }
  let body: { keys?: Array<JsonWebKey & { kid?: string; use?: string; alg?: string }> };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    throw new TokenVerificationError("unavailable", "JWKS response is not JSON");
  }

  const keys = new Map<string, CachedKey>();
  for (const jwk of body.keys ?? []) {
    // Keycloak publishes its encryption key (use=enc, RSA-OAEP) in the same
    // set. Only signing keys may verify a token.
    if (jwk.use && jwk.use !== "sig") continue;
    if (!jwk.kid || (jwk.kty !== "RSA" && jwk.kty !== "EC")) continue;
    try {
      keys.set(jwk.kid, {
        key: createPublicKey({ key: jwk, format: "jwk" }),
        kty: jwk.kty,
        alg: jwk.alg,
      });
    } catch {
      // One unusable key must not take the others down with it.
    }
  }
  if (keys.size === 0) {
    throw new TokenVerificationError("unavailable", "JWKS has no usable signing key");
  }
  return { keys, fetchedAt: Date.now() };
}

async function loadKeySet(
  url: string,
  fetchImpl: typeof fetch,
  force: boolean,
): Promise<KeySetEntry> {
  const cached = keySets.get(url);
  if (cached && !force && Date.now() - cached.fetchedAt < JWKS_TTL_MS) return cached;

  // Collapse concurrent fetches into one request.
  const running = inflight.get(url);
  if (running) return running;

  lastFetchAttempt.set(url, Date.now());
  const p = fetchKeySet(url, fetchImpl)
    .then((entry) => {
      keySets.set(url, entry);
      return entry;
    })
    .catch((err: unknown) => {
      // A stale set still verifies tokens signed with keys it holds; prefer
      // it over failing every request while Keycloak is briefly unreachable.
      if (cached) return cached;
      throw err;
    })
    .finally(() => {
      inflight.delete(url);
    });
  inflight.set(url, p);
  return p;
}

async function resolveKey(
  config: AuthConfig,
  kid: string,
  fetchImpl: typeof fetch,
): Promise<CachedKey | undefined> {
  const url = jwksUrl(config);
  let set = await loadKeySet(url, fetchImpl, false);
  let key = set.keys.get(kid);
  if (key) return key;

  // Unknown kid: the realm may have rotated its keys. Refetch, but not more
  // often than JWKS_MIN_REFETCH_MS, so a stream of junk kids cannot turn
  // every request into a call to Keycloak.
  const last = lastFetchAttempt.get(url) ?? 0;
  if (Date.now() - last < JWKS_MIN_REFETCH_MS) return undefined;
  set = await loadKeySet(url, fetchImpl, true);
  key = set.keys.get(kid);
  return key;
}

export interface VerifyAccessTokenOptions {
  /** Injected for tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Seconds since epoch; injected for tests. */
  nowSeconds?: number;
}

/**
 * Verify a Keycloak access token and return its claims.
 *
 * Throws TokenVerificationError("invalid") when the token is not acceptable
 * and TokenVerificationError("unavailable") when the key set cannot be read.
 * Does not check `exp` (see the file header).
 */
export async function verifyAccessToken(
  token: string,
  config: AuthConfig,
  opts: VerifyAccessTokenOptions = {},
): Promise<JwtPayload> {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new TokenVerificationError("invalid", "token is not a signed JWT");
  }
  const [headerSeg, payloadSeg, sigSeg] = parts as [string, string, string];

  const header = parseSegment<{ alg?: string; kid?: string }>(headerSeg, "header");
  const spec = header.alg ? ALGORITHMS[header.alg] : undefined;
  if (!spec) {
    throw new TokenVerificationError("invalid", `algorithm not accepted: ${String(header.alg)}`);
  }
  if (!header.kid) {
    throw new TokenVerificationError("invalid", "token has no kid");
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  const cached = await resolveKey(config, header.kid, fetchImpl);
  if (!cached) {
    throw new TokenVerificationError("invalid", "token signed with an unknown key");
  }
  if (cached.kty !== spec.kty || (cached.alg && cached.alg !== header.alg)) {
    throw new TokenVerificationError("invalid", "token algorithm does not match its key");
  }

  const data = Buffer.from(`${headerSeg}.${payloadSeg}`, "utf8");
  const signature = base64UrlToBuffer(sigSeg);
  let ok = false;
  try {
    if (spec.kty === "EC") {
      ok = cryptoVerify(spec.hash, data, { key: cached.key, dsaEncoding: "ieee-p1363" }, signature);
    } else if (spec.pss) {
      ok = cryptoVerify(
        spec.hash,
        data,
        {
          key: cached.key,
          padding: constants.RSA_PKCS1_PSS_PADDING,
          saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
        },
        signature,
      );
    } else {
      ok = cryptoVerify(spec.hash, data, cached.key, signature);
    }
  } catch {
    ok = false;
  }
  if (!ok) {
    throw new TokenVerificationError("invalid", "token signature does not verify");
  }

  const payload = parseSegment<JwtPayload>(payloadSeg, "payload");

  // The key set is per realm already; the issuer check keeps a token from
  // another realm on the same Keycloak from being accepted if a key were
  // ever shared. Compared by suffix because the issuer carries the public
  // host while keycloakUrl may be the internal one.
  const realmSuffix = `/realms/${config.realm}`;
  if (typeof payload.iss !== "string" || !payload.iss.replace(/\/+$/, "").endsWith(realmSuffix)) {
    throw new TokenVerificationError("invalid", "token issued by another realm");
  }
  // Every cookie this BFF writes holds a token issued to its own client.
  if (payload.azp !== undefined && payload.azp !== config.clientId) {
    throw new TokenVerificationError("invalid", "token issued to another client");
  }
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (typeof payload.nbf === "number" && payload.nbf > now + NBF_SKEW_SECONDS) {
    throw new TokenVerificationError("invalid", "token not valid yet");
  }
  // Realms without the `basic` client scope omit `sub` from access tokens;
  // the gateway falls back to preferred_username in that case, so do we.
  if (!payload.sub && !payload.preferred_username) {
    throw new TokenVerificationError("invalid", "token names no user");
  }
  if (typeof payload.exp !== "number") {
    throw new TokenVerificationError("invalid", "token has no expiry");
  }
  return payload;
}
