/**
 * ALE Brain types — mirror the sidecar payload shapes returned by
 * `/v1/ale/*` proxy endpoints. Versioned alongside SDK v0.2.
 *
 * Keep these in sync with:
 *   - promptserv-ale-sidecar/memory_admin_api.py (memory)
 *   - promptserv-ale-sidecar/skill_admin_api.py (skills)
 *   - promptserv-ale-sidecar/scheduler_admin_api.py (scheduler)
 */

export interface ALEMemoryEntry {
  id: string;
  user_id: string;
  content: string;
  /** Comma-separated tags (sidecar normalises lowercase). */
  tags: string[];
  /** Optional: which conversation produced this entry. */
  session_id: string;
  /** Unix epoch seconds. */
  created_at: number;
}

export interface ALEMemoryListResponse {
  user_id: string;
  /** Number of entries in this page. */
  count: number;
  /** Total entries for the user (across all pages). */
  total: number;
  memories: ALEMemoryEntry[];
}

export interface ALEMemoryListOptions {
  /** 1..500 (default 100). */
  limit?: number;
  /** Page offset, default 0. */
  offset?: number;
}

/* -------------------------------------------------------------------- */
/* Skills                                                                */
/* -------------------------------------------------------------------- */

export interface ALESkillSummary {
  id: string;
  name: string;
  title: string;
  description: string;
  version: string;
  /** "seed" | "user" | "ale" — provenance of this skill row. */
  source: string;
  tags: string[];
  created_at: number;
  updated_at: number;
  warnings: string[];
}

export interface ALESkillFull extends ALESkillSummary {
  /** Markdown body of SKILL.md. */
  content: string;
}

export interface ALESkillListResponse {
  count: number;
  skills: ALESkillSummary[];
}

export interface ALESkillSearchHit {
  id: string;
  name: string;
  title: string;
  description: string;
  source: string;
  /** Cosine similarity vs query embedding (0..1) when semantic active. */
  similarity?: number;
}

export interface ALESkillSearchResponse {
  query: string;
  count: number;
  results: ALESkillSearchHit[];
}

/* -------------------------------------------------------------------- */
/* Scheduler                                                             */
/* -------------------------------------------------------------------- */

export interface ALEScheduledTask {
  id: string;
  user_id: string;
  /** Free-text description / prompt the LLM will receive on each run. */
  prompt: string;
  /** Cron expression (5 fields, sidecar accepts standard syntax). */
  cron: string;
  timezone: string;
  enabled: boolean;
  /** ISO 8601 UTC timestamp. */
  created_at: string;
  /** ISO 8601 UTC timestamp; null if never run. */
  last_run_at?: string | null;
  /** Optional channel target for proactive delivery (Phase 5). */
  channel_id?: string | null;
}

export interface ALEScheduledTaskListResponse {
  count: number;
  tasks: ALEScheduledTask[];
}

export interface ALECreateTaskInput {
  prompt: string;
  cron: string;
  /** IANA timezone name; defaults to sidecar's `ALE_SCHEDULER_DEFAULT_TZ`. */
  timezone?: string;
  /** Defaults true. */
  enabled?: boolean;
  /** Optional channel id to deliver result through (Phase 5). */
  channel_id?: string | null;
}

export interface ALEScheduledTaskRunResult {
  status: "ok" | "error";
  output?: string;
  error?: string;
  /** ISO 8601 UTC. */
  ran_at: string;
}
