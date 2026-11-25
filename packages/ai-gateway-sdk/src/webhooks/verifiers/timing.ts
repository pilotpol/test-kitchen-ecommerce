import { timingSafeEqual } from "node:crypto";

/**
 * Timing-safe comparison of two strings. Returns false when lengths differ
 * without leaking via early exit; equal-length strings are compared byte-wise
 * with `crypto.timingSafeEqual`.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return timingSafeEqual(bufA, bufB);
}
