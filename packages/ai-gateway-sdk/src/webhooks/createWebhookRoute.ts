import { verifyGenericHmac } from "./verifiers/generic";
import { verifyLineSignature } from "./verifiers/line";
import { verifyTelegramSignature } from "./verifiers/telegram";
import type { CreateWebhookRouteConfig, WebhookRequest } from "./types";

const DEFAULT_HEADERS: Record<CreateWebhookRouteConfig["channelType"], string> = {
  line: "x-line-signature",
  telegram: "x-telegram-bot-api-secret-token",
  generic: "x-signature",
};

/**
 * Next.js Route Handler factory for a verified inbound webhook.
 *
 * Usage (LINE example):
 * ```ts
 * // app/api/webhooks/line/route.ts
 * import { createWebhookRoute } from "@repo/ai-gateway-sdk/webhooks";
 * export const POST = createWebhookRoute({
 *   channelType: "line",
 *   secret: process.env.LINE_CHANNEL_SECRET!,
 *   onEvent: async ({ parsed }) => {
 *     // forward to gateway or dispatch a workflow
 *     return { status: 200, body: { ok: true } };
 *   },
 * });
 * ```
 *
 * Returns 401 on invalid signature, 400 on unparseable JSON.
 */
export function createWebhookRoute(config: CreateWebhookRouteConfig) {
  return async function POST(req: Request): Promise<Response> {
    const rawBody = await req.text();
    const headerName =
      config.signatureHeader?.toLowerCase() ??
      DEFAULT_HEADERS[config.channelType];
    const signatureHeader = req.headers.get(headerName);

    let valid = false;
    switch (config.channelType) {
      case "line":
        valid = verifyLineSignature({
          rawBody,
          signatureHeader,
          channelSecret: config.secret,
        });
        break;
      case "telegram":
        valid = verifyTelegramSignature({
          secretTokenHeader: signatureHeader,
          expectedSecretToken: config.secret,
        });
        break;
      case "generic":
        valid = verifyGenericHmac({
          rawBody,
          signatureHeader,
          secret: config.secret,
          algo: config.hmacAlgo,
          encoding: config.hmacEncoding,
          signaturePrefix: config.signaturePrefix,
        });
        break;
    }

    if (!valid) {
      if (config.onInvalid) return config.onInvalid(rawBody, req.headers);
      return Response.json({ error: "invalid_signature" }, { status: 401 });
    }

    let parsed: unknown = undefined;
    if (rawBody) {
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        return Response.json(
          { error: "invalid_json_body" },
          { status: 400 },
        );
      }
    }

    const webhookReq: WebhookRequest = {
      rawBody,
      parsed,
      headers: req.headers,
    };

    const result = await config.onEvent(webhookReq);
    if (result instanceof Response) return result;

    return new Response(
      result.body === undefined ? null : JSON.stringify(result.body),
      {
        status: result.status,
        headers: {
          "Content-Type": "application/json",
          ...(result.headers ?? {}),
        },
      },
    );
  };
}
