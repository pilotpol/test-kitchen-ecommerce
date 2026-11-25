import { Transport } from "../transport";

/**
 * OpenAI-compatible chat completions.
 *
 * This is a thin, low-level wrapper. For streaming with rich event parsing
 * (agent steps, thinking, artifacts, HITL approval cards) use the
 * `streaming.ts` helpers or the React hooks in `react/` — they understand
 * the named-event SSE protocol emitted by the PromptServ BFF.
 */
export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | Array<{ type: string; [k: string]: unknown }>;
  tool_call_id?: string;
  name?: string;
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatCompletionMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  [k: string]: unknown;
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: ChatCompletionMessage;
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export class ChatCompletionsNamespace {
  constructor(private transport: Transport) {}

  async create(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    return this.transport.request({
      method: "POST",
      path: `/v1/chat/completions`,
      body: { ...req, stream: false },
    });
  }

  /**
   * Raw streaming — returns the underlying Response so caller can pipe to
   * Vercel AI SDK, custom SSE parser, or forward to a browser.
   */
  async createStream(req: ChatCompletionRequest, signal?: AbortSignal): Promise<Response> {
    return this.transport.request<Response>({
      method: "POST",
      path: `/v1/chat/completions`,
      body: { ...req, stream: true },
      raw: true,
      signal,
      headers: { Accept: "text/event-stream" },
    });
  }
}

export class ChatNamespace {
  public completions: ChatCompletionsNamespace;
  constructor(transport: Transport) {
    this.completions = new ChatCompletionsNamespace(transport);
  }
}
