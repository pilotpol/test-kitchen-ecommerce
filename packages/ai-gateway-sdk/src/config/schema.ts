import { z } from "zod";

export const AuthStrategySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("channel"), channelApiKey: z.string().min(1) }),
  z.object({
    kind: z.literal("channel-user"),
    channelApiKey: z.string().min(1),
    userJwt: z.string().min(1),
  }),
  z.object({ kind: z.literal("master"), masterKey: z.string().min(1) }),
]);

export const ClientOptionsSchema = z.object({
  aiGatewayUrl: z.string().url(),
  auth: AuthStrategySchema,
  timeout: z.number().int().positive().optional(),
  apiVersion: z.string().optional(),
});

export const KeycloakConfigSchema = z.object({
  keycloakUrl: z.string().url(),
  keycloakPublicUrl: z.string().url().optional(),
  realm: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  cookieSecret: z.string().min(16, "cookieSecret must be at least 16 chars"),
  scope: z.string().optional(),
  mockMode: z.boolean().optional(),
  postLoginPath: z.string().optional(),
  logoutRedirectPath: z.string().optional(),
});

export const ChannelInfoSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  type: z
    .enum(["WEB", "WEB_APP", "LINE", "TELEGRAM", "IOT", "DOCUMENT"])
    .optional(),
});

export const WebhookChannelConfigSchema = z.object({
  channelType: z.enum(["line", "telegram", "generic"]),
  secret: z.string().min(1),
  path: z.string().optional(),
  hmacAlgo: z.string().optional(),
  signatureHeader: z.string().optional(),
});

export const ChannelConfigSchema = z.object({
  client: ClientOptionsSchema,
  auth: KeycloakConfigSchema,
  channel: ChannelInfoSchema,
  webhook: WebhookChannelConfigSchema.optional(),
});

export const EnvSchema = z.object({
  AI_GATEWAY_URL: z.string().url(),
  CHANNEL_API_KEY: z.string().min(1),
  CHANNEL_ID: z.string().min(1).optional(),
  MASTER_KEY: z.string().min(1).optional(),
  KEYCLOAK_URL: z.string().url(),
  KEYCLOAK_PUBLIC_URL: z.string().url().optional(),
  KEYCLOAK_REALM: z.string().min(1),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
  KEYCLOAK_CLIENT_SECRET: z.string().min(1),
  KEYCLOAK_REDIRECT_URI: z.string().url(),
  COOKIE_SECRET: z.string().min(16),
  KEYCLOAK_SCOPE: z.string().optional(),
  AUTH_MOCK_MODE: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;
export type KeycloakConfig = z.infer<typeof KeycloakConfigSchema>;
export type WebhookChannelConfig = z.infer<typeof WebhookChannelConfigSchema>;
export type ChannelInfo = z.infer<typeof ChannelInfoSchema>;
export type ValidatedEnv = z.infer<typeof EnvSchema>;
