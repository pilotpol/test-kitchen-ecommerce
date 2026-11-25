import { createPromptServRoute } from "@repo/ai-gateway-sdk/server";

export const POST = createPromptServRoute({
  aiGatewayUrl: process.env.AI_GATEWAY_URL!,
  channelApiKey: process.env.CHANNEL_API_KEY!,
  forwardUserToken: true,
});
