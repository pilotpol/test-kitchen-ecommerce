import { defineChannelConfig, validateEnv } from "@repo/ai-gateway-sdk/config";

const env = validateEnv();

export const channelConfig = defineChannelConfig({
  client: {
    aiGatewayUrl: env.AI_GATEWAY_URL,
    auth: { kind: "channel", channelApiKey: env.CHANNEL_API_KEY },
  },
  auth: {
    keycloakUrl: env.KEYCLOAK_URL,
    keycloakPublicUrl: env.KEYCLOAK_PUBLIC_URL,
    realm: env.KEYCLOAK_REALM,
    clientId: env.KEYCLOAK_CLIENT_ID,
    clientSecret: env.KEYCLOAK_CLIENT_SECRET,
    redirectUri: env.KEYCLOAK_REDIRECT_URI,
    cookieSecret: env.COOKIE_SECRET,
    mockMode: env.AUTH_MOCK_MODE,
    postLoginPath: "/",
    channelId: env.CHANNEL_ID,
  },
  channel: {
    id: env.CHANNEL_ID ?? "unset",
    type: "{{CHANNEL_TYPE}}" as "WEB" | "WEB_APP" | "LINE" | "TELEGRAM" | "IOT" | "DOCUMENT",
  },
});

export const authRoutesConfig = channelConfig.auth;
export const clientOptions = channelConfig.client;
