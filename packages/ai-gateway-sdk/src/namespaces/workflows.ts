import { Transport } from "../transport";
import {
  RunWorkflowInput,
  RunWorkflowResult,
  WorkflowDefinition,
  WorkflowExecution,
} from "../typesExt/workflow";

export class WorkflowsNamespace {
  constructor(private transport: Transport) {}

  /** Start a workflow run (uses /admin/workflows/{id}/run). */
  async run(
    workflowId: string,
    input: RunWorkflowInput = {},
  ): Promise<RunWorkflowResult> {
    return this.transport.request({
      method: "POST",
      path: `/admin/workflows/${encodeURIComponent(workflowId)}/run`,
      body: input,
      traceId: input.trace_id,
    });
  }

  /** Fire a test run (validates graph without side effects). */
  async testRun(
    workflowId: string,
    input: RunWorkflowInput = {},
  ): Promise<WorkflowExecution> {
    return this.transport.request({
      method: "POST",
      path: `/admin/workflows/${encodeURIComponent(workflowId)}/test-run`,
      body: input,
    });
  }

  async list(params?: { tag?: string; is_template?: boolean }): Promise<WorkflowDefinition[]> {
    return this.transport.request({
      path: `/admin/workflows`,
      query: params,
    });
  }

  async get(workflowId: string): Promise<WorkflowDefinition> {
    return this.transport.request({
      path: `/admin/workflows/${encodeURIComponent(workflowId)}`,
    });
  }

  async listTemplates(): Promise<WorkflowDefinition[]> {
    return this.transport.request({ path: `/admin/workflows/templates` });
  }

  /** Poll execution status. */
  async getExecution(executionId: string): Promise<WorkflowExecution> {
    return this.transport.request({
      path: `/admin/document-workflows/executions/${encodeURIComponent(executionId)}`,
    });
  }

  async listExecutions(params?: { workflow_id?: string; status?: string; limit?: number }): Promise<WorkflowExecution[]> {
    return this.transport.request({
      path: `/admin/document-workflows/executions`,
      query: params,
    });
  }

  async cancelExecution(executionId: string): Promise<void> {
    await this.transport.request({
      method: "POST",
      path: `/admin/document-workflows/executions/${encodeURIComponent(executionId)}/cancel`,
    });
  }
}
