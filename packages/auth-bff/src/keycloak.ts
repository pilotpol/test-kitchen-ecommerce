/**
 * Keycloak OIDC protocol helpers — build URLs, exchange codes, refresh tokens.
 *
 * Why direct Keycloak: eliminates dependency on portal-service (Kotlin backend).
 * Each Next.js app talks to Keycloak directly via standard OIDC endpoints.
 *
 * Security: client_secret is used server-side only (API Routes).
 * The browser never sees it.
 */

import type { AuthConfig, KeycloakTokenResponse } from "./types";

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

/** Resolve the public-facing Keycloak URL (for browser redirects) */
function publicBaseUrl(config: AuthConfig): string {
  return config.keycloakPublicUrl ?? config.keycloakUrl;
}

/** Standard OIDC token endpoint — server-to-server (internal URL) */
function tokenEndpoint(config: AuthConfig): string {
  return `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/token`;
}

/** Standard OIDC authorization endpoint — browser redirect (public URL) */
function authorizationEndpoint(config: AuthConfig): string {
  return `${publicBaseUrl(config)}/realms/${config.realm}/protocol/openid-connect/auth`;
}

/**
 * RP-initiated logout endpoint — browser redirect (public URL).
 *
 * Revoking the refresh token and clearing our own cookie is not a sign-out:
 * it ends this app's session and leaves the one that matters, the browser's
 * SSO session at Keycloak. The next "Sign in" then completes with no prompt,
 * which to the person who just pressed the button looks like nothing happened
 * - and on a shared machine means the next person is still signed in.
 *
 * No id_token_hint: the callback deliberately does not keep the id_token
 * (it is large enough to push the cookie past what the browser will store).
 * Keycloak 18+ accepts client_id + a post_logout_redirect_uri that the client
 * has registered, which is the path used here. An unregistered URI is refused
 * with 400 rather than redirected, so the URI below must exist in the client's
 * post.logout.redirect.uris.
 */
export function buildLogoutUrl(config: AuthConfig, postLogoutRedirectUri: string): string {
  const url = new URL(
    `${publicBaseUrl(config)}/realms/${config.realm}/protocol/openid-connect/logout`,
  );
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri);
  return url.toString();
}

/** Standard OIDC logout endpoint — server-to-server (internal URL) */
function logoutEndpoint(config: AuthConfig): string {
  return `${config.keycloakUrl}/realms/${config.realm}/protocol/openid-connect/logout`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the full Keycloak authorization URL.
 *
 * Why we include `state`: CSRF protection — the callback handler validates
 * that the returned state matches what we stored in a short-lived cookie.
 */
export function buildAuthorizationUrl(
  config: AuthConfig,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scope ?? "openid email profile",
    state,
  });
  return `${authorizationEndpoint(config)}?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens.
 *
 * Why application/x-www-form-urlencoded: Keycloak token endpoint requires
 * form encoding per OAuth 2.0 spec (RFC 6749 §4.1.3).
 */
export async function exchangeCode(
  config: AuthConfig,
  code: string,
): Promise<KeycloakTokenResponse> {
  const res = await fetch(tokenEndpoint(config), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "no body");
    throw new Error(
      `Keycloak code exchange failed: ${String(res.status)} - ${body}`,
    );
  }

  return (await res.json()) as KeycloakTokenResponse;
}

/**
 * Refresh an access token using a refresh token.
 *
 * Why separate from exchangeCode: different grant_type, and we call this
 * on every /api/config request when the access_token has expired.
 */
export async function refreshToken(
  config: AuthConfig,
  refreshTok: string,
): Promise<KeycloakTokenResponse> {
  const res = await fetch(tokenEndpoint(config), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshTok,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "no body");
    throw new Error(
      `Keycloak token refresh failed: ${String(res.status)} - ${body}`,
    );
  }

  return (await res.json()) as KeycloakTokenResponse;
}

/**
 * Revoke a refresh token at Keycloak (logout).
 *
 * Why best-effort (no throw on error): if Keycloak is unreachable during
 * logout, we still want to clear the local cookie. The token will expire
 * naturally via Keycloak's session TTL.
 */
export async function revokeToken(
  config: AuthConfig,
  refreshTok: string,
): Promise<void> {
  try {
    await fetch(logoutEndpoint(config), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshTok,
      }),
    });
  } catch {
    // Best-effort — cookie will be cleared regardless
  }
}
