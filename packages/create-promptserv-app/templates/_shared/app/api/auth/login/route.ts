import { createAuthRoutes } from "@repo/ai-gateway-sdk/auth/keycloak/server";

import { authRoutesConfig } from "@/lib/channel-config";

export const GET = createAuthRoutes(authRoutesConfig).loginGET;
