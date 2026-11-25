/*
 * @repo/adk - the PromptServe Agent Development Kit.
 *
 * What an application built on the platform uses to make the platform's own
 * objects: agents, workflows, knowledge-base folders, skills and MCP server
 * registrations. It is deliberately thin. Every call is one request to a
 * portal-service route the Portal itself already uses, with the signed-in
 * person's access token, so:
 *
 *   - the person can do through an app exactly what they can do on the
 *     Portal screens, and nothing more (role checks and tenant guards are the
 *     server's, not this file's);
 *   - the objects an app creates show up on the Portal screens like any
 *     other, and can be edited or removed there;
 *   - there is no second copy of the rules to drift.
 *
 * Chat, streaming and running a workflow from an app are the SDK's job
 * (@repo/ai-gateway-sdk). This kit is for building, not for answering.
 *
 * Server-side only in practice: the access token comes from the app's own
 * session cookie (auth-bff), which a browser script cannot read.
 */

export interface AdkOptions {
  /** portal-service base URL as the app's server reaches it, e.g. process.env.PORTAL_API_URL. */
  portalApiUrl: string;
  /** The signed-in person's Keycloak access token. */
  accessToken: string;
  /** Injected for tests; defaults to the global fetch. */
  fetch?: typeof fetch;
}

/** A failed call, with the server's own words when it sent any. */
export class AdkError extends Error {
  readonly status: number;
  readonly body: string;
  constructor(status: number, body: string, path: string) {
    super(`PromptServe ADK: ${path} answered ${status}${body ? `: ${body.slice(0, 300)}` : ''}`);
    this.name = 'AdkError';
    this.status = status;
    this.body = body;
  }
}

/* ---------------- shapes (the fields an app needs; the server sends more) ---------------- */

export interface Agent {
  id: string;
  name: string;
  display_name?: string;
  description?: string;
  system_prompt?: string;
  tenant_ids?: string[];
  [key: string]: unknown;
}

export interface CreateAgentInput {
  name: string;
  display_name?: string;
  description: string;
  system_prompt: string;
  persona?: string;
  avatar_url?: string;
  /** The virtual key that decides which model answers. */
  virtual_key_id: string;
  max_iterations?: number;
  allowed_tools?: string[];
  mcp_server_ids?: string[];
  tenant_ids?: string[];
}

export type UpdateAgentInput = Partial<Omit<CreateAgentInput, 'name'>> & { name?: string; change_note?: string };

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  status?: string;
  [key: string]: unknown;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  icon?: string;
  tenant_ids?: string[];
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  status?: string;
  /** The graph, in the shape the Portal's workflow editor saves. */
  flowDefinition?: unknown;
  changeNote?: string;
  tenant_ids?: string[];
}

export interface KnowledgeBaseFolder {
  name: string;
  displayName?: string;
  [key: string]: unknown;
}

export interface CreateKnowledgeBaseInput {
  /** Folder (bucket) name: lowercase letters, digits and hyphens. */
  name: string;
  displayName?: string;
  tenantIds?: string[];
}

