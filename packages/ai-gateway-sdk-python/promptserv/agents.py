"""Agent runs: start one, wait for it, or be told when it ends."""

from __future__ import annotations

import time
from typing import Any, Dict, Optional

from .errors import TimeoutError_
from .transport import Transport

TERMINAL_STATUSES = frozenset({"completed", "failed", "cancelled"})


class AgentsNamespace:
    def __init__(self, transport: Transport):
        self._t = transport

    def run(
        self,
        agent_id: str,
        input: Optional[Dict[str, Any]] = None,
        *,
        idempotency_key: Optional[str] = None,
        callback_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Start a run and return immediately.

        `callback_url` asks the gateway to POST the result there when the run
        ends, so nothing has to poll. Verify what arrives with
        `promptserv.webhooks.verify` - the gateway signs every delivery, and a
        receiver that does not check the signature will act on anything sent to
        that URL by anyone who learns it.

        `idempotency_key` makes a retry safe: a repeat with the same key
        returns the original run instead of starting a second one.
        """
        body: Dict[str, Any] = {"input": input or {}}
        if idempotency_key:
            body["idempotency_key"] = idempotency_key
        if callback_url:
            body["callback_url"] = callback_url
        return self._t.request("POST", f"/v1/agents/{agent_id}/runs", body=body)

    def get(self, execution_id: str) -> Dict[str, Any]:
        """Fetch a run, finished or not."""
        return self._t.request("GET", f"/v1/agents/runs/{execution_id}")

    def cancel(self, execution_id: str) -> Dict[str, Any]:
        return self._t.request("POST", f"/v1/agents/runs/{execution_id}/cancel")

    def wait(
        self,
        execution_id: str,
        *,
        timeout: float = 300.0,
        poll_interval: float = 2.0,
    ) -> Dict[str, Any]:
        """Poll until the run reaches a terminal state.

        Raises on timeout rather than returning the last unfinished state: a
        caller that gets a dict back will read `output` from it, and an
        unfinished run has none. The run itself keeps going, and its id is in
        the message.

        Prefer `callback_url` on `run` when the work is long. This exists for
        scripts, where a loop is simpler than standing up a receiver.
        """
        deadline = time.monotonic() + timeout
        while True:
            run = self.get(execution_id)
            if run.get("status") in TERMINAL_STATUSES:
                return run
            if time.monotonic() >= deadline:
                raise TimeoutError_(
                    f"run {execution_id} was still {run.get('status')!r} after {timeout}s; "
                    f"it is still running - fetch it later with agents.get({execution_id!r})"
                )
            time.sleep(poll_interval)

    def invoke(
        self,
        agent_id: str,
        input: Optional[Dict[str, Any]] = None,
        *,
        idempotency_key: Optional[str] = None,
        callback_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Start a run and wait for it in one call, server-side.

        The gateway gives up after its own limit and answers 408, so pass
        `callback_url` for anything that might take a while: the answer then
        arrives at the receiver even when this call has already timed out.
        """
        body: Dict[str, Any] = {"input": input or {}}
        if idempotency_key:
            body["idempotency_key"] = idempotency_key
        if callback_url:
            body["callback_url"] = callback_url
        return self._t.request("POST", f"/v1/agents/{agent_id}/invoke", body=body)
