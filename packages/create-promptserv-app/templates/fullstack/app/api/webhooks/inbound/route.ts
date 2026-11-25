import { createWebhookRoute } from "@repo/ai-gateway-sdk/webhooks";

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
    return { status: 200, body: { ok: true } };
  },
});
