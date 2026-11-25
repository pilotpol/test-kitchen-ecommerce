import { timingSafeStringEqual } from "./timing";

export interface TelegramVerifyInput {
  /** Value of the `X-Telegram-Bot-Api-Secret-Token` header the caller sent. */
  secretTokenHeader: string | null;
  /** Expected secret token configured when registering the webhook. */
  expectedSecretToken: string;
}

/**
 * Telegram Bot API webhook verification.
 * Reference: https://core.telegram.org/bots/api#setwebhook
 *
 * Telegram does NOT sign the body; it sends a shared secret via the
 * `X-Telegram-Bot-Api-Secret-Token` header. Compare that against the value
 * you passed to `setWebhook`.
 */
export function verifyTelegramSignature(input: TelegramVerifyInput): boolean {
  if (!input.secretTokenHeader || !input.expectedSecretToken) return false;
  return timingSafeStringEqual(
    input.secretTokenHeader,
    input.expectedSecretToken,
  );
}
