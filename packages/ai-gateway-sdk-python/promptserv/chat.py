"""Chat completions, including naming an agent where a model goes."""

from __future__ import annotations

from typing import Any, Dict, Iterator, List, Optional

from .errors import PromptServError
from .transport import Transport

AGENT_MODEL_PREFIX = "agent:"


def agent_model(name_or_id: str) -> str:
    """Build the model string that routes a completion through an agent.

    Calling an agent this way gives the request the whole server-side harness -
    knowledge base retrieval, the tool registry, guardrails, tracing and cost -
    rather than the bare model behind it.

        client.chat.create(model=agent_model("watson"), messages=[...])
    """
    return f"{AGENT_MODEL_PREFIX}{name_or_id}"


class ChatNamespace:
    def __init__(self, transport: Transport):
        self._t = transport

    def create(
        self,
        *,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        timeout: Optional[float] = None,
        **params: Any,
    ) -> Dict[str, Any]:
        """One completion, waited for.

        Extra keyword arguments are passed through untouched. Whether the
        gateway forwards them to the provider depends on the channel: in
        OpenAI compatibility mode the body goes through verbatim, and
        otherwise the gateway rebuilds it and sampling parameters are dropped.
        """
        body = {"messages": messages, "stream": False, **params}
        if model:
            body["model"] = model
        return self._t.request("POST", "/v1/chat/completions", body=body, timeout=timeout)

    def stream(
        self,
        *,
        messages: List[Dict[str, Any]],
        model: Optional[str] = None,
        timeout: Optional[float] = None,
        **params: Any,
    ) -> Iterator[Dict[str, Any]]:
        """Stream a completion.

        Yields raw frames rather than assembled text, because the gateway emits
        two different shapes: OpenAI `chat.completion.chunk` objects on the
        compatibility path, and a named-event envelope carrying agent steps and
        tool calls on the agent path. `collect_text` handles the common case of
        wanting only the words.
        """
        body = {"messages": messages, "stream": True, **params}
        if model:
            body["model"] = model
        return self._t.stream_sse("/v1/chat/completions", body=body, timeout=timeout)

    def models(self) -> List[Dict[str, Any]]:
        """List what this key may call, agents included.

        Agents appear as `agent:<name>`, so a model picker built from this list
        offers them without needing to know what an agent is.
        """
        resp = self._t.request("GET", "/v1/models")
        return (resp or {}).get("data", [])


class RunSuspended(PromptServError):
    """The turn stopped to ask a person and this stream is over.

    Raised by `collect_text` rather than returned as an empty string. A turn
    that paused produced no answer and is not going to produce one here: the
    run continues server-side once somebody decides the approval, and its
    result lands on an agent execution. Returning "" would look exactly like a
    model that said nothing, and the caller would report failure for a turn
    that is working correctly and simply waiting.

    `approval_id` is the question to decide; `suspended_run_id` is the paused
    turn. Neither is needed to recover - deciding the approval is what
    continues it - but both are what you would put in a log line.
    """

    def __init__(self, approval_id: str = "", suspended_run_id: str = "", tool_name: str = ""):
        super().__init__(
            f"the turn paused for approval and will continue once it is decided "
            f"(approval_id={approval_id or '?'}, tool={tool_name or '?'})"
        )
        self.approval_id = approval_id
        self.suspended_run_id = suspended_run_id
        self.tool_name = tool_name


def collect_text(frames: Iterator[Dict[str, Any]]) -> str:
    """Assemble the assistant's words from a stream, ignoring everything else.

    Understands both shapes the gateway emits. Thinking, tool calls and step
    events are skipped: they belong in a UI that shows progress, not in the
    answer.

    Raises `RunSuspended` if the turn paused for an approval instead of
    answering - see that class for why silence would be the wrong result.
    """
    out: List[str] = []
    for frame in frames:
        choices = frame.get("choices")
        if isinstance(choices, list) and choices:
            delta = choices[0].get("delta") or {}
            piece = delta.get("content")
            if piece:
                out.append(piece)
            continue
        if frame.get("type") == "run_suspended":
            payload = frame.get("question_payload") or {}
            raise RunSuspended(
                approval_id=str(frame.get("approval_id") or payload.get("approval_id") or ""),
                suspended_run_id=str(payload.get("suspended_run_id") or ""),
                tool_name=str(frame.get("tool_name") or ""),
            )
        if frame.get("type") == "content" and frame.get("content"):
            out.append(str(frame["content"]))
    return "".join(out)
