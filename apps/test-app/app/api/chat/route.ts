import { createPromptServRoute } from "@repo/ai-gateway-sdk/server";
import { withAuth } from "@repo/ai-gateway-sdk/auth/keycloak/server";

import { authConfig } from "@/lib/auth-config";

// ── Channel + JWT Mode ──
// CHANNEL_API_KEY authenticates the app (channel-level access to AI Gateway).
// The signed-in person's Keycloak token is forwarded as Bearer, so the gateway
// knows who asked and the usage log names them. AI Gateway resolves the model
// from the agent behind the app's channel; the app never names one.
const relay = createPromptServRoute({
  aiGatewayUrl: process.env.AI_GATEWAY_URL || "http://localhost:4000",
  channelApiKey: process.env.CHANNEL_API_KEY,
  forwardUserToken: true,
  // Refuse a request that carries no user token rather than spending the
  // channel's budget on it.
  requireUserToken: true,
  // Portal mode fallback (used when CHANNEL_API_KEY is not set)
  portalApiUrl: process.env.PORTAL_API_URL,
});

/*
 * Only a signed-in person may chat.
 *
 * The browser talks to this route with the session cookie, not with an
 * Authorization header, so the relay above used to see no user at all: the
 * channel key went to the gateway on every request and anybody on the
 * internet could ask questions on the app's budget (found on V4, 2026-10-09:
 * POST /api/chat with no cookie answered 200). withAuth reads the encrypted
 * session cookie (401 without one) and the session's access token is handed
 * to the relay as the Bearer it forwards.
 */
export const POST = withAuth(authConfig, async (req, { session }) => {
  const headers = new Headers(req.headers);
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  return relay(new Request(req.url, { method: "POST", headers, body: await req.text() }));
});
