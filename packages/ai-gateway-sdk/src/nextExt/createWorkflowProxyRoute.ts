/**
 * Factory for a Next.js App Router route that proxies workflow-run requests
 * from the browser to the gateway. Apps use this so the browser never sees
 * the channel API key.
 *
 * Example (apps/BAAC/app/api/workflows/[id]/run/route.ts):
 *   import { createWorkflowProxyRoute } from "@repo/ai-gateway-sdk/next";
 *   export const POST = createWorkflowProxyRoute({
 *     aiGatewayUrl: process.env.AI_GATEWAY_URL!,
 *     channelApiKey: process.env.CHANNEL_API_KEY!,
 *   });
 */

import { PromptServClient } from "../client";

export interface WorkflowProxyRouteConfig {
  aiGatewayUrl: string;
  channelApiKey: string;
  /** Optional request body transform / validation. */
  transformInput?: (body: unknown, req: Request) => unknown;
  /** Pick the workflow id from the URL. Default: last URL segment. */
  getWorkflowId?: (req: Request) => string;
}

export function createWorkflowProxyRoute(config: WorkflowProxyRouteConfig) {
  const client = new PromptServClient({
    aiGatewayUrl: config.aiGatewayUrl,
    auth: { kind: "channel", channelApiKey: config.channelApiKey },
  });

  return async (req: Request) => {
    try {
      const workflowId = config.getWorkflowId
        ? config.getWorkflowId(req)
        : new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";

      if (!workflowId) {
        return new Response("Missing workflow id", { status: 400 });
      }

      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      const input = config.transformInput ? config.transformInput(body, req) : body;

      const result = await client.workflows.run(workflowId, input as Record<string, unknown>);
      return Response.json(result);
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string; type?: string };
      return Response.json(
        { error: { message: e.message, type: e.type, code: e.code } },
        { status: e.code && e.code >= 400 && e.code < 600 ? e.code : 500 },
      );
    }
  };
}
