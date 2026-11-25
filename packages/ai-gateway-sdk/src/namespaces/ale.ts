/**
 * ALENamespace — first-class TS access to ALE Brain user-scoped APIs.
 *
 * Calls the gateway's `/v1/ale/*` proxy endpoints (Phase 5.1.1) which
 * extract `user_id` from the JWT sub claim and forward to the sidecar.
 * This means:
 *   - Memory operations are automatically scoped to the authenticated user
 *   - Tenant apps cannot spoof another user's id (proxy injects authoritatively)
 *   - Skill catalog reads are JWT-gated but global (skills are not user-scoped)
 *
 * Auth precondition: caller MUST configure `PromptServClient` with
 * `auth: { kind: "channel-user", channelApiKey, userJwt }` so both the
 * channel key + user JWT reach the gateway. Pure channel-mode (no JWT)
 * will get 401 from `/v1/ale/*` because user_id can't be derived.
 */

import { Transport } from "../transport";
import {
  ALECreateTaskInput,
  ALEMemoryEntry,
  ALEMemoryListOptions,
  ALEMemoryListResponse,
  ALEScheduledTask,
  ALEScheduledTaskListResponse,
  ALEScheduledTaskRunResult,
  ALESkillFull,
  ALESkillListResponse,
  ALESkillSearchResponse,
} from "../typesExt/ale";

class ALEMemorySubNamespace {
  constructor(private transport: Transport) {}

  /** List the authenticated user's memories, newest first. */
  async list(opts?: ALEMemoryListOptions): Promise<ALEMemoryListResponse> {
    return this.transport.request<ALEMemoryListResponse>({
      method: "GET",
      path: "/v1/ale/memory",
      query: {
        limit: opts?.limit,
        offset: opts?.offset,
      },
    });
  }

  /** Get a single memory entry. Returns 404 if not owned by the caller. */
  async get(id: string): Promise<ALEMemoryEntry> {
    return this.transport.request<ALEMemoryEntry>({
      method: "GET",
      path: `/v1/ale/memory/${encodeURIComponent(id)}`,
    });
  }

  /**
   * Delete a memory entry. Sidecar enforces ownership (404 if not owned —
   * intentional, no info leak about other users' ids).
   *
   * NOTE: there is no SDK method to *create* a memory entry. By design,
   * memory writes flow through the LLM tool path (`ale_save_memory`)
   * during chat — the LLM is the curator, callers don't write directly.
   * This preserves the Phase 1 product invariant.
   */
  async delete(id: string): Promise<{ status: string; id: string }> {
    return this.transport.request<{ status: string; id: string }>({
      method: "DELETE",
      path: `/v1/ale/memory/${encodeURIComponent(id)}`,
    });
  }
}

class ALESkillsSubNamespace {
  constructor(private transport: Transport) {}

  /** List skills (paged). */
  async list(opts?: { limit?: number; offset?: number; source?: string }): Promise<ALESkillListResponse> {
    return this.transport.request<ALESkillListResponse>({
      method: "GET",
      path: "/v1/ale/skills",
      query: opts,
    });
  }

  /** Semantic search over skills (k-NN via bge-m3). */
  async search(query: string, opts?: { k?: number }): Promise<ALESkillSearchResponse> {
    return this.transport.request<ALESkillSearchResponse>({
      method: "GET",
      path: "/v1/ale/skills/search",
      query: { q: query, k: opts?.k },
    });
  }

  /** Full skill row including markdown content. */
  async get(id: string): Promise<ALESkillFull> {
    return this.transport.request<ALESkillFull>({
      method: "GET",
      path: `/v1/ale/skills/${encodeURIComponent(id)}`,
    });
  }
}

class ALESchedulerSubNamespace {
  constructor(private transport: Transport) {}

  /** List the authenticated user's scheduled tasks. */
  async list(opts?: { enabled_only?: boolean; limit?: number }): Promise<ALEScheduledTaskListResponse> {
    return this.transport.request<ALEScheduledTaskListResponse>({
      method: "GET",
      path: "/v1/ale/scheduler/tasks",
      query: {
        enabled_only: opts?.enabled_only,
        limit: opts?.limit,
      },
    });
  }

  /** Get a single task. Returns 404 if not owned by the caller. */
  async get(id: string): Promise<ALEScheduledTask> {
    return this.transport.request<ALEScheduledTask>({
      method: "GET",
      path: `/v1/ale/scheduler/tasks/${encodeURIComponent(id)}`,
    });
  }

  /** Create a scheduled task; user_id auto-injected from JWT. */
  async create(input: ALECreateTaskInput): Promise<ALEScheduledTask> {
    return this.transport.request<ALEScheduledTask>({
      method: "POST",
      path: "/v1/ale/scheduler/tasks",
      body: input,
    });
  }

  /** Partial update — pass only the fields to change. */
  async update(id: string, patch: Partial<ALECreateTaskInput>): Promise<ALEScheduledTask> {
    return this.transport.request<ALEScheduledTask>({
      method: "PATCH",
      path: `/v1/ale/scheduler/tasks/${encodeURIComponent(id)}`,
      body: patch,
    });
  }

  async delete(id: string): Promise<{ status: string; id: string }> {
    return this.transport.request<{ status: string; id: string }>({
      method: "DELETE",
      path: `/v1/ale/scheduler/tasks/${encodeURIComponent(id)}`,
    });
  }

  /** Manually trigger one run of the task right now. */
  async run(id: string): Promise<ALEScheduledTaskRunResult> {
    return this.transport.request<ALEScheduledTaskRunResult>({
      method: "POST",
      path: `/v1/ale/scheduler/tasks/${encodeURIComponent(id)}/run`,
    });
  }

  /** Run history from the audit log (most recent first). */
  async runs(id: string, opts?: { limit?: number }): Promise<ALEScheduledTaskRunResult[]> {
    return this.transport.request<ALEScheduledTaskRunResult[]>({
      method: "GET",
      path: `/v1/ale/scheduler/tasks/${encodeURIComponent(id)}/runs`,
      query: { limit: opts?.limit },
    });
  }
}

export class ALENamespace {
  public memory: ALEMemorySubNamespace;
  public skills: ALESkillsSubNamespace;
  public scheduler: ALESchedulerSubNamespace;

  constructor(transport: Transport) {
    this.memory = new ALEMemorySubNamespace(transport);
    this.skills = new ALESkillsSubNamespace(transport);
    this.scheduler = new ALESchedulerSubNamespace(transport);
  }
}
