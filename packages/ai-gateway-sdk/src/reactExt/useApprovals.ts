"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PromptServClient } from "../client";
import type { Approval, ApprovalDecisionInput } from "../typesExt/approval";

export interface UseApprovalsOptions {
  client: PromptServClient;
  approver?: string;
  /** Poll interval (ms). Default 10_000. Pass 0 to disable. */
  pollIntervalMs?: number;
  /** Only return approvals with this status (default "pending"). */
  status?: "pending" | "approved" | "rejected" | "expired";
}

export function useApprovals({
  client,
  approver,
  pollIntervalMs = 10_000,
  status = "pending",
}: UseApprovalsOptions) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchList = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await client.approvals.list({ approver, status });
      setApprovals(list);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  }, [client, approver, status]);

  useEffect(() => {
    fetchList();
    if (pollIntervalMs > 0) {
      const tick = () => {
        fetchList();
        timerRef.current = setTimeout(tick, pollIntervalMs);
      };
      timerRef.current = setTimeout(tick, pollIntervalMs);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchList, pollIntervalMs]);

  const decide = useCallback(
    async (id: string, input: ApprovalDecisionInput) => {
      const updated = await client.approvals.decide(id, input);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
      return updated;
    },
    [client],
  );

  return { approvals, isLoading, error, refresh: fetchList, decide };
}
