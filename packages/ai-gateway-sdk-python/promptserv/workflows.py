"""Workflow runs.

These live behind /admin, so they need MasterAuth. That is a deliberate
asymmetry rather than an oversight: the master key is the key to every tenant
on the gateway, so a workflow run belongs in a backend service, never in code
that ships to a browser or a customer's machine.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from .transport import Transport


class WorkflowsNamespace:
    def __init__(self, transport: Transport):
        self._t = transport

    def run(
        self,
        workflow_id: str,
        input: Optional[Dict[str, Any]] = None,
        *,
        trace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        body: Dict[str, Any] = {"input": input or {}}
        if trace_id:
            body["trace_id"] = trace_id
        return self._t.request("POST", f"/admin/workflows/{workflow_id}/run", body=body)

    def get_execution(self, execution_id: str) -> Dict[str, Any]:
        return self._t.request("GET", f"/admin/workflow-executions/{execution_id}")

    def list_definitions(self) -> Any:
        return self._t.request("GET", "/admin/workflows")
