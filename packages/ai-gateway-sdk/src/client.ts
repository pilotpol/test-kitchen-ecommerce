/**
 * PromptServClient — unified entry for all PromptServ AI Gateway APIs.
 *
 * Usage:
 *   const client = new PromptServClient({
 *     aiGatewayUrl: "http://promptserv-ai-gateway:4001",
 *     auth: { kind: "channel-user", channelApiKey, userJwt },
 *   });
 *   const run = await client.workflows.run("wf-baac-medical-claims", { input });
 *   await client.approvals.decide(id, { decision: "approved", decided_by: "me" });
 */

import { AuthStrategy } from "./auth";
import { ApprovalsNamespace } from "./namespaces/approvals";
import { ChannelsNamespace } from "./namespaces/channels";
import { ChatNamespace } from "./namespaces/chat";
import { FilesNamespace } from "./namespaces/files";
import { ALENamespace } from "./namespaces/ale";
import { KbNamespace } from "./namespaces/kb";
import { OcrNamespace } from "./namespaces/ocr";
import { SystemOneNamespace } from "./namespaces/systemone";
import { TracesNamespace } from "./namespaces/traces";
import { WorkflowsNamespace } from "./namespaces/workflows";
import { RetryOptions, Transport, TransportOptions } from "./transport";

export interface PromptServClientOptions {
  aiGatewayUrl: string;
  auth: AuthStrategy;
  /** Per-request default timeout (ms). Default: 30_000. */
  timeout?: number;
  /** Retry config for idempotent methods. */
  retry?: RetryOptions;
  /** Auto-forward X-Trace-ID when requested. */
  traceHeaderForward?: boolean;
  /** Pin API version. */
  apiVersion?: string;
  /** Observability hooks. */
  onRequest?: TransportOptions["onRequest"];
  onResponse?: TransportOptions["onResponse"];
  fetchImpl?: typeof fetch;
}

export class PromptServClient {
  public chat: ChatNamespace;
  public ocr: OcrNamespace;
  public workflows: WorkflowsNamespace;
  public approvals: ApprovalsNamespace;
  public channels: ChannelsNamespace;
  public files: FilesNamespace;
  public kb: KbNamespace;
  public traces: TracesNamespace;
  /**
   * Phase 5.1.1 (SDK v0.2) — ALE Brain user-scoped APIs.
   * `client.ale.memory.*`, `client.ale.skills.*`, `client.ale.scheduler.*`.
   * Requires channel-user auth (channel key + user JWT) so the gateway can
   * extract user_id from the JWT sub claim. See namespaces/ale.ts.
   */
  public ale: ALENamespace;
  /**
   * v0.4 - System One decisions (typed choice / score / noul answers from the
   * decision model on a PromptServe box). See namespaces/systemone.ts.
   */
  public systemOne: SystemOneNamespace;

  private transport: Transport;

  constructor(opts: PromptServClientOptions) {
    this.transport = new Transport({
      aiGatewayUrl: opts.aiGatewayUrl,
      auth: opts.auth,
      timeout: opts.timeout,
      retry: opts.retry,
      traceHeaderForward: opts.traceHeaderForward,
      apiVersion: opts.apiVersion,
      onRequest: opts.onRequest,
      onResponse: opts.onResponse,
      fetchImpl: opts.fetchImpl,
    });

    this.chat = new ChatNamespace(this.transport);
    this.ocr = new OcrNamespace(this.transport);
    this.workflows = new WorkflowsNamespace(this.transport);
    this.approvals = new ApprovalsNamespace(this.transport);
    this.channels = new ChannelsNamespace(this.transport);
    this.files = new FilesNamespace(this.transport);
    this.kb = new KbNamespace(this.transport);
    this.systemOne = new SystemOneNamespace(this.transport);
    this.traces = new TracesNamespace(this.transport);
    this.ale = new ALENamespace(this.transport);
  }
}
