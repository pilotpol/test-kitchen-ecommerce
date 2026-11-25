"use client";

import { useCallback, useState } from "react";

import type { KbSearchQuery, KbSearchResponse } from "../typesExt/kb";

import { usePromptServClient } from "./PromptServClientProvider";

export interface UseKBResult {
  data: KbSearchResponse | null;
  loading: boolean;
  error: Error | null;
  search: (query: KbSearchQuery) => Promise<KbSearchResponse>;
  reset: () => void;
}

/**
 * Knowledge-base search hook. One-shot imperative `search()` call — most
 * KB UIs want explicit trigger (submit on enter / button) rather than
 * auto-fetch. Caller decides when to search.
 */
export function useKB(): UseKBResult {
  const client = usePromptServClient();
  const [data, setData] = useState<KbSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback(
    async (query: KbSearchQuery) => {
      setLoading(true);
      setError(null);
      try {
        const resp = await client.kb.search(query);
        setData(resp);
        return resp;
      } catch (e) {
        setError(e as Error);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [client],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, loading, error, search, reset };
}
