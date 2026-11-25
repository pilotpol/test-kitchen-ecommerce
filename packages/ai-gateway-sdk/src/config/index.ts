export {
  DEFAULT_AI_GATEWAY_URL,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_KEYCLOAK_SCOPE,
  DEFAULT_TOKEN_COOKIE_NAME,
  DEFAULT_LOGIN_PATH,
  DEFAULT_POST_LOGIN_PATH,
} from "./defaults";

export {
  AuthStrategySchema,
  ClientOptionsSchema,
  KeycloakConfigSchema,
  ChannelInfoSchema,
  WebhookChannelConfigSchema,
  ChannelConfigSchema,
  EnvSchema,
  type ChannelConfig,
  type KeycloakConfig,
  type WebhookChannelConfig,
  type ChannelInfo,
  type ValidatedEnv,
} from "./schema";

export { validateEnv, EnvValidationError } from "./validateEnv";
export { defineChannelConfig } from "./defineChannelConfig";
