import { Transport } from "../transport";
import {
  CostBreakdown,
  OperationEvent,
  TraceDetail,
} from "../typesExt/observability";

export class TracesNamespace {
  constructor(private transport: Transport) {}

  async listEvents(params?: {
    trace_id?: string;
    document_id?: string;
    workflow_run_id?: string;
    agent_id?: string;
    limit?: number;
  }): Promise<OperationEvent[]> {
    return this.transport.request({
      path: `/admin/operation-events`,
      query: params,
    });
  }

  async getTrace(traceId: string): Promise<TraceDetail> {
    return this.transport.request({
      path: `/admin/traces/${encodeURIComponent(traceId)}`,
    });
  }

  async getTraceCostBreakdown(traceId: string): Promise<CostBreakdown> {
    return this.transport.request({
      path: `/admin/traces/${encodeURIComponent(traceId)}/cost-breakdown`,
    });
  }

  async getCostByDimension(params: {
    dimension: "agent_id" | "user_id" | "document_id" | "workflow_run_id";
    from?: string;
    to?: string;
  }): Promise<CostBreakdown> {
    return this.transport.request({
      path: `/admin/cost/by-dimension`,
      query: params,
    });
  }
}
