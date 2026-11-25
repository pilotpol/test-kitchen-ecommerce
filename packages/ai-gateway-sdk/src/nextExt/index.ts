export { createWorkflowProxyRoute } from "./createWorkflowProxyRoute";
export type { WorkflowProxyRouteConfig } from "./createWorkflowProxyRoute";

// Re-export legacy Next.js route factory for chat completions
export {
  createPromptServRoute,
  denialResponse,
  denialFromGatewayStatus,
  GATEWAY_DENIAL_MESSAGES,
} from "../server";
export type { PromptServRouteConfig } from "../server";
