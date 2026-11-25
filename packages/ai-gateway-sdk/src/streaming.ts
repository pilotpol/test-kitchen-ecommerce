import type { SendMessagePayload } from './types';

/**
 * SSE Streaming client for PromptServ Chat BFF
 *
 * Uses fetch() POST to /api/chat (Go BFF) and consumes named SSE events:
 *   - event:delta    — text token chunk
 *   - event:step     — agent tool_call / thinking step
 *   - event:artifact — HTML canvas content
 *   - event:done     — stream complete
 */

/** SSE delta event (text token) */
export interface DeltaEvent {
  content: string;
}

/** SSE step event (agent tool call) */
export interface StepEvent {
  title: string;
  status: 'thinking' | 'running' | 'done' | 'error' | 'pending_approval';
  detail?: string;
  durationMs?: number;
  args?: string;        // tool arguments JSON
  output?: string;      // tool result preview (truncated)
  toolName?: string;    // raw function name
  icon?: string;        // emoji icon
}

/** SSE thinking event (LLM processing phase) */
export interface ThinkingEvent {
  status: 'thinking' | 'tool_planning';
  detail: string;
}

/** SSE artifact event (HTML canvas) */
export interface ArtifactEvent {
  html: string;
  title?: string;
  type?: string;
}

/** SSE approval_request event (HITL) */
export interface ApprovalRequestEvent {
  plan_id: string;
  plan: string;
  reason?: string;
  actions: { tool: string; detail: string; risk: string }[];
  risk_level: 'low' | 'medium' | 'high';
  timeout_seconds?: number;
}

/** SSE approval_result event (HITL) */
export interface ApprovalResultEvent {
  plan_id: string;
  decision: 'approve' | 'reject';
}

/** SSE sources event (RAG citation metadata) */
export interface SourcesEvent {
  sources: {
    index: number;
    title: string;
    snippet: string;
    source: 'org' | 'personal';
    score: number;
  }[];
}

/** SSE agent_handoff event (multi-agent orchestration) */
export interface AgentHandoffEvent {
  from_agent: string;
  to_agent: string;
  reason: string;
  task_id: string;
}

/**
 * Verdict of the citation support check on one cited chunk:
 *   - supports       the chunk supports the sentence that cites it
 *   - partial        it supports part of the sentence
 *   - says_nothing   it does not address the sentence
 *   - contradicts    it says the opposite
 *   - not_retrieved  the anchor names a chunk the search never returned
 *                    (decided without a model call)
 * A newer gateway may add verdicts; treat an unknown one as needing review.
 */
export type CitationVerdict =
  | 'supports'
  | 'partial'
  | 'says_nothing'
  | 'contradicts'
  | 'not_retrieved';

/** One checked citation in the SSE citation_check event, as the gateway sends it. */
export interface CitationCheckItem {
  /** The anchor as written in the answer, without the `[ref:` prefix and the
   *  closing bracket: `<file_id>#<chunk>:p<page>`. */
  ref: string;
  /** The sentence the anchor is attached to. */
  claim: string;
  /** Empty when the check call failed for this item (`error` says why);
   *  show nothing for those. */
  verdict: CitationVerdict | '';
  /** 0 to 1, from the decision model. 0 for not_retrieved, which needs no call. */
  confidence: number;
  /** True for anything short of confident full support. */
  needs_review: boolean;
  /** Thai label for the verdict, ready to display. Empty when verdict is empty. */
  label: string;
  /** Title of the cited document, when its chunk was retrieved. */
  title?: string;
  /** Why the check call failed, when verdict is empty. */
  error?: string;
}

/** SSE citation_check event: whether each cited knowledge-base chunk supports
 *  the sentence that cites it, as judged by a System One decision model. */
export interface CitationCheck {
  /** Thai summary line, e.g. "ตรวจสอบการอ้างอิง 4 รายการ: สอดคล้องกับเอกสาร 3,
   *  เอกสารไม่ได้กล่าวถึง 1". */
  summary: string;
  /** One item per checked (anchor, sentence) pair, in the order of the answer. */
  checks: CitationCheckItem[];
  /** Items per verdict. Items whose check call failed are not counted. */
  counts: Partial<Record<CitationVerdict, number>>;
  /** Decision model that produced the verdicts. */
  model?: string;
  /** Time the check took, in milliseconds. */
  latency_ms?: number;
  /** Confidence below which a `supports` verdict still needs review. */
  review_threshold?: number;
}

