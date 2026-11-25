import { createWebhookRoute } from "@repo/ai-gateway-sdk/webhooks";

/**
 * Inbound webhook for this channel. The CLI wires the verifier that matches
 * CHANNEL_TYPE; swap to a different verifier if your provider changes.
 */
export const POST = createWebhookRoute({
  channelType: "{{CHANNEL_TYPE}}" === "LINE"
    ? "line"
    : "{{CHANNEL_TYPE}}" === "TELEGRAM"
      ? "telegram"
      : "generic",
  secret:
    process.env.LINE_CHANNEL_SECRET ??
    process.env.TELEGRAM_SECRET_TOKEN ??
    process.env.WEBHOOK_SECRET ??
    "",
  onEvent: async ({ parsed }) => {
    console.log("[webhook] event received", parsed);
    // TODO: forward to gateway, enqueue, or dispatch a workflow.
    return { status: 200, body: { ok: true } };
  },
});
