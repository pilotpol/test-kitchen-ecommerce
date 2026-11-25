import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

/**
 * ข้อความที่ผู้ใช้ปลายทางเห็นเมื่อคำขอถูกปฏิเสธ
 *
 * ทำไมต้องมีชุดนี้: เดิมเส้นทางนี้ตอบ "Internal Server Error" (500) เมื่อ body
 * ของคำขอไม่ใช่ JSON และตอบ "Gateway Error: {json ดิบของ gateway}" เมื่อช่องทาง
 * ถูกปิดตามรอบทดลองใช้ ทั้งสองแบบอ่านเหมือนระบบพัง ทั้งที่ความจริงคือคำขอไม่ถูก
 * รูปแบบ หรือสิทธิ์สิ้นสุดแล้ว และการส่งข้อความของ gateway ออกไปตรง ๆ ยังเปิดเผย
 * รายละเอียดภายในให้ผู้ที่ยังไม่ได้ล็อกอินอีกด้วย
 */
export const GATEWAY_DENIAL_MESSAGES = {
  accessEnded:
    "สิทธิ์การเข้าใช้งานระบบสิ้นสุดหรือถูกระงับ กรุณาติดต่อผู้ดูแลระบบหรือเจ้าหน้าที่ผู้ประสานงาน",
  unauthorized: "ไม่ได้รับสิทธิ์เข้าใช้งาน กรุณาเข้าสู่ระบบใหม่อีกครั้ง",
  badRequest:
    "รูปแบบคำขอไม่ถูกต้อง ต้องส่งข้อมูลเป็น JSON และระบุข้อความที่ต้องการถาม",
  tooManyRequests:
    "ขณะนี้มีผู้ใช้งานพร้อมกันจำนวนมาก กรุณาลองใหม่อีกครั้งในอีกสักครู่",
  upstreamFailure: "ขออภัย ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง",
} as const;

