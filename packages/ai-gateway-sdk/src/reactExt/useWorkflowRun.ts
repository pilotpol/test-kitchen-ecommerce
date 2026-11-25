"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PromptServClient } from "../client";
import type {
  RunWorkflowInput,
  WorkflowExecution,
  WorkflowExecutionStatus,
} from "../typesExt/workflow";

export interface UseWorkflowRunOptions {
  client: PromptServClient;
  workflowId: string;
  /** Poll interval in ms (default 3000). */
  pollIntervalMs?: number;
  /** Stop polling when terminal status reached (default true). */
  stopOnTerminal?: boolean;
}

const TERMINAL: WorkflowExecutionStatus[] = ["completed", "failed", "cancelled"];

export function useWorkflowRun({
  client,
  workflowId,
  pollIntervalMs = 3000,
  stopOnTerminal = true,
}: UseWorkflowRunOptions) {
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPoll = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const poll = useCallback(
    async (executionId: string) => {
      try {
        const ex = await client.workflows.getExecution(executionId);
        setExecution(ex);
        if (stopOnTerminal && TERMINAL.includes(ex.status)) {
          setIsRunning(false);
          return;
        }
        timerRef.current = setTimeout(() => poll(executionId), pollIntervalMs);
      } catch (e) {
        setError(e as Error);
        setIsRunning(false);
      }
    },
    [client, pollIntervalMs, stopOnTerminal],
  );

  const start = useCallback(
    async (input: RunWorkflowInput = {}) => {
      setError(null);
      setIsRunning(true);
      try {
        const result = await client.workflows.run(workflowId, input);
        setExecution({
          id: result.execution_id,
          workflow_id: workflowId,
          status: result.status,
        });
        timerRef.current = setTimeout(() => poll(result.execution_id), pollIntervalMs);
        return result;
      } catch (e) {
        setError(e as Error);
        setIsRunning(false);
        throw e;
      }
    },
    [client, workflowId, pollIntervalMs, poll],
  );

  const cancel = useCallback(async () => {
    if (!execution) return;
    await client.workflows.cancelExecution(execution.id);
    clearPoll();
    setIsRunning(false);
  }, [client, execution]);

  useEffect(() => () => clearPoll(), []);

  return { execution, error, isRunning, start, cancel };
}
