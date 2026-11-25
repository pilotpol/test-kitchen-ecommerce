export interface FileProxyRouteConfig {
  /** Base URL of AI Gateway proxy (e.g. http://promptserv-ai-gateway:4001). */
  aiGatewayUrl: string;
  /** Channel API key — server-only, never leaked to browser. */
  channelApiKey: string;
  /**
   * Resolve the user JWT for identity tracking.
   * Default: forwards the incoming Authorization header.
   */
  resolveUserJwt?: (req: Request) => string | null | Promise<string | null>;
  /** API prefix in your Next.js app. Default: `/api/files`. */
  apiPrefix?: string;
  /** Gateway prefix. Default: `/v1/files`. */
  gatewayPrefix?: string;
}

/**
 * Mirror of `createALEProxyRoute` for file operations. Mount on a
 * catch-all route (`app/api/files/[...path]/route.ts`) so the browser can
 * call `client.files.*` without seeing the channel key.
 *
 * Supports GET / POST / PATCH / DELETE. Body is forwarded verbatim as text;
 * for very large multipart bodies, upload direct-to-MinIO via presigned
 * URL instead (see `client.files.uploadToPresigned`).
 */
export function createFileProxyRoute(config: FileProxyRouteConfig) {
  const apiPrefix = config.apiPrefix ?? "/api/files";
  const gatewayPrefix = config.gatewayPrefix ?? "/v1/files";

  return async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const idx = url.pathname.indexOf(apiPrefix);
    if (idx < 0) {
      return new Response("not a file proxy route", { status: 400 });
    }
    const subPath = url.pathname.slice(idx + apiPrefix.length);
    const targetUrl =
      config.aiGatewayUrl.replace(/\/+$/, "") +
      gatewayPrefix +
      subPath +
      url.search;

    const headers: Record<string, string> = {
      "X-Channel-Key": config.channelApiKey,
    };
    const ct = req.headers.get("Content-Type");
    if (ct) headers["Content-Type"] = ct;

    let userJwt: string | null = null;
    if (config.resolveUserJwt) {
      userJwt = await config.resolveUserJwt(req);
    } else {
      const auth = req.headers.get("Authorization");
      if (auth?.startsWith("Bearer ")) userJwt = auth.slice("Bearer ".length);
    }
    if (userJwt) headers["Authorization"] = `Bearer ${userJwt}`;

    const init: RequestInit = { method: req.method, headers };
    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = await req.text();
    }

    const upstream = await fetch(targetUrl, init);

    const respHeaders: Record<string, string> = {};
    const upstreamCt = upstream.headers.get("Content-Type");
    if (upstreamCt) respHeaders["Content-Type"] = upstreamCt;
    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    });
  };
}