/** ตอบกลับเป็น JSON รูปแบบเดียวกับ gateway เพื่อให้ฝั่งหน้าจออ่านได้ทั้งสองทาง */
export function denialResponse(
  status: number,
  message: string,
  type: string
): Response {
  return new Response(JSON.stringify({ error: { code: status, message, type } }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * แปลงรหัสตอบของ gateway เป็นข้อความที่ผู้ใช้อ่านรู้เรื่อง โดยคงรหัสเดิมไว้
 * เพื่อให้ฝั่งหน้าจอและผลตรวจสุขภาพยังแยกแยะสาเหตุได้เหมือนเดิม
 *
 * 403 = ช่องทางถูกปิด (รอบทดลองใช้สิ้นสุด หรือผู้ดูแลปิดช่องทางนั้น)
 */
export function denialFromGatewayStatus(status: number): Response {
  if (status === 403) {
    return denialResponse(403, GATEWAY_DENIAL_MESSAGES.accessEnded, "access_ended");
  }
  if (status === 401) {
    return denialResponse(401, GATEWAY_DENIAL_MESSAGES.unauthorized, "authentication_error");
  }
  if (status === 429) {
    return denialResponse(429, GATEWAY_DENIAL_MESSAGES.tooManyRequests, "rate_limit_error");
  }
  if (status === 400 || status === 404 || status === 422) {
    return denialResponse(400, GATEWAY_DENIAL_MESSAGES.badRequest, "invalid_request_error");
  }
  return denialResponse(502, GATEWAY_DENIAL_MESSAGES.upstreamFailure, "gateway_error");
}

export interface PromptServRouteConfig {
  aiGatewayUrl: string;
  portalApiUrl?: string;
  /** Channel API key — when set, bypasses portal-service and uses this key directly */
  channelApiKey?: string;
  /**
   * Default model when no allowedModels are available.
   *
   * Ignored in Channel + JWT mode: a channel authenticates the caller, it does
   * not choose the model. The agent bound to the channel's entry point decides,
   * and the gateway drops any model sent on that path. Still used by the
   * portal-mode branch below, which authenticates with a real virtual key.
   */
  defaultModel?: string;
  /**
   * When true AND channelApiKey is set: sends channelApiKey via X-Channel-Key header
   * and forwards the user's JWT (from Authorization header) as Bearer token.
   * AI Gateway uses the channel key for auth (budget, rate limits) and the JWT
   * for user identity tracking; the model comes from the channel's agent.
   *
   * Auth modes summary:
   * - Channel + JWT (forwardUserToken=true): X-Channel-Key + Bearer JWT → Gateway resolves internally
   * - Channel only (forwardUserToken=false, default): Bearer = channelApiKey (no user identity)
   * - Portal mode (no channelApiKey): JWT → portal-service → virtualKey → Bearer
   */
  forwardUserToken?: boolean;
  /**
   * บังคับว่าต้องมีเทิร์นของผู้ใช้ที่ล็อกอินแล้ว (Authorization: Bearer) ก่อนจึงจะ
   * ยิงไปที่ gateway ใช้กับแอปที่ผูกกับช่องทางแบบ anonymous
   *
   * ทำไมต้องมี: ในโหมด channel + JWT กุญแจของช่องทางอยู่ฝั่ง server และถูกแนบให้
   * ทุกคำขอเสมอ ถ้าช่องทางนั้นเป็น anonymous ผู้ที่ไม่ได้ล็อกอินก็ถามคำถามและใช้
   * งบของลูกค้าได้ทันทีที่ช่องทางเปิด ด่านเดียวที่กั้นอยู่คือสถานะเปิดปิดของช่องทาง
   * ซึ่งมองไม่เห็นเลยตอนรอบปิด แล้วกลับมาพร้อมกันทันทีที่เปิดรอบใหม่
   */
  requireUserToken?: boolean;
}

export const createPromptServRoute = (config: PromptServRouteConfig) => {
  return async (req: Request) => {
    try {
      // body ที่ไม่ใช่ JSON ต้องเป็น 400 พร้อมบอกว่าผิดตรงไหน ไม่ใช่ 500
      // (คำขอเปล่า ๆ จากภายนอกเคยได้ "Internal Server Error" ซึ่งอ่านเหมือนระบบล่ม)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let body: any;
      try {
        body = await req.json();
      } catch {
        return denialResponse(400, GATEWAY_DENIAL_MESSAGES.badRequest, "invalid_request_error");
      }
      if (!body || typeof body !== "object") {
        return denialResponse(400, GATEWAY_DENIAL_MESSAGES.badRequest, "invalid_request_error");
      }
      const requestedModel: string = body.model || "";

      // Support both BFF payload ({ message: "..." }) and OpenAI format ({ messages: [...] })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let messages: { role: string; content: any }[];
      if (Array.isArray(body.messages) && body.messages.length > 0) {
        messages = body.messages;
      } else if (body.message) {
        messages = [{ role: "user", content: body.message }];
      } else {
        return denialResponse(400, GATEWAY_DENIAL_MESSAGES.badRequest, "invalid_request_error");
      }

      // Multimodal: convert image_base64 into OpenAI vision content array
      if (body.image_base64) {
        const lastUserMsg = messages[messages.length - 1];
        if (lastUserMsg?.role === "user") {
          const textContent = typeof lastUserMsg.content === "string" ? lastUserMsg.content : "";
          lastUserMsg.content = [
            { type: "text", text: textContent },
            { type: "image_url", image_url: { url: body.image_base64 } },
          ];
        }
      }

      // ── Channel + JWT mode: dual-auth via raw fetch (proxy SSE stream) ──
      // createOpenAI always overrides Authorization with apiKey,
      // so we use direct fetch to control both X-Channel-Key and Bearer JWT.
      if (config.channelApiKey && config.forwardUserToken) {
        const authHeader = req.headers.get("Authorization") || "";

        // ด่านล็อกอิน ตรวจก่อนแตะ gateway เพื่อไม่ให้คำขอของผู้ที่ยังไม่ล็อกอิน
        // เดินทางต่อด้วยกุญแจของช่องทาง
        if (config.requireUserToken && !authHeader) {
          return denialResponse(
            401,
            GATEWAY_DENIAL_MESSAGES.unauthorized,
            "authentication_error"
          );
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Channel-Key": config.channelApiKey,
          Accept: "text/event-stream",
        };
        // Forward user JWT for identity tracking (optional)
        if (authHeader) {
          headers["Authorization"] = authHeader;
        }
        // Conversation identity. The gateway stamps session_id onto every
        // usage log from this header, which is what lets the Portal group a
        // person's turns back into one conversation instead of a pile of
        // unrelated runs. Forwarded only when the caller sets it - inventing
        // one per request would produce a session per turn, which reads as
        // real data while meaning nothing.
        const sessionId = req.headers.get("X-Session-ID");
        if (sessionId) {
          headers["X-Session-ID"] = sessionId;
        }

        // No `model` field. On a channel path the agent behind the entry point
        // is the model authority, and the gateway drops anything sent here -
        // sending one only produces a warn line and the false impression, at
        // the call site, that this app picks its own model.
        //
        // sub_agent_ids opts the gateway into multi-agent router mode
        // (Watson agentic POC) - forward it when the caller supplied one.
        const gatewayPayload: Record<string, unknown> = {
          messages,
          stream: true,
        };
        if (Array.isArray(body.sub_agent_ids) && body.sub_agent_ids.length > 0) {
          gatewayPayload.sub_agent_ids = body.sub_agent_ids;
        }

        const gatewayResponse = await fetch(
          `${config.aiGatewayUrl}/v1/chat/completions`,
          {
            method: "POST",
            headers,
            body: JSON.stringify(gatewayPayload),
          }
        );

        if (!gatewayResponse.ok) {
          // เก็บข้อความจริงของ gateway ไว้ใน log ของแอป ไม่ส่งออกไปหาผู้เรียก
          const err = await gatewayResponse.text().catch(() => "");
          console.warn(
            `[promptserv-route] gateway ตอบ ${gatewayResponse.status}: ${err.slice(0, 300)}`
          );
          return denialFromGatewayStatus(gatewayResponse.status);
        }

        // Proxy SSE stream directly to the client
        return new Response(gatewayResponse.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      }

      // ── Channel mode (legacy) or Portal mode: use Vercel AI SDK ──
      let apiKey: string;
      let modelName: string;

      if (config.channelApiKey) {
        // Channel mode: use pre-configured API key directly
        apiKey = config.channelApiKey;
        modelName = requestedModel || config.defaultModel || "gpt-4o-mini";
      } else {
        // Portal mode: fetch virtualKey from portal-service per user
        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.replace("Bearer ", "").trim();

        if (!token) {
          return denialResponse(401, GATEWAY_DENIAL_MESSAGES.unauthorized, "authentication_error");
        }

        const portalResponse = await fetch(
          `${config.portalApiUrl}/v1/users/me/chat-config`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!portalResponse.ok) {
          console.warn(
            `[promptserv-route] portal-service ตอบ ${portalResponse.status} ตอนขอ chat-config`
          );
          return denialFromGatewayStatus(portalResponse.status);
        }

        const chatConfig = await portalResponse.json();
        const virtualKey = chatConfig.virtualKey;
        const allowedModels = chatConfig.allowedModels || [];

        if (!virtualKey) {
          return denialResponse(403, GATEWAY_DENIAL_MESSAGES.accessEnded, "access_ended");
        }

        apiKey = virtualKey;
        modelName =
          requestedModel ||
          allowedModels[0] ||
          config.defaultModel ||
          "gpt-4o-mini";
      }

      // Setup Vercel AI SDK Provider with AI Gateway (OpenAI-compatible)
      const promptservAI = createOpenAI({
        baseURL: `${config.aiGatewayUrl}/v1`,
        apiKey,
      });

      // Forward the chat request to the Gateway.
      // Cast: our local message shape (string role, loose content) is a superset
      // of Vercel AI SDK's CoreMessage union; we've already validated shape above.
      const result = streamText({
        model: promptservAI(modelName),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messages as any,
      });

      return result.toDataStreamResponse();
    } catch (e) {
      console.error("Error in PromptServRoute:", e);
      return denialResponse(500, GATEWAY_DENIAL_MESSAGES.upstreamFailure, "internal_error");
    }
  };
};

/* ────────────────────────────────────────────────────────────────────── */
/* ALE BFF proxy helper (Phase 5.1.1, SDK v0.2)                         */
/* ────────────────────────────────────────────────────────────────────── */

export interface ALEProxyRouteConfig {
  /** Base URL of the AI Gateway proxy port. */
  aiGatewayUrl: string;
  /** Channel API key — server-side only, never exposed to the browser. */
  channelApiKey: string;
  /**
   * Optional — reads the user JWT from the request. Default: returns the
   * incoming Authorization Bearer token verbatim. Apps that store the
   * JWT in an encrypted cookie (e.g. via @repo/auth-bff) should pass a
   * function that decrypts the cookie and returns the raw access_token.
   */
  resolveUserJwt?: (req: Request) => string | null | Promise<string | null>;
  /**
   * บังคับว่าต้องล็อกอินก่อนจึงจะ proxy ไปที่ gateway ด้วยเหตุผลเดียวกับ
   * `requireUserToken` ของเส้นทางแชต คือกุญแจของช่องทางถูกแนบให้ทุกคำขอเสมอ
   */
  requireUserJwt?: boolean;
}

/**
 * BFF helper that proxies requests to the gateway's ``/v1/ale/*`` user-
 * scoped endpoints (Phase 5.1.1).
 *
 * Apps mount this on a Next.js catch-all route (``app/api/ale/[...path]/
 * route.ts``) so the SDK's ``client.ale.*`` calls can hit a same-origin
 * URL like ``/api/ale/memory`` without leaking the channel API key to
 * the browser.
 *
 * Auth: forwards the user's JWT from the incoming Authorization header
 * (set by ``@repo/auth-bff`` on the cookie session) and adds the channel
 * key as ``X-Channel-Key``. The gateway extracts ``user_id`` from the JWT
 * sub claim and scopes the sidecar query accordingly.
 *
 * Usage:
 * ```ts
 * // app/api/ale/[...path]/route.ts
 * import { createALEProxyRoute } from "@repo/ai-gateway-sdk/server";
 * const handler = createALEProxyRoute({
 *   aiGatewayUrl: process.env.AI_GATEWAY_URL!,
 *   channelApiKey: process.env.CHANNEL_API_KEY!,
 * });
 * export const GET = handler;
 * export const POST = handler;
 * export const PATCH = handler;
 * export const DELETE = handler;
 * ```
 */
export const createALEProxyRoute = (config: ALEProxyRouteConfig) => {
  return async (req: Request) => {
    const url = new URL(req.url);
    // The route file is mounted under /api/ale/[...path], so the
    // segment after /api/ale is what we forward to the gateway as
    // /v1/ale/<path>.
    const apiPrefix = "/api/ale";
    const idx = url.pathname.indexOf(apiPrefix);
    if (idx < 0) {
      return new Response("not a ale route", { status: 400 });
    }
    const subPath = url.pathname.slice(idx + apiPrefix.length); // e.g. "/memory"
    const targetUrl =
      config.aiGatewayUrl.replace(/\/+$/, "") +
      "/v1/ale" +
      subPath +
      url.search;

    const headers: Record<string, string> = {
      "X-Channel-Key": config.channelApiKey,
    };
    const ct = req.headers.get("Content-Type");
    if (ct) headers["Content-Type"] = ct;

    // Resolve user JWT — either from a custom resolver (e.g. cookie-based
    // session) or the incoming Authorization header verbatim.
    let userJwt: string | null = null;
    if (config.resolveUserJwt) {
      userJwt = await config.resolveUserJwt(req);
    } else {
      const auth = req.headers.get("Authorization");
      if (auth?.startsWith("Bearer ")) userJwt = auth.slice("Bearer ".length);
    }
    if (config.requireUserJwt && !userJwt) {
      return denialResponse(
        401,
        GATEWAY_DENIAL_MESSAGES.unauthorized,
        "authentication_error"
      );
    }
    if (userJwt) {
      headers["Authorization"] = `Bearer ${userJwt}`;
    }

    const init: RequestInit = {
      method: req.method,
      headers,
    };
    if (req.method !== "GET" && req.method !== "HEAD") {
      // Forward body verbatim (Next runtime gives us a stream).
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
};
