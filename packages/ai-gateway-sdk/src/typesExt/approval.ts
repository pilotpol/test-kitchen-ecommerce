/** HITL approval types aligned with internal/store/workflow_approvals.go. */

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface Approval {
  id: string;
  workflow_id: string;
  execution_id: string;
  node_id: string;
  status: ApprovalStatus;
  approver_type?: "specific" | "any_role" | "any_user";
  approver_target?: string;
  channel?: string;
  context_data?: Record<string, unknown>;
  decision_note?: string;
  decided_by?: string;
  decided_at?: string;
  created_at: string;
  expires_at?: string;
}

export interface ApprovalDecisionInput {
  decision: "approved" | "rejected";
  decided_by: string;
  note?: string;
}
