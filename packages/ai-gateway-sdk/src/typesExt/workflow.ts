/** Workflow types aligned with internal/store/workflows.go. */

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  graph_data: Record<string, unknown>; // DAG JSON
  is_template?: boolean;
  is_system?: boolean;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export type WorkflowExecutionStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  status: WorkflowExecutionStatus;
  input_data?: Record<string, unknown>;
  output_data?: Record<string, unknown>;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  trace_id?: string;
  document_id?: string; // correlates with operation_events.document_id
}

export interface RunWorkflowInput {
  input?: Record<string, unknown>;
  async?: boolean;
  trace_id?: string;
  document_id?: string;
}

export interface RunWorkflowResult {
  execution_id: string;
  status: WorkflowExecutionStatus;
}
