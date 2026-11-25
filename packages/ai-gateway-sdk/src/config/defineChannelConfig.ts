import { ChannelConfigSchema, type ChannelConfig } from "./schema";

/**
 * Single source of truth for a PromptServ channel app.
 *
 * Wire the result into:
 *   - `<PromptServClientProvider client={new PromptServClient(config.client)}/>`
 *   - `createAuthRoutes(config.auth)`
 *   - `createWebhookRoute({ ...config.webhook, ... })`
 *
 * Throws on validation failure so misconfigured apps fail fast at startup.
 */
export function defineChannelConfig(input: ChannelConfig): ChannelConfig {
  const parsed = ChannelConfigSchema.safeParse(input);
  if (!parsed.success) {
    const summary = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid channel config:\n${summary}`);
  }
  return parsed.data;
}
