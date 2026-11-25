import type { AuthConfig } from "@repo/auth-bff";

/**
 * Keycloak OIDC configuration.
 *
 * All values are read from environment variables so the same codebase
 * works across dev / staging / production without code changes.
 *
 * For local development without Keycloak, set AUTH_MOCK=true in .env.local.
 */
export const authConfig: AuthConfig = {
  keycloakUrl:
    process.env.KEYCLOAK_URL || "http://localhost:8180",
  keycloakPublicUrl:
    process.env.KEYCLOAK_PUBLIC_URL ||
    process.env.KEYCLOAK_URL ||
    "http://localhost:8180",
  realm: process.env.KEYCLOAK_REALM || "promptserv",
  clientId: process.env.KEYCLOAK_CLIENT_ID || "promptserv-chat",
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || "",
  redirectUri:
    process.env.AUTH_REDIRECT_URI ||
    "http://localhost:3009/api/auth/callback",
  cookieSecret:
    process.env.AUTH_COOKIE_SECRET ||
    "change-me-32-char-secret-key!!!",
  mockMode: process.env.AUTH_MOCK === "true",
  requiredRoles: (process.env.AUTH_REQUIRED_ROLES ?? "User")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};
