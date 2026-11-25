/**
 * Cookie parsing utilities for Next.js API Routes.
 *
 * Why not use a library: cookie parsing is trivial string splitting,
 * and we avoid adding a dependency for 20 lines of code.
 */

/**
 * Parse a specific cookie value from a Request's Cookie header.
 *
 * Chunk-aware: tries `<name>.0`, `<name>.1`, ... first and reassembles them
 * (Chrome enforces a 4096-byte per-cookie limit; large Keycloak session
 * cookies must be split across multiple Set-Cookie headers). Falls back to
 * the legacy single-cookie form `<name>` for pre-chunking sessions and for
 * small cookies that never needed splitting (e.g. `ps-state`).
 *
 * Behavior is identical for unchunked cookies — callers don't need to know
 * whether chunking is in play.
 */
export function getCookieFromRequest(
  req: Request,
  name: string,
): string | undefined {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return undefined;

  // Parse all cookies into a map so we can do prefix lookups efficiently.
  const cookies = new Map<string, string>();
  for (const c of cookieHeader.split(";")) {
    const trimmed = c.trim();
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    cookies.set(trimmed.slice(0, eqIdx), trimmed.slice(eqIdx + 1));
  }

  // Prefer chunked form when `<name>.0` is present.
  if (cookies.has(`${name}.0`)) {
    const parts: string[] = [];
    // Bounded loop — see MAX_CHUNKS below.
    for (let i = 0; i < 12; i++) {
      const chunk = cookies.get(`${name}.${i}`);
      if (chunk === undefined) break;
      parts.push(chunk);
    }
    return parts.join("");
  }

  // Legacy single-cookie fallback.
  return cookies.get(name);
}

/**
 * Build a Set-Cookie header value.
 *
 * Why helper: consistent cookie attributes across all auth endpoints.
 * HttpOnly + SameSite=Lax is the security baseline.
 */
export function buildSetCookie(
  name: string,
  value: string,
  options: {
    maxAge?: number;
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
  } = {},
): string {
  const {
    maxAge,
    path = "/",
    httpOnly = true,
    secure = process.env.NODE_ENV === "production",
    sameSite = "Lax",
  } = options;

  const parts = [`${name}=${value}`, `Path=${path}`, `SameSite=${sameSite}`];

  if (maxAge !== undefined) parts.push(`Max-Age=${String(maxAge)}`);
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");

  return parts.join("; ");
}

/** Build a Set-Cookie header that clears (expires) a cookie */
export function buildClearCookie(name: string, path = "/"): string {
  return `${name}=; Path=${path}; Max-Age=0; HttpOnly; SameSite=Lax`;
}

// ── Cookie chunking ────────────────────────────────────────────────────────
//
// Chrome (and other browsers) enforce a 4096-byte limit per cookie (RFC 6265
// minimum). Our encrypted session token + Keycloak access_token can exceed
// that for users with many realm roles. Without chunking, the browser
// silently drops the Set-Cookie and the next /api/config sees no cookie,
// triggering an infinite login loop.
//
// We chunk the encrypted value across cookies named `<name>.0`, `<name>.1`,
// etc. Reader reassembles in order until the first missing chunk.

/** Max bytes per chunk's VALUE — leaves ~600B headroom for name + attrs. */
const MAX_CHUNK_VALUE = 3500;
/** Max number of chunks we ever clear/scan — bounds clearing loops. */
const MAX_CHUNKS = 12;

function splitIntoChunks(value: string): string[] {
  if (value.length <= MAX_CHUNK_VALUE) return [value];
  const out: string[] = [];
  for (let i = 0; i < value.length; i += MAX_CHUNK_VALUE) {
    out.push(value.slice(i, i + MAX_CHUNK_VALUE));
  }
  return out;
}

/**
 * Build chunked Set-Cookie headers for a (potentially large) value.
 *
 * Returns an array because each chunk is a separate Set-Cookie header.
 * Also clears the legacy single-cookie name (`<name>`) and any orphan
 * chunks above the new chunk count so old sessions don't accumulate.
 */
export function buildChunkedSetCookies(
  name: string,
  value: string,
  options: Parameters<typeof buildSetCookie>[2] = {},
): string[] {
  const chunks = splitIntoChunks(value);
  const out: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    out.push(buildSetCookie(`${name}.${i}`, chunks[i]!, options));
  }
  // Clear orphan chunks above the current count.
  for (let i = chunks.length; i < MAX_CHUNKS; i++) {
    out.push(buildClearCookie(`${name}.${i}`));
  }
  // Clear the legacy single-cookie name (pre-chunking sessions).
  out.push(buildClearCookie(name));
  return out;
}

/**
 * Read a chunked cookie value, reassembling `<name>.0`, `<name>.1`, ...
 *
 * Falls back to the legacy single-cookie `<name>` if no chunked form exists.
 * Returns undefined if neither form is present.
 */
export function getChunkedCookieFromRequest(
  req: Request,
  name: string,
): string | undefined {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return undefined;

  const cookies = new Map<string, string>();
  for (const c of cookieHeader.split(";")) {
    const trimmed = c.trim();
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    cookies.set(trimmed.slice(0, eqIdx), trimmed.slice(eqIdx + 1));
  }

  // Prefer chunked form.
  const firstChunk = cookies.get(`${name}.0`);
  if (firstChunk !== undefined) {
    const parts: string[] = [];
    for (let i = 0; i < MAX_CHUNKS; i++) {
      const chunk = cookies.get(`${name}.${i}`);
      if (chunk === undefined) break;
      parts.push(chunk);
    }
    return parts.join("");
  }

  // Legacy single-cookie fallback.
  return cookies.get(name);
}

/** Build clear-cookie headers for all chunks + the legacy single name. */
export function buildChunkedClearCookies(name: string): string[] {
  const out: string[] = [buildClearCookie(name)];
  for (let i = 0; i < MAX_CHUNKS; i++) {
    out.push(buildClearCookie(`${name}.${i}`));
  }
  return out;
}
