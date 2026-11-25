export type WebhookChannelType = "line" | "telegram" | "generic";

export interface WebhookRequest<T = unknown> {
  rawBody: string;
  parsed: T;
  headers: Headers;
}

export interface WebhookResult {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface CreateWebhookRouteConfig {
  /** Type of signature verification to apply. */
  channelType: WebhookChannelType;
  /** Shared secret — LINE channel secret, Telegram secret token, or HMAC key. */
  secret: string;
  /**
   * Override the signature header name. Defaults:
   *   line     → `X-Line-Signature`
   *   telegram → `X-Telegram-Bot-Api-Secret-Token`
   *   generic  → `X-Signature`
   */
  signatureHeader?: string;
  /** For `generic`: override HMAC algo (default sha256). */
  hmacAlgo?: "sha1" | "sha256" | "sha384" | "sha512";
  /** For `generic`: override digest encoding (default hex). */
  hmacEncoding?: "hex" | "base64";
  /** For `generic`: strip a prefix like `sha256=` before comparing. */
  signaturePrefix?: string;
  /**
   * Called when the signature is valid. Return a `WebhookResult` or a
   * `Response` — the former is the ergonomic default.
   */
  onEvent: (
    req: WebhookRequest,
  ) => Promise<WebhookResult | Response> | WebhookResult | Response;
  /** Optional: override 401 response body (default: `{ error: "invalid_signature" }`). */
  onInvalid?: (rawBody: string, headers: Headers) => Response;
}
