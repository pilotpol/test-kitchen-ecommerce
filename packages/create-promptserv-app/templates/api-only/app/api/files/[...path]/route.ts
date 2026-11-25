import { createFileProxyRoute } from "@repo/ai-gateway-sdk/next/middleware";

const handler = createFileProxyRoute({
  aiGatewayUrl: process.env.AI_GATEWAY_URL!,
  channelApiKey: process.env.CHANNEL_API_KEY!,
});

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
