// Phase 5.1.1 - BFF proxy for ALE Brain user-scoped endpoints.
//
// Mounts a catch-all under /api/ale/* that forwards to the gateway's
// /v1/ale/* surface. The channel API key never leaves the server; the
// browser only sees same-origin requests like GET /api/ale/memory.
//
// JWT resolution: reads the encrypted ``ps-token`` cookie set by
// @repo/auth-bff, decrypts it with the same secret used by the auth
// handlers, and pulls out the Keycloak access_token to forward as the
// gateway's Bearer JWT. Apps using a different session strategy can
// override ``resolveUserJwt`` (see SDK docs).
import { decrypt, getCookieFromRequest } from "@repo/auth-bff";
import { createALEProxyRoute } from "@repo/ai-gateway-sdk/server";

import { authConfig } from "@/lib/auth-config";

const handler = createALEProxyRoute({
  aiGatewayUrl: process.env.AI_GATEWAY_URL || "http://localhost:4000",
  channelApiKey: process.env.CHANNEL_API_KEY || "",
  resolveUserJwt: (req) => {
    const enc = getCookieFromRequest(req, "ps-token");
    if (!enc) return null;
    try {
      const json = decrypt(enc, authConfig.cookieSecret);
      const parsed = JSON.parse(json) as { access_token?: string };
      return parsed.access_token ?? null;
    } catch {
      return null;
    }
  },
});

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
