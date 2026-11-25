/**
 * Shared type definitions for Keycloak OIDC integration.
 *
 * Why separate file: types are consumed by both server-side (BFF handlers)
 * and client-side (auth-core), keeping them in one place avoids drift.
 */

/** Keycloak token endpoint response structure */
export interface KeycloakTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
  id_token?: string;
  scope?: string;
  session_state?: string;
}

/** User info extracted from JWT claims */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

/** BFF configuration - all values from server-side env variables */
export interface AuthConfig {
  /** Keycloak internal URL (server-to-server), e.g. http://keycloak:8180 */
  keycloakUrl: string;
  /**
   * Keycloak public URL for browser redirects.
   * Falls back to keycloakUrl if not set.
   *
   * Why separate: in Docker, server talks to internal DNS (keycloak:8180)
   * but browser must redirect to public URL (localhost:8180 or auth.company.com).
   */
  keycloakPublicUrl?: string;
  /** Keycloak realm name, e.g. promptserve */
  realm: string;
  /** OIDC client ID registered in Keycloak */
  clientId: string;
  /** OIDC client secret - server-side only, never expose to browser */
  clientSecret: string;
  /** Redirect URI for this app's callback, e.g. http://localhost:3000/api/auth/callback */
  redirectUri: string;
  /** Secret key for encrypting cookie values (AES) */
  cookieSecret: string;
  /** OIDC scopes (default: openid email profile) */
  scope?: string;
  /** Enable mock mode - skip Keycloak, return fake user (for development) */
  mockMode?: boolean;
  /**
   * Realm roles required for /api/config to succeed. User must have at least
   * ONE of these (OR semantics). Empty/undefined = no role gating.
   *
   * Why server-side enforcement: a client-only role check is bypassable via
   * DevTools. The BFF is the single chokepoint that issues access_token to
   * the frontend, so denying here denies all downstream API calls.
   */
  requiredRoles?: string[];
  /**
   * บทบาทเพิ่มของผู้ใช้จำลองเมื่อ mockMode เปิด (นอกจากบทบาทกลางและ requiredRoles)
   * ใช้กับแอปที่ตรวจบทบาทอื่นนอกจากด่านเข้าแอป เช่น SPW_AR / SPW_TENANT ของ SPW
   */
  mockRoles?: string[];
  /**
   * Verify the access token signature against the realm JWKS before any
   * server-side session check trusts its claims (see verify.ts).
   * Unset = on, unless the AUTH_VERIFY_JWT env var is false/0/off/no.
   */
  verifyJwt?: boolean;
}

/** /api/config response shape */
export interface ConfigResponse {
  user: AuthUser;
  access_token: string;
}

/** Decoded JWT payload (partial - only fields we care about) */
export interface JwtPayload {
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  realm_access?: { roles?: string[] };
  exp: number;
  iat: number;
  /** Issuer, e.g. https://auth.example/realms/promptserv */
  iss?: string;
  /** Authorized party: the client the token was issued to */
  azp?: string;
  nbf?: number;
}