/** Callbacks for SSE stream lifecycle */
export interface StreamCallbacks {
  /** Called with each text token chunk */
  onDelta: (event: DeltaEvent) => void;
  /** Called when an agent step is reported */
  onStep: (event: StepEvent) => void;
  /** Called when LLM is thinking (before tool detection) */
  onThinking: (event: ThinkingEvent) => void;
  /** Called when an artifact (HTML canvas) is emitted */
  onArtifact: (event: ArtifactEvent) => void;
  /** Called when approval is requested (HITL) */
  onApprovalRequest?: (event: ApprovalRequestEvent) => void;
  /** Called when approval result is received */
  onApprovalResult?: (event: ApprovalResultEvent) => void;
  /** Called when RAG sources are available for citation display */
  onSources?: (event: SourcesEvent) => void;
  /** Called when agent handoff occurs (multi-agent orchestration) */
  onAgentHandoff?: (event: AgentHandoffEvent) => void;
  /** The citation guard could not match something the answer cited against
   *  what the search returned. Fires at most once per turn, after the last
   *  delta, so the message is attached to the finished answer rather than
   *  interrupting it. Silent unless the gateway runs CITATION_GUARD_MODE=warn. */
  onCitationWarning?: (message: string) => void;
  /**
   * The turn paused on an approval. This stream is over; the turn is not.
   *
   * Distinct from an approval that arrives mid-stream and is answered on the
   * same connection: nothing further comes down this one. When somebody
   * decides the approval the run continues server-side from where it stopped,
   * and its answer lands on an agent execution - so an app that wants to show
   * the result has to fetch it, or have the gateway deliver it (set
   * resume_callback_url on the channel).
   *
   * An app that leaves this unhandled shows a spinner until the user gives up.
   */
  onRunSuspended?: (params: {
    approvalId: string;
    toolName: string;
    suspendedRunId: string;
    message: string;
  }) => void;
  /** Whether each cited knowledge-base chunk supports the sentence that cites
   *  it, per [ref:...] anchor, as judged by a System One decision model.
   *  Fires at most once per turn, after the last delta and before completion
   *  (after onCitationWarning when both fire). Silent unless the gateway runs
   *  CITATION_SUPPORT_CHECK=on. */
  onCitationCheck?: (check: CitationCheck) => void;
  /** Called when stream completes successfully */
  onComplete: () => void;
  /** Called when an error occurs */
  onError: (error: Error) => void;
}

export interface BFFChatPayload {
  message: string;
  model: string;
  conversation_id?: string;
  parent_message_id?: string;
  skill_ids?: string[];
  file_ids?: string[];
  is_continued?: boolean;
  /** A2UI session ID — enables LLM to push Generative UI components */
  a2ui_session_id?: string;
  /** Base64 data URI of an image (e.g. "data:image/png;base64,...") for multimodal messages */
  image_base64?: string;
}

export interface SendMessageOptions {
  api?: string;
  token?: string;
  signal?: AbortSignal;
}

/**
 * Send a message to Go BFF and consume the named SSE event stream.
 * Uses HttpOnly cookies for auth (set by BFF /auth/callback) or explicit token.
 *
 * @returns AbortController to cancel the stream
 */
export function sendMessageBFF(
  payload: BFFChatPayload,
  callbacks: StreamCallbacks,
  options?: SendMessageOptions,
): AbortController {
  const controller = new AbortController();
  const signal = options?.signal || controller.signal;
  let completed = false; // Prevent duplicate onComplete calls

  (async () => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      };
      if (options?.token) {
        headers['Authorization'] = `Bearer ${options.token}`;
      }

      const response = await fetch(options?.api || '/api/chat', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Chat API error ${response.status}: ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse named SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            // Start of a new event — process previous if complete
            if (currentEvent && currentData) {
              processEvent(currentEvent, currentData, callbacks, () => { completed = true; });
            }
            currentEvent = line.slice(7).trim();
            currentData = '';
          } else if (line.startsWith('data: ')) {
            const dataPayload = line.slice(6);
            if (currentEvent) {
              // Named event mode — accumulate data for named event processing
              currentData += dataPayload;
            } else {
              // OpenAI-compatible SSE mode — data lines without event: prefix
              // Format: data: {"choices":[{"delta":{"content":"..."}}]}  or  data: [DONE]
              if (dataPayload === '[DONE]') {
                if (!completed) {
                  completed = true;
                  callbacks.onComplete();
                }
              } else {
                processOpenAIChunk(dataPayload, callbacks);
              }
            }
          } else if (line === '' && currentEvent && currentData) {
            // Empty line = end of event
            processEvent(currentEvent, currentData, callbacks, () => { completed = true; });
            currentEvent = '';
            currentData = '';
          }
        }

        // Process any remaining buffered event
        if (currentEvent && currentData) {
          processEvent(currentEvent, currentData, callbacks, () => { completed = true; });
        }
      }

      // Stream ended without explicit done event — only call if not already completed
      if (!completed) {
        callbacks.onComplete();
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return; // User cancelled
      }
      callbacks.onError(err as Error);
    }
  })();

  return controller;
}

