// Legacy exports (kept for backward compat — do not break FPO/SPW/prompt-chat)
// NOTE: server-only modules (./server, ./webhooks) are NOT re-exported here —
// they pull in node:crypto / node-runtime deps and would break client bundles.
// Import them via subpaths: "@repo/ai-gateway-sdk/server", "@repo/ai-gateway-sdk/webhooks".
export * from "./react";
export * from "./streaming";
export * from "./types";
export * from "./hooks";

// New v0.1 unified client + namespaces
export { PromptServClient } from "./client";
export type { PromptServClientOptions } from "./client";
export type { AuthStrategy } from "./auth";
export * from "./errors";

// Structured types (namespaced to avoid collision with legacy chat API types)
export * as types from "./typesExt";

// Direct namespace classes (rarely used; prefer the client instance)
export { WorkflowsNamespace } from "./namespaces/workflows";
export { ApprovalsNamespace } from "./namespaces/approvals";
export { ChannelsNamespace } from "./namespaces/channels";
export { FilesNamespace } from "./namespaces/files";
export { KbNamespace } from "./namespaces/kb";
export { OcrNamespace } from "./namespaces/ocr";
export { TracesNamespace } from "./namespaces/traces";
export { ChatNamespace } from "./namespaces/chat";
export { SystemOneNamespace } from "./namespaces/systemone";
export type {
  SystemOneQuestion,
  SystemOneAnswer,
  SystemOneRequest,
  SystemOneResponse,
  SystemOneTarget,
  ChoiceQuestion,
  ScoreQuestion,
  NoulQuestion,
  ChoiceAnswer,
  ScoreAnswer,
  NoulAnswer,
} from "./namespaces/systemone";

// v0.3 (Phase 5.2) — Portal-SDK additions
export * as auth from "./auth/keycloak";
export * as config from "./config";
