import {
  createCallbackHandler,
  createConfigHandler,
  createLoginHandler,
  createLogoutHandler,
} from "@repo/auth-bff";

import type { SdkAuthConfig } from "../types";

export interface CreatedAuthRoutes {
  /** Mount under `/api/auth/login/route.ts` as `export const GET` */
  loginGET: ReturnType<typeof createLoginHandler>;
  /** Mount under `/api/auth/callback/route.ts` as `export const GET` */
  callbackGET: ReturnType<typeof createCallbackHandler>;
  /** Mount under `/api/config/route.ts` as `export const GET` */
  configGET: ReturnType<typeof createConfigHandler>;
  /** Mount under `/api/auth/logout/route.ts` as `export const GET` */
  logoutGET: ReturnType<typeof createLogoutHandler>;
}

/**
 * One-shot factory that produces all four Keycloak BFF route handlers.
 *
 * Usage:
 * ```ts
 * // lib/auth.ts
 * export const authRoutes = createAuthRoutes({ ...myAuthConfig });
 *
 * // app/api/auth/login/route.ts
 * import { authRoutes } from "@/lib/auth";
 * export const GET = authRoutes.loginGET;
 *
 * // app/api/auth/callback/route.ts
 * export const GET = authRoutes.callbackGET;
 *
 * // app/api/config/route.ts
 * export const GET = authRoutes.configGET;
 *
 * // app/api/auth/logout/route.ts
 * export const GET = authRoutes.logoutGET;
 * ```
 */
export function createAuthRoutes(config: SdkAuthConfig): CreatedAuthRoutes {
  const postLoginPath = config.postLoginPath ?? "/";
  return {
    loginGET: createLoginHandler(config, postLoginPath),
    callbackGET: createCallbackHandler(config, postLoginPath),
    configGET: createConfigHandler(config, {
      channelId: config.channelId,
      portalApiUrl: config.portalApiUrl,
    }),
    logoutGET: createLogoutHandler(config),
  };
}
