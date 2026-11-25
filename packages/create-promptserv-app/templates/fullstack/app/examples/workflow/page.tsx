"use client";

import { WorkflowRunner } from "@repo/ai-gateway-sdk/components";

export default function WorkflowExamplePage() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">Workflow Runner</h1>
      <p className="mt-1 text-sm text-gray-600">
        Replace <code>WORKFLOW_ID</code> below with a real workflow in your
        gateway (try <code>client.workflows.list()</code> first).
      </p>
      <div className="mt-4 rounded-lg border bg-white p-4">
        <WorkflowRunner workflowId="WORKFLOW_ID" />
      </div>
    </main>
  );
}
