"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PromptServClient } from "../client";
import type {
  ALEMemoryEntry,
  ALEMemoryListOptions,
} from "../typesExt/ale";

export interface UseALEMemoryOptions extends ALEMemoryListOptions {
  client: PromptServClient;
  /**
   * Poll interval (ms). Default 0 (no polling — memory rarely changes
   * outside the user's own actions, so the explicit ``refresh()`` and
   * mutation-driven refetch are usually enough).
   */
  pollIntervalMs?: number;
  /** When false (default true), don't fetch on mount — caller controls. */
  enabled?: boolean;
}

/**
 * Read + delete the authenticated user's ALE memories.
 *
 * Pattern matches ``useApprovals`` — useState + useEffect, no TanStack
 * Query dependency. Total entry count is exposed alongside the page so
 * callers can render "X total" without a second request.
 *
 * Memory CREATE is intentionally NOT exposed here — writes flow through
 * the LLM tool path (``ale_save_memory``) during chat. See the
 * namespace docs for the rationale.
 */
export function useALEMemory({
  client,
  pollIntervalMs = 0,
  enabled = true,
  limit,
  offset,
}: UseALEMemoryOptions) {
  const [memories, setMemories] = useState<ALEMemoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      const res = await client.ale.memory.list({ limit, offset });
      setMemories(res.memories);
      setTotal(res.total);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  }, [client, enabled, limit, offset]);

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

  const remove = useCallback(
    async (id: string) => {
      await client.ale.memory.delete(id);
      // Optimistic local update — avoids waiting on a refetch round-trip.
      setMemories((prev) => prev.filter((m) => m.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    },
    [client],
  );

  return { memories, total, isLoading, error, refresh, remove };
}
