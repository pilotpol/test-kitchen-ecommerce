import { createALEProxyRoute } from "@repo/ai-gateway-sdk/server";

const handler = createALEProxyRoute({
  aiGatewayUrl: process.env.AI_GATEWAY_URL!,
  channelApiKey: process.env.CHANNEL_API_KEY!,
});

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
