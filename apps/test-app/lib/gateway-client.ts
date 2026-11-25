"use client";

/**
 * Browser-side PromptServClient singleton for the template.
 *
 * Pointed at the SAME-ORIGIN BFF proxy so the channel API key stays
 * server-side. The auth strategy is set to ``channel-user`` so the SDK's
 * ALE namespace knows to expect a JWT in the Authorization header -
 * but in this BFF setup, the Authorization header is set by the BFF
 * proxy itself (read from the cookie session), not by the client.
 *
 * That's why the ``userJwt`` field is intentionally an empty placeholder.
 * The BFF intercepts every request, attaches the real JWT from the
 * cookie, and forwards. From the SDK's perspective the requests look
 * "user-authenticated" because the proxy is on the same origin and
 * the credentials cookie flows automatically.
 */

import { PromptServClient } from "@repo/ai-gateway-sdk";

let _client: PromptServClient | null = null;

export function getGatewayClient(): PromptServClient {
  if (_client) return _client;
  _client = new PromptServClient({
    // Same-origin: the Next dev server / prod runtime hosts both /api/chat
    // and /api/ale/*. Browser requests stay on the current origin.
    aiGatewayUrl: typeof window !== "undefined" ? window.location.origin : "",
    auth: {
      kind: "channel-user",
      // Channel key isn't actually used here - the BFF substitutes the
      // real one. We pass a placeholder so the auth-strategy validator
      // (which requires non-empty values) doesn't reject us.
      channelApiKey: "bff-managed",
      userJwt: "bff-managed",
    },
  });
  return _client;
}
