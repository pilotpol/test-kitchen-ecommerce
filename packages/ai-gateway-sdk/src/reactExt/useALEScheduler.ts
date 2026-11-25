"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PromptServClient } from "../client";
import type {
  ALECreateTaskInput,
  ALEScheduledTask,
} from "../typesExt/ale";

export interface UseALESchedulerOptions {
  client: PromptServClient;
  /** Filter to enabled-only tasks. Default false (show all). */
  enabledOnly?: boolean;
  /** Page size (default 100). */
  limit?: number;
  /** Poll interval (ms). Default 0 (disabled). */
  pollIntervalMs?: number;
  enabled?: boolean;
}

/**
 * CRUD for the authenticated user's scheduled tasks.
 *
 * Auto-refresh policy: optimistic local updates after each mutation,
 * plus optional poll for ``last_run_at`` freshness when a long-running
 * UI is open. Most callers won't need polling — set ``pollIntervalMs``
 * only when displaying live "next run" countdowns.
 */
export function useALEScheduler({
  client,
  enabledOnly = false,
  limit = 100,
  pollIntervalMs = 0,
  enabled = true,
}: UseALESchedulerOptions) {
  const [tasks, setTasks] = useState<ALEScheduledTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      const res = await client.ale.scheduler.list({
        enabled_only: enabledOnly,
        limit,
      });
      setTasks(res.tasks);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  }, [client, enabled, enabledOnly, limit]);

  useEffect(() => {
    refresh();
    if (pollIntervalMs > 0) {
      const tick = () => {
        refresh();
        timerRef.current = setTimeout(tick, pollIntervalMs);
      };
      timerRef.current = setTimeout(tick, pollIntervalMs);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [refresh, pollIntervalMs]);

  const create = useCallback(
    async (input: ALECreateTaskInput) => {
      const created = await client.ale.scheduler.create(input);
      setTasks((prev) => [created, ...prev]);
      return created;
    },
    [client],
  );

  const update = useCallback(
    async (id: string, patch: Partial<ALECreateTaskInput>) => {
      const updated = await client.ale.scheduler.update(id, patch);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      return updated;
    },
    [client],
  );

  const remove = useCallback(
    async (id: string) => {
      await client.ale.scheduler.delete(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    },
    [client],
  );

  const runNow = useCallback(
    async (id: string) => {
      const result = await client.ale.scheduler.run(id);
      // Refresh after a manual run so last_run_at + status reflect reality.
      void refresh();
      return result;
    },
    [client, refresh],
  );

  return { tasks, isLoading, error, refresh, create, update, remove, runNow };
}