export interface Skill {
  id: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

export interface CreateSkillInput {
  name: string;
  description?: string;
  type?: string;
  content?: string;
  metadata?: string;
  tenant_ids?: string[];
}

export interface McpServer {
  id: string;
  name: string;
  url?: string;
  status?: string;
  [key: string]: unknown;
}

export interface CreateMcpServerInput {
  name: string;
  display_name?: string;
  url: string;
  /** Sent to the server once and stored encrypted by the platform. */
  auth_key?: string;
  transport?: 'sse' | 'streamable-http';
}

/* ---------------- the client ---------------- */

export function createAdk(options: AdkOptions) {
  const base = String(options.portalApiUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('PromptServe ADK: portalApiUrl is required (set PORTAL_API_URL)');
  if (!options.accessToken) throw new Error('PromptServe ADK: accessToken is required (the signed-in person\'s token)');
  const doFetch = options.fetch ?? fetch;

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await doFetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new AdkError(res.status, text, path);
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  /** Lists come back either bare or wrapped in {items}/{data}; an app should not care which. */
  const listOf = <T>(value: unknown): T[] => {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === 'object') {
      const v = value as { items?: unknown; data?: unknown };
      if (Array.isArray(v.items)) return v.items as T[];
      if (Array.isArray(v.data)) return v.data as T[];
    }
    return [];
  };

  const id = (value: string) => encodeURIComponent(value);

  return {
    agents: {
      list: async () => listOf<Agent>(await call('GET', '/api/v1/agents')),
      get: (agentId: string) => call<Agent>('GET', `/api/v1/agents/${id(agentId)}`),
      create: (input: CreateAgentInput) =>
        call<Agent>('POST', '/api/v1/agents', { max_iterations: 10, avatar_url: '', persona: '', ...input }),
      update: (agentId: string, input: UpdateAgentInput) => call<Agent>('PUT', `/api/v1/agents/${id(agentId)}`, input),
      remove: (agentId: string) => call<void>('DELETE', `/api/v1/agents/${id(agentId)}`),
      /** Give an agent a knowledge-base folder to search. */
      bindKnowledgeBase: (agentId: string, kbId: string, kbType = 'folder') =>
        call<unknown>('POST', `/api/v1/agents/${id(agentId)}/kb-bindings`, { kb_id: kbId, kb_type: kbType }),
      bindSkill: (agentId: string, skillId: string) =>
        call<unknown>('POST', `/api/v1/agents/${id(agentId)}/skill-bindings`, { skill_id: skillId }),
    },
    workflows: {
      list: async () => listOf<Workflow>(await call('GET', '/api/v1/workflows')),
      get: (workflowId: string) => call<Workflow>('GET', `/api/v1/workflows/${id(workflowId)}`),
      create: (input: CreateWorkflowInput) => call<Workflow>('POST', '/api/v1/workflows', input),
      update: (workflowId: string, input: UpdateWorkflowInput) =>
        call<Workflow>('PUT', `/api/v1/workflows/${id(workflowId)}`, input),
      remove: (workflowId: string) => call<void>('DELETE', `/api/v1/workflows/${id(workflowId)}`),
      /** Start a run. Results arrive the way the workflow's own nodes deliver them. */
      run: (workflowId: string, input: Record<string, unknown> = {}) =>
        call<unknown>('POST', `/api/v1/workflows/${id(workflowId)}/run`, input),
    },
    knowledgeBases: {
      list: async () => listOf<KnowledgeBaseFolder>(await call('GET', '/api/storage/buckets')),
      create: (input: CreateKnowledgeBaseInput) => call<KnowledgeBaseFolder>('POST', '/api/storage/buckets', input),
      remove: (name: string) => call<void>('DELETE', `/api/storage/buckets/${id(name)}`),
    },
    skills: {
      list: async () => listOf<Skill>(await call('GET', '/api/v1/skills')),
      get: (skillId: string) => call<Skill>('GET', `/api/v1/skills/${id(skillId)}`),
      create: (input: CreateSkillInput) => call<Skill>('POST', '/api/v1/skills', input),
      update: (skillId: string, input: Partial<CreateSkillInput> & { is_active?: boolean }) =>
        call<Skill>('PUT', `/api/v1/skills/${id(skillId)}`, input),
      remove: (skillId: string) => call<void>('DELETE', `/api/v1/skills/${id(skillId)}`),
    },
    mcpServers: {
      list: async () => listOf<McpServer>(await call('GET', '/api/v1/mcp-servers')),
      get: (serverId: string) => call<McpServer>('GET', `/api/v1/mcp-servers/${id(serverId)}`),
      create: (input: CreateMcpServerInput) => call<McpServer>('POST', '/api/v1/mcp-servers', input),
      remove: (serverId: string) => call<void>('DELETE', `/api/v1/mcp-servers/${id(serverId)}`),
      /** Ask the server which tools it offers, so agents can be given them. */
      discover: (serverId: string) => call<unknown>('POST', `/api/v1/mcp-servers/${id(serverId)}/discover`),
    },
  };
}

export type Adk = ReturnType<typeof createAdk>;
