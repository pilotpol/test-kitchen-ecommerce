"use client";

import React, { useState } from "react";

import type {
  Approval,
  ApprovalDecisionInput,
} from "../typesExt/approval";

export interface ApprovalCardProps {
  approval: Approval;
  /**
   * The current user's identifier (Keycloak sub / email). Stamped into
   * the decision payload's ``decided_by`` field. Apps usually pass the
   * value from ``useAuth().user.email``.
   */
  approver: string;
  /**
   * Decision callback. Should call ``client.approvals.decide(id, input)``.
   * The card waits on the returned promise and shows a busy state.
   */
  onDecide: (id: string, input: ApprovalDecisionInput) => Promise<void> | void;
  /** Tailwind classes appended to the root element. */
  className?: string;
  /** Hide the per-row "Show context" toggle. Default: shown. */
  hideContext?: boolean;
}

/**
 * Single-card visualizer for an HITL workflow approval.
 *
 * Used by FPO UC4 (reimbursement approval) and any tenant app with an
 * approval inbox. Reuses ``Approval`` type from SDK v0.1; pairs naturally
 * with the existing ``useApprovals`` hook (which exposes ``decide``).
 *
 * UX:
 *   - Status badge (color-coded: pending=amber, approved=green, ...)
 *   - Workflow + execution ids visible for traceability
 *   - Optional context_data preview (collapsed by default)
 *   - Approve / Reject buttons (only when status === "pending")
 *   - Note input shown after Reject is clicked, required for submission
 */
export function ApprovalCard({
  approval,
  approver,
  onDecide,
  className = "",
  hideContext = false,
}: ApprovalCardProps) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [note, setNote] = useState("");
  const [showContext, setShowContext] = useState(false);

  const statusColor =
    approval.status === "pending"
      ? "bg-amber-100 text-amber-800"
      : approval.status === "approved"
        ? "bg-green-100 text-green-800"
        : approval.status === "rejected"
          ? "bg-red-100 text-red-800"
          : "bg-gray-100 text-gray-700";

  const decide = async (decision: "approved" | "rejected") => {
    setBusy(decision === "approved" ? "approve" : "reject");
    try {
      await onDecide(approval.id, {
        decision,
        decided_by: approver,
        note: decision === "rejected" ? note.trim() : undefined,
      });
      setShowReject(false);
      setNote("");
    } finally {
      setBusy(null);
    }
  };

  return (
    <article
      className={`rounded-lg border border-gray-200 bg-white p-3 shadow-sm ${className}`}
    >
      <header className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">
            Workflow: <span className="font-mono">{approval.workflow_id}</span>
          </p>
          <p className="text-xs text-gray-400">
            Execution: <span className="font-mono">{approval.execution_id}</span>
            {" · "}node: <span className="font-mono">{approval.node_id}</span>
          </p>
        </div>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColor}`}>
          {approval.status}
        </span>
      </header>

      <div className="space-y-1 text-xs text-gray-600">
        <p>Created: {new Date(approval.created_at).toLocaleString()}</p>
        {approval.expires_at && (
          <p>Expires: {new Date(approval.expires_at).toLocaleString()}</p>
        )}
        {approval.decided_by && (
          <p>
            Decided by <span className="font-medium">{approval.decided_by}</span>
            {approval.decided_at && (
              <> at {new Date(approval.decided_at).toLocaleString()}</>
            )}
          </p>
        )}
        {approval.decision_note && (
          <p className="rounded bg-gray-50 p-2 text-gray-700">
            Note: {approval.decision_note}
          </p>
        )}
      </div>

      {!hideContext && approval.context_data && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowContext((s) => !s)}
            className="text-xs text-blue-600 hover:underline"
          >
            {showContext ? "Hide" : "Show"} context
          </button>
          {showContext && (
            <pre className="mt-1 max-h-48 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
              {JSON.stringify(approval.context_data, null, 2)}
            </pre>
          )}
        </div>
      )}

      {approval.status === "pending" && (
        <div className="mt-3 space-y-2">
          {showReject && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason for rejection (optional)"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              rows={2}
            />
          )}
          <div className="flex justify-end gap-2">
            {!showReject && (
              <button
                type="button"
                onClick={() => setShowReject(true)}
                disabled={busy !== null}
                className="rounded bg-red-50 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Reject
              </button>
            )}
            {showReject && (
              <button
                type="button"
                onClick={() => decide("rejected")}
                disabled={busy !== null}
                className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {busy === "reject" ? "Rejecting..." : "Confirm reject"}
              </button>
            )}
            <button
              type="button"
              onClick={() => decide("approved")}
              disabled={busy !== null}
              className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              {busy === "approve" ? "Approving..." : "Approve"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
