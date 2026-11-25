/**
 * HTTP transport layer.
 *
 * Responsibilities:
 *   - merge auth headers
 *   - forward X-Trace-ID when provided by caller
 *   - retry idempotent GET/PUT/DELETE on 5xx / network error (POST never retried)
 *   - parse errors into typed PromptServError subclasses
 *   - return either parsed JSON or raw Response (for streams)
 */

import { AuthStrategy, headersForAuth } from "./auth";
import { NetworkError, parseGatewayError, PromptServError } from "./errors";

export interface RetryOptions {
  /** max attempts including the first (default 3). 1 = no retry. */
  max: number;
  /** linear | exponential — exponential doubles delay each attempt */
  backoff: "linear" | "exponential";
  /** base delay ms (default 250) */
  baseDelayMs?: number;
}

export interface TransportOptions {
  /** e.g. http://promptserv-ai-gateway:4000 */
  aiGatewayUrl: string;
  auth: AuthStrategy;
  timeout?: number;
  retry?: RetryOptions;
  /** When true, auto-forward an X-Trace-ID from request-scoped store. */
  traceHeaderForward?: boolean;
  /** Hooks for observability */
  onRequest?: (req: { method: string; url: string }) => void;
  onResponse?: (res: { method: string; url: string; status: number; durationMs: number }) => void;
  fetchImpl?: typeof fetch;
  /** API version pin (future-proofing) */
  apiVersion?: string;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** Override headers (merged with auth) */
  headers?: Record<string, string>;
  /** When true, returns the raw Response (caller handles streaming). */
  raw?: boolean;
  /** AbortSignal from caller (e.g. UI cancellation) */
  signal?: AbortSignal;
  /** Per-request timeout override (ms) */
  timeout?: number;
  /** Propagate this trace id as X-Trace-ID */
  traceId?: string;
}

const isIdempotent = (m: string) =>
  m === "GET" || m === "PUT" || m === "DELETE";

export class Transport {
  private opts: TransportOptions;
  private fetchImpl: typeof fetch;

  constructor(opts: TransportOptions) {
    this.opts = opts;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  buildUrl(path: string, query?: RequestOptions["query"]): string {
    const base = this.opts.aiGatewayUrl.replace(/\/+$/, "");
    const url = new URL(`${base}${path.startsWith("/") ? "" : "/"}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  async request<T = unknown>(opts: RequestOptions): Promise<T> {
    const method = opts.method ?? "GET";
    const retry = this.opts.retry ?? { max: 3, backoff: "exponential" as const };
    const maxAttempts = isIdempotent(method) ? retry.max : 1;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.doRequest<T>(opts);
      } catch (err) {
        lastErr = err;
        // Only retry on network / 5xx. Typed 4xx errors fail fast.
        if (err instanceof PromptServError && err.code < 500) throw err;
        if (attempt === maxAttempts) throw err;
        await sleep(backoffMs(attempt, retry));
      }
    }
    throw lastErr;
  }

  private async doRequest<T>(opts: RequestOptions): Promise<T> {
    const method = opts.method ?? "GET";
    const url = this.buildUrl(opts.path, opts.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...headersForAuth(this.opts.auth),
      ...(opts.headers ?? {}),
    };

    if (opts.traceId || this.opts.traceHeaderForward) {
      if (opts.traceId) headers["X-Trace-ID"] = opts.traceId;
    }
    if (this.opts.apiVersion) {
      headers["X-Api-Version"] = this.opts.apiVersion;
    }

    let body: BodyInit | undefined;
    if (opts.body !== undefined) {
      if (opts.body instanceof FormData || opts.body instanceof Blob) {
        body = opts.body;
      } else {
        headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
        body = JSON.stringify(opts.body);
      }
    }

    const timeoutMs = opts.timeout ?? this.opts.timeout ?? 30_000;
    const timeoutCtrl = new AbortController();
    const composedSignal = composeSignals(opts.signal, timeoutCtrl.signal);
    const timer = setTimeout(() => timeoutCtrl.abort(), timeoutMs);

    this.opts.onRequest?.({ method, url });
    const start = Date.now();
    let resp: Response;
    try {
      resp = await this.fetchImpl(url, {
        method,
        headers,
        body,
        signal: composedSignal,
      });
    } catch (err) {
      clearTimeout(timer);
      const cause = err instanceof Error ? err.message : String(err);
      throw new NetworkError({
        message: `Network request failed: ${cause}`,
        code: 0,
      });
    }
    clearTimeout(timer);

    this.opts.onResponse?.({
      method,
      url,
      status: resp.status,
      durationMs: Date.now() - start,
    });

    if (opts.raw) {
      if (!resp.ok) {
        const text = await resp.text();
        throw parseGatewayError(resp.status, text, resp.headers.get("X-Trace-ID") ?? undefined);
      }
      return resp as unknown as T;
    }

    const text = await resp.text();
    if (!resp.ok) {
      throw parseGatewayError(resp.status, text, resp.headers.get("X-Trace-ID") ?? undefined);
    }
    if (!text) return undefined as unknown as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number, retry: RetryOptions): number {
  const base = retry.baseDelayMs ?? 250;
  if (retry.backoff === "exponential") return base * 2 ** (attempt - 1);
  return base * attempt;
}

function composeSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal {
  if (!a) return b!;
  if (!b) return a;
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (a.aborted || b.aborted) ctrl.abort();
  else {
    a.addEventListener("abort", onAbort);
    b.addEventListener("abort", onAbort);
  }
  return ctrl.signal;
}
