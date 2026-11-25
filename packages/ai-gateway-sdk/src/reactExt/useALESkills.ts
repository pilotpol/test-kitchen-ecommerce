"use client";

import { useCallback, useEffect, useState } from "react";

import type { PromptServClient } from "../client";
import type {
  ALESkillSearchHit,
  ALESkillSummary,
} from "../typesExt/ale";

export interface UseALESkillsOptions {
  client: PromptServClient;
  /**
   * Initial query for the search list. When unset/empty the hook
   * lists the catalog (paged) instead of running a search.
   */
  initialQuery?: string;
  /** Page size for catalog list (default 50). */
  limit?: number;
  /** Top-K for search (default 5). */
  searchK?: number;
  enabled?: boolean;
}

/**
 * Skill catalog access — list + semantic search.
 *
 * Skills are *global* (not user-scoped); we still go through the JWT-
 * gated ``/v1/ale/skills*`` proxy to keep anonymous traffic out and
 * to centralise the auth header path.
 *
 * State machine:
 *   - ``query === ""``  → catalog mode (paged list)
 *   - ``query !== ""`` → search mode (top-K hits with similarity score)
 *
 * The two result shapes share enough fields that callers can render with
 * a single component; we expose them on separate properties so the
 * search-only ``similarity`` field stays typed.
 */
export function useALESkills({
  client,
  initialQuery = "",
  limit = 50,
  searchK = 5,
  enabled = true,
}: UseALESkillsOptions) {
  const [query, setQuery] = useState(initialQuery);
  const [skills, setSkills] = useState<ALESkillSummary[]>([]);
  const [hits, setHits] = useState<ALESkillSearchHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      if (query.trim()) {
        const res = await client.ale.skills.search(query.trim(), { k: searchK });
        setHits(res.results);
        setSkills([]);
      } else {
        const res = await client.ale.skills.list({ limit });
        setSkills(res.skills);
        setHits([]);
      }
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  }, [client, enabled, query, limit, searchK]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    query,
    setQuery,
    /** Catalog-mode results (empty array when in search mode). */
    skills,
    /** Search-mode results (empty array when in catalog mode). */
    hits,
    /** Convenience: union of both for UI rendering — search result first. */
    items: query.trim() ? hits : skills,
    isLoading,
    error,
    refresh,
  };
}
