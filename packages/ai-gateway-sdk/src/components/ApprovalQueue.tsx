"use client";

import React from "react";

import { usePromptServClient } from "../reactExt/PromptServClientProvider";
import { useApprovals } from "../reactExt/useApprovals";
import type { ApprovalDecisionInput } from "../typesExt/approval";

import { ApprovalCard } from "./ApprovalCard";

export interface ApprovalQueueProps {
  approver: string;
  className?: string;
  status?: "pending" | "approved" | "rejected" | "expired";
  pollIntervalMs?: number;
  emptyMessage?: string;
}

/**
 * Full-list view of HITL approvals with polling + inline decide.
 * Composes `useApprovals` + `<ApprovalCard/>` — use this when you want
 * a plug-and-play inbox; drop down to the hook for custom layouts.
 */
export const ApprovalQueue: React.FC<ApprovalQueueProps> = ({
  approver,
  className = "",
  status = "pending",
  pollIntervalMs = 10_000,
  emptyMessage = "No approvals waiting.",
}) => {
  const client = usePromptServClient();
  const { approvals, isLoading, error, decide } = useApprovals({
    client,
    approver,
    status,
    pollIntervalMs,
  });

  return (
    <section className={`space-y-3 ${className}`}>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error.message}
        </div>
      )}
      {!isLoading && approvals.length === 0 && (
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      )}
      {approvals.map((a) => (
        <ApprovalCard
          key={a.id}
          approval={a}
          approver={approver}
          onDecide={async (id, input: ApprovalDecisionInput) => {
            await decide(id, input);
          }}
        />
      ))}
    </section>
  );
};
