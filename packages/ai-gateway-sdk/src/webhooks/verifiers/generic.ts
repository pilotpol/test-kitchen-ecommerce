import { createHmac } from "node:crypto";

import { timingSafeStringEqual } from "./timing";

export type HmacAlgo = "sha1" | "sha256" | "sha384" | "sha512";
export type HmacEncoding = "hex" | "base64";

export interface GenericHmacVerifyInput {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  /** Defaults to sha256 */
  algo?: HmacAlgo;
  /** Defaults to hex */
  encoding?: HmacEncoding;
  /**
   * Some providers prefix with the algo (e.g. GitHub: `sha256=...`).
   * Pass the literal prefix to strip before comparison.
   */
  signaturePrefix?: string;
}

/**
 * Generic HMAC signature verifier — works for most custom webhooks.
 * Default: HMAC-SHA256 hex of the raw body, compared to the header value.
 */
export function verifyGenericHmac(input: GenericHmacVerifyInput): boolean {
  if (!input.signatureHeader || !input.secret) return false;
  const algo = input.algo ?? "sha256";
  const encoding = input.encoding ?? "hex";

  const received = input.signaturePrefix
    ? input.signatureHeader.replace(input.signaturePrefix, "")
    : input.signatureHeader;

  const expected = createHmac(algo, input.secret)
    .update(input.rawBody, "utf8")
    .digest(encoding);

  return timingSafeStringEqual(expected, received);
}
