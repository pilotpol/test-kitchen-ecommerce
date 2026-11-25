/**
 * JWT decode and utility functions — client-safe (no verification).
 *
 * Why no signature verification: the BFF handles token exchange with Keycloak
 * directly, so tokens are guaranteed authentic. We only decode to extract
 * claims for UI decisions (user display name, role checks).
 *
 * Why not use jwt-decode npm package: decoding a JWT is 3 lines of code.
 * No need for a dependency.
 */

import type { AuthUser, JwtPayload } from "./types.js";

/**
 * Decode a JWT payload without signature verification.
 *
 * Why base64url replacement: JWT uses URL-safe base64 encoding which replaces
 * '+' with '-' and '/' with '_'. Standard atob/Buffer.from needs the originals.
 */
export function decodeJwt(token: string): JwtPayload {
  const parts = token.split(".");
  const payload = parts[1];
  if (!payload) {
    throw new Error("Invalid JWT: missing payload segment");
  }

  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const json = Buffer.from(base64, "base64").toString("utf8");
  return JSON.parse(json) as JwtPayload;
}

/**
 * Check if a JWT has expired.
 *
 * Why 30-second buffer: network latency between BFF and the downstream API
 * can cause a token to expire mid-flight. Refreshing 30s early prevents 401s.
 */
export function isExpired(exp: number, bufferSeconds = 30): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds >= exp - bufferSeconds;
}

/** Check if the JWT contains a specific Keycloak realm role */
export function hasRole(payload: JwtPayload, role: string): boolean {
  return payload.realm_access?.roles?.includes(role) ?? false;
}

/** Extract a normalized AuthUser from JWT claims */
export function extractUser(payload: JwtPayload): AuthUser {
  return {
    id: payload.sub,
    name: payload.name ?? payload.preferred_username ?? "Unknown",
    email: payload.email ?? "",
    roles: payload.realm_access?.roles ?? [],
  };
}
