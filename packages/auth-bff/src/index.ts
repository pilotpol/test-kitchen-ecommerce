/**
 * @repo/auth-bff - Shared Keycloak OIDC BFF logic for Next.js API Routes.
 *
 * Usage in apps:
 * ```typescript
 * // apps/portal/lib/auth-config.ts
 * import type { AuthConfig } from '@repo/auth-bff';
 * export const authConfig: AuthConfig = { ... };
 *
 * // apps/portal/app/api/auth/login/route.ts
 * import { createLoginHandler } from '@repo/auth-bff';
 * import { authConfig } from '@/lib/auth-config';
 * export const GET = createLoginHandler(authConfig, '/dashboard');
 * ```
 */

// Types
export type {
  AuthConfig,
  AuthUser,
  ConfigResponse,
  JwtPayload,
  KeycloakTokenResponse,
} from "./types";

// Handler factories (main API)
export {
  createCallbackHandler,
  createConfigHandler,
  createLoginHandler,
  createLogoutHandler,
} from "./handlers";
export type { ConfigHandlerOptions } from "./handlers";

// Keycloak direct API (for advanced use cases)
export {
  buildAuthorizationUrl,
  buildLogoutUrl,
  exchangeCode,
  refreshToken,
  revokeToken,
} from "./keycloak";

// Server-side session check for API routes and server components: decrypts
// the cookie, verifies the token signature (JWKS), refreshes an expired token
// and applies the role gate. Use this instead of decrypt + decodeJwt.
export { hasAnyRole, requireSession } from "./session";
export type { RequireSessionOptions, VerifiedSession } from "./session";
export {
  isJwtVerificationEnabled,
  jwksUrl,
  TokenVerificationError,
  verifyAccessToken,
} from "./verify";
export type { TokenVerificationFailure } from "./verify";

// Utilities
export { decrypt, encrypt } from "./crypto";
export { decodeJwt, extractUser, hasRole, isExpired } from "./jwt";
export { buildClearCookie, buildSetCookie, getCookieFromRequest } from "./cookie";
// The chunked forms, for apps that hold the session cookie themselves rather
// than only through the handlers above. A domain proxy that has to refresh an
// expired access token needs to read and rewrite the same cookie the callback
// handler wrote, and the callback handler writes it chunked.
export {
  buildChunkedClearCookies,
  buildChunkedSetCookies,
  getChunkedCookieFromRequest,
} from "./cookie";
