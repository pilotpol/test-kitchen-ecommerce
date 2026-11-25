import {
  decodeJwt,
  decrypt,
  extractUser,
  getCookieFromRequest,
  isExpired,
  refreshToken as keycloakRefresh,
  type AuthUser,
} from "@repo/auth-bff";

import type { SdkAuthConfig } from "../types";

const TOKEN_COOKIE = "ps-token";

export interface ServerSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

/**
 * Reads the encrypted session cookie from an incoming Request (Next.js
 * Route Handler or RSC-compatible). Auto-refreshes when the access token
 * is expired; returns null when the session is missing or invalid.
 *
 * NOTE: Unlike `/api/config`, this does not rotate the cookie — use in
 * server components / route handlers where you need the user identity but
 * the refreshed token only needs to live for this request. If you need the
 * client to see the refreshed cookie, prefer hitting `/api/config` instead.
 */
export async function getServerSession(
  req: Request,
  config: SdkAuthConfig,
): Promise<ServerSession | null> {
  if (config.mockMode) {
    return {
      user: {
        id: "mock-user-1",
        name: "POC AR / POC Tenant",
        email: "poc@promptserv.local",
        roles: ["AI_USER", "PORTAL_ADMIN", "Admin", "SPW_AR", "SPW_TENANT"],
      },
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
    };
  }

  const cookie = getCookieFromRequest(req, TOKEN_COOKIE);
  if (!cookie) return null;

  try {
    const tokens = JSON.parse(decrypt(cookie, config.cookieSecret));
    let accessToken = tokens.access_token as string;
    let payload = decodeJwt(accessToken);

    if (isExpired(payload.exp)) {
      const refreshed = await keycloakRefresh(
        config,
        tokens.refresh_token as string,
      );
      accessToken = refreshed.access_token;
      payload = decodeJwt(accessToken);
      return {
        user: extractUser(payload),
        accessToken,
        refreshToken: refreshed.refresh_token,
      };
    }

    return {
      user: extractUser(payload),
      accessToken,
      refreshToken: tokens.refresh_token as string,
    };
  } catch {
    return null;
  }
}
