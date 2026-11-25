import type { AuthUser } from "@repo/auth-bff";

import type { SdkAuthConfig } from "../types";

import { getServerSession, type ServerSession } from "./getServerSession";

export type AuthedRouteHandler = (
  req: Request,
  ctx: { session: ServerSession; user: AuthUser },
) => Promise<Response> | Response;

/**
 * Higher-order wrapper for Next.js Route Handlers that enforces an
 * authenticated session. Returns 401 when no valid session is found;
 * otherwise invokes the handler with `{ session, user }`.
 *
 * Usage:
 * ```ts
 * // app/api/workflows/[id]/route.ts
 * import { withAuth } from "@repo/ai-gateway-sdk/auth/keycloak/server";
 * import { authConfig } from "@/lib/auth";
 *
 * export const GET = withAuth(authConfig, async (req, { user, session }) => {
 *   return Response.json({ user });
 * });
 * ```
 */
export function withAuth(
  config: SdkAuthConfig,
  handler: AuthedRouteHandler,
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const session = await getServerSession(req, config);
    if (!session) {
      return Response.json({ error: "unauthenticated" }, { status: 401 });
    }
    return handler(req, { session, user: session.user });
  };
}
