/**
 * Drop-in React components — thin renderers over the hooks + namespaces.
 * Apps that want richer UX can copy the component into their own codebase
 * and customise; the hooks are the stable surface.
 */

// Phase 5.1.1 (v0.2) — ALE + approvals + document review
export { ALEChat } from "./ALEChat";
export type { ALEChatProps } from "./ALEChat";

export { MemoryDrawer } from "./MemoryDrawer";
export type { MemoryDrawerProps } from "./MemoryDrawer";

export { DocumentReviewSplit } from "./DocumentReviewSplit";
export type {
  DocumentReviewSplitProps,
  DocumentReviewSchema,
  DocumentReviewSchemaProperty,
} from "./DocumentReviewSplit";

export { ApprovalCard } from "./ApprovalCard";
export type { ApprovalCardProps } from "./ApprovalCard";

// v0.3 (Phase 5.2) — Portal-SDK components
export { ErrorBoundary, type ErrorBoundaryProps } from "./ErrorBoundary";
export { LoginPage, type LoginPageProps } from "./LoginPage";
export { ChannelStatus, type ChannelStatusProps } from "./ChannelStatus";
export { ApprovalQueue, type ApprovalQueueProps } from "./ApprovalQueue";
export { FileUploader, type FileUploaderProps } from "./FileUploader";
export { WorkflowRunner, type WorkflowRunnerProps } from "./WorkflowRunner";
