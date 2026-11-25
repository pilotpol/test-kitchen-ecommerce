/** Observability types aligned with internal/store/operation_events.go. */

export interface OperationEvent {
  id: string;
  trace_id: string;
  span_id: string;
  operation_type: string; // e.g. "llm", "vlm", "embedding", "workflow_node"
  agent_id?: string;
  user_id?: string;
  document_id?: string;
  workflow_run_id?: string;
  cost_usd?: number;
  latency_ms?: number;
  status_code?: number;
  provider?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  created_at: string;
}

export interface TraceDetail {
  trace_id: string;
  events: OperationEvent[];
  total_cost_usd: number;
  total_latency_ms: number;
  started_at: string;
  ended_at?: string;
}

export interface CostBreakdown {
  dimension: string; // e.g. "agent_id", "user_id", "document_id"
  items: Array<{
    key: string;
    total_cost_usd: number;
    total_events: number;
  }>;
}
