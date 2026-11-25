import { Transport } from "../transport";
import { Approval, ApprovalDecisionInput } from "../typesExt/approval";

export class ApprovalsNamespace {
  constructor(private transport: Transport) {}

  async list(params?: { approver?: string; status?: string }): Promise<Approval[]> {
    return this.transport.request({
      path: `/admin/approvals`,
      query: params,
    });
  }

  async get(approvalId: string): Promise<Approval> {
    return this.transport.request({
      path: `/admin/approvals/${encodeURIComponent(approvalId)}`,
    });
  }

  async decide(
    approvalId: string,
    input: ApprovalDecisionInput,
  ): Promise<Approval> {
    return this.transport.request({
      method: "POST",
      path: `/admin/approvals/${encodeURIComponent(approvalId)}/decide`,
      body: input,
    });
  }

  async listForWorkflow(workflowId: string): Promise<Approval[]> {
    return this.transport.request({
      path: `/admin/workflows/${encodeURIComponent(workflowId)}/approvals`,
    });
  }
}
