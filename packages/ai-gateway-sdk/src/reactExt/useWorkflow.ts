"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  RunWorkflowInput,
  RunWorkflowResult,
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowExecutionStatus,
} from "../typesExt/workflow";

import { usePromptServClient } from "./PromptServClientProvider";

export interface UseWorkflowOptions {
  workflowId: string;
  pollIntervalMs?: number;
  stopOnTerminal?: boolean;
}

export interface UseWorkflowResult {
  definition: WorkflowDefinition | null;
  lastRun: WorkflowExecution | null;
  isRunning: boolean;
  error: Error | null;
  run: (input?: RunWorkflowInput) => Promise<RunWorkflowResult>;
  cancel: () => Promise<void>;
}

const TERMINAL: WorkflowExecutionStatus[] = ["completed", "failed", "cancelled"];

/**
 * Higher-level workflow hook: loads definition, runs with polling, and
 * exposes lastRun. Composes what `useWorkflowRun` does but pulls the
 * client from context + loads the definition eagerly.
 */
export function useWorkflow(opts: UseWorkflowOptions): UseWorkflowResult {
  const client = usePromptServClient();
  const pollIntervalMs = opts.pollIntervalMs ?? 3000;
  const stopOnTerminal = opts.stopOnTerminal ?? true;

  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);
  const [lastRun, setLastRun] = useState<WorkflowExecution | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPoll = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const def = await client.workflows.get(opts.workflowId);
        if (!cancelled) setDefinition(def);
      } catch (e) {
        if (!cancelled) setError(e as Error);
      }
    })();
    return () => {
      cancelled = true;
      clearPoll();
    };
  }, [client, opts.workflowId]);

  const poll = useCallback(
    async (executionId: string) => {
      try {
        const ex = await client.workflows.getExecution(executionId);
        setLastRun(ex);
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

  const run = useCallback(
    async (input: RunWorkflowInput = {}) => {
      setError(null);
      setIsRunning(true);
      try {
        const result = await client.workflows.run(opts.workflowId, input);
        setLastRun({
          id: result.execution_id,
          workflow_id: opts.workflowId,
          status: result.status,
        });
        timerRef.current = setTimeout(
          () => poll(result.execution_id),
          pollIntervalMs,
        );
        return result;
      } catch (e) {
        setError(e as Error);
        setIsRunning(false);
        throw e;
      }
    },
    [client, opts.workflowId, pollIntervalMs, poll],
  );

  const cancel = useCallback(async () => {
    if (!lastRun) return;
    await client.workflows.cancelExecution(lastRun.id);
    clearPoll();
    setIsRunning(false);
  }, [client, lastRun]);

  return { definition, lastRun, isRunning, error, run, cancel };
}
