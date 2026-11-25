import { createWorkflowProxyRoute } from "@repo/ai-gateway-sdk/next";

import { clientOptions } from "@/lib/channel-config";

export const POST = createWorkflowProxyRoute({
  client: { ...clientOptions },
});
