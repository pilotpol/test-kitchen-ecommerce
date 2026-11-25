import { createHmac } from "node:crypto";

import { timingSafeStringEqual } from "./timing";

export interface LineVerifyInput {
  rawBody: string;
  signatureHeader: string | null;
  channelSecret: string;
}

/**
 * LINE Messaging API webhook signature verification.
 * Reference: https://developers.line.biz/en/reference/messaging-api/#signature-validation
 *
 * Signature = Base64( HMAC-SHA256( channelSecret, rawRequestBody ) )
 * Header: `X-Line-Signature`
 */
export function verifyLineSignature(input: LineVerifyInput): boolean {
  if (!input.signatureHeader || !input.channelSecret) return false;
  const expected = createHmac("sha256", input.channelSecret)
    .update(input.rawBody, "utf8")
    .digest("base64");
  return timingSafeStringEqual(expected, input.signatureHeader);
}