/**
 * Process an OpenAI-compatible SSE data chunk (no event: prefix).
 * Format: {"choices":[{"delta":{"content":"..."}}]}
 * Extracts content delta and calls onDelta callback.
 */
function processOpenAIChunk(data: string, callbacks: StreamCallbacks) {
  try {
    const parsed = JSON.parse(data);
    const choices = parsed.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const delta = choices[0]?.delta;
      if (delta?.content) {
        callbacks.onDelta({ content: delta.content });
      }
    }
  } catch {
    // Skip unparseable chunks
  }
}

/** Process a single named SSE event */
function processEvent(event: string, data: string, callbacks: StreamCallbacks, onDone?: () => void) {
  try {
    switch (event) {
      case 'delta': {
        const parsed: DeltaEvent = JSON.parse(data);
        callbacks.onDelta(parsed);
        break;
      }
      case 'step': {
        const parsed: StepEvent = JSON.parse(data);
        callbacks.onStep(parsed);
        break;
      }
      case 'thinking': {
        // Gateway schema: { type: 'thinking', status: '...' } (status holds the localized message)
        // Legacy schema: { status: 'thinking'|'tool_planning', detail: '...' }
        const parsed: { status?: string; detail?: string; type?: string } = JSON.parse(data);
        callbacks.onThinking({
          status: parsed.status === 'tool_planning' ? 'tool_planning' : 'thinking',
          detail: parsed.detail || parsed.status || '',
        });
        break;
      }
      // ── AI Gateway (eino agent-runtime) event names ─────────────────────────
      case 'content': {
        // Gateway emits { type: 'content', content: '...' } per LLM token chunk
        const parsed: { content?: string } = JSON.parse(data);
        if (parsed.content) {
          callbacks.onDelta({ content: parsed.content });
        }
        break;
      }
      case 'thinking_content': {
        // Reasoning-model trace chunks — render as delta so user sees the thought
        const parsed: { content?: string } = JSON.parse(data);
        if (parsed.content) {
          callbacks.onDelta({ content: parsed.content });
        }
        break;
      }
      case 'tool_call': {
        const parsed: {
          tool_name?: string;
          args?: unknown;
          status?: string;
        } = JSON.parse(data);
        callbacks.onStep({
          title: parsed.tool_name || 'Tool',
          status: 'running',
          detail: parsed.status,
          toolName: parsed.tool_name,
          args: parsed.args !== undefined ? JSON.stringify(parsed.args) : undefined,
        });
        break;
      }
      case 'tool_result': {
        const parsed: {
          tool_name?: string;
          result?: string;
          status?: string;
        } = JSON.parse(data);
        callbacks.onStep({
          title: parsed.tool_name || 'Tool',
          status: 'done',
          detail: parsed.status,
          toolName: parsed.tool_name,
          output: parsed.result,
        });
        break;
      }
      case 'error': {
        const parsed: { error?: string; message?: string } = JSON.parse(data);
        callbacks.onError(new Error(parsed.error || parsed.message || 'Agent error'));
        break;
      }
      case 'node_start':
      case 'node_end':
      case 'node_error':
      case 'workflow_start':
      case 'workflow_end': {
        // Multi-agent / workflow lifecycle events — not surfaced to UI yet
        break;
      }
      case 'artifact': {
        const parsed: ArtifactEvent = JSON.parse(data);
        callbacks.onArtifact(parsed);
        break;
      }
      case 'approval_request': {
        const parsed: ApprovalRequestEvent = JSON.parse(data);
        callbacks.onApprovalRequest?.(parsed);
        break;
      }
      case 'approval_result': {
        const parsed: ApprovalResultEvent = JSON.parse(data);
        callbacks.onApprovalResult?.(parsed);
        break;
      }
      case 'ping': {
        // Heartbeat — ignore (keeps connection alive during approval wait)
        break;
      }
      case 'sources': {
        const parsed: SourcesEvent = JSON.parse(data);
        callbacks.onSources?.(parsed);
        break;
      }
      case 'agent_handoff': {
        const parsed: AgentHandoffEvent = JSON.parse(data);
        callbacks.onAgentHandoff?.(parsed);
        break;
      }
      case 'citation_warning': {
        // The answer cited an act, a section, or a [ref:...] anchor that was
        // not in what the search returned. Emitted once, after the content
        // stream and before 'done', and only when the gateway runs with
        // CITATION_GUARD_MODE=warn. An app that does not handle this still
        // shows an unmarked answer, so treat wiring it as part of shipping
        // any use case that answers from a knowledge base.
        const parsed: { status?: string; content?: string } = JSON.parse(data);
        callbacks.onCitationWarning?.(parsed.status || parsed.content || '');
        break;
      }
      // The turn stopped to ask a person and this stream is finished, but the
      // turn is not: the run continues server-side once the approval is
      // decided, and its answer lands on an agent execution rather than here.
      //
      // Reported through its own callback and then completed. Falling through
      // to `default` - which is what happened before this case existed - left
      // the app on a spinner waiting for an answer that was never coming down
      // this connection.
      case 'run_suspended': {
        const parsed: {
          approval_id?: string;
          tool_name?: string;
          status?: string;
          question_payload?: { suspended_run_id?: string };
        } = JSON.parse(data);
        callbacks.onRunSuspended?.({
          approvalId: parsed.approval_id || '',
          toolName: parsed.tool_name || '',
          suspendedRunId: parsed.question_payload?.suspended_run_id || '',
          message: parsed.status || '',
        });
        onDone?.();
        callbacks.onComplete();
        break;
      }
      case 'citation_check': {
        // Per [ref:...] anchor, whether the cited chunk supports the sentence
        // that cites it. Emitted once, after the content stream and before
        // 'done', and only when the gateway runs CITATION_SUPPORT_CHECK=on.
        // The verdicts are in `data`; `status` (or `content`) holds the Thai
        // summary. Items pass through as sent, including those whose check
        // call failed (empty verdict, with `error`).
        const parsed: {
          status?: string;
          content?: string;
          data?: {
            checks?: CitationCheckItem[];
            counts?: Partial<Record<CitationVerdict, number>>;
            model?: string;
            latency_ms?: number;
            review_threshold?: number;
          };
        } = JSON.parse(data);
        const detail = parsed.data ?? {};
        callbacks.onCitationCheck?.({
          summary: parsed.status || parsed.content || '',
          checks: Array.isArray(detail.checks) ? detail.checks : [],
          counts: detail.counts ?? {},
          model: detail.model,
          latency_ms: detail.latency_ms,
          review_threshold: detail.review_threshold,
        });
        break;
      }
      case 'done': {
        onDone?.();
        callbacks.onComplete();
        break;
      }
      default:
        // Unknown event type — skip
        break;
    }
  } catch {
    // Skip unparseable data
  }
}

// ── Approval Decision Sender ─────────────────────────────────────────────────

/**
 * Send an approval decision to the BFF.
 * Called when user clicks Approve or Reject on the ApprovalCard.
 */
export async function sendApprovalDecision(
  planId: string,
  decision: 'approve' | 'reject',
  comment?: string,
): Promise<void> {
  await fetch('/api/chat/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      plan_id: planId,
      decision,
      comment: comment || '',
    }),
  });
}

/**
 * Abort an active generation stream (legacy compatibility)
 */
export async function abortStream(streamId: string): Promise<void> {
  await fetch('/api/chat/abort', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ streamId }),
  }).catch(() => {});
}

// ── Legacy exports for backward compatibility ────────────────────────────────
// These re-export the old API for any code that hasn't migrated yet
export type { SendMessagePayload };
