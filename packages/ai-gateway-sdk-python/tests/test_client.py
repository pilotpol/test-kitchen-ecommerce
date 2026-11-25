import httpx
import pytest

from promptserv import (
    AuthError,
    ChannelAuth,
    ChannelUserAuth,
    MasterAuth,
    NotFoundError,
    PromptServ,
    agent_model,
    collect_text,
)
from promptserv.errors import RateLimitError


def client_with(handler, auth=None):
    transport = httpx.MockTransport(handler)
    return PromptServ(
        "https://gw.example.com",
        auth or ChannelAuth("sk-test"),
        http_client=httpx.Client(transport=transport),
    )


def test_agent_model_builds_the_routing_string():
    assert agent_model("watson") == "agent:watson"


def test_channel_user_auth_sends_both_identities():
    """The channel key says which application; the user token says who for.

    Sending only the channel key is why tools that scope by caller answer "no
    user identity was forwarded", which reads as the tool being broken.
    """
    seen = {}

    def handler(request):
        seen.update(request.headers)
        return httpx.Response(200, json={"choices": []})

    with client_with(handler, ChannelUserAuth("sk-chan", "jwt-user")) as c:
        c.chat.create(messages=[{"role": "user", "content": "hi"}])

    assert seen["x-channel-key"] == "sk-chan"
    assert seen["authorization"] == "Bearer jwt-user"


def test_master_auth_uses_a_plain_bearer():
    seen = {}

    def handler(request):
        seen.update(request.headers)
        return httpx.Response(200, json={})

    with client_with(handler, MasterAuth("sk-master")) as c:
        c.workflows.list_definitions()
    assert seen["authorization"] == "Bearer sk-master"


def test_errors_keep_the_gateways_own_explanation():
    """A status code starts an investigation; the message usually ends it."""

    def handler(request):
        return httpx.Response(
            403, json={"error": {"code": 403, "message": "model 'x' is not allowed for this API key"}}
        )

    with client_with(handler) as c:
        with pytest.raises(AuthError) as exc:
            c.chat.create(messages=[])
    assert "not allowed for this API key" in exc.value.message
    assert exc.value.status == 403


def test_the_other_error_shapes_are_understood_too():
    """The gateway uses three; guessing one drops the message from the others."""

    def handler(request):
        return httpx.Response(404, json={"error": "no active agent named 'nope'"})

    with client_with(handler) as c:
        with pytest.raises(NotFoundError) as exc:
            c.chat.create(messages=[])
    assert "no active agent" in exc.value.message


def test_rate_limits_are_their_own_error():
    def handler(request):
        return httpx.Response(429, json={"message": "slow down"})

    with client_with(handler) as c:
        with pytest.raises(RateLimitError):
            c.chat.create(messages=[])


def test_run_passes_the_callback_url_through():
    seen = {}

    def handler(request):
        import json

        seen.update(json.loads(request.content))
        return httpx.Response(202, json={"agent_execution_id": "exec-1"})

    with client_with(handler) as c:
        c.agents.run("agent-1", {"q": "hi"}, callback_url="https://me.example.com/hook")
    assert seen["callback_url"] == "https://me.example.com/hook"


def test_collect_text_understands_the_openai_chunk_shape():
    frames = [
        {"choices": [{"delta": {"content": "Hel"}}]},
        {"choices": [{"delta": {"content": "lo"}}]},
        {"choices": [{"delta": {}, "finish_reason": "stop"}]},
    ]
    assert collect_text(iter(frames)) == "Hello"


def test_collect_text_understands_the_agent_envelope_and_skips_the_rest():
    """Thinking and tool calls belong in a progress display, not the answer."""
    frames = [
        {"type": "thinking", "content": "let me check the policy"},
        {"type": "content", "content": "Ten "},
        {"type": "tool_call", "name": "kb_search"},
        {"type": "content", "content": "days."},
        {"type": "done"},
    ]
    assert collect_text(iter(frames)) == "Ten days."


def test_wait_raises_rather_than_returning_an_unfinished_run():
    """A caller handed a dict will read output from it, and there is none."""

    def handler(request):
        return httpx.Response(200, json={"status": "running"})

    from promptserv.errors import TimeoutError_

    with client_with(handler) as c:
        with pytest.raises(TimeoutError_, match="still running"):
            c.agents.wait("exec-1", timeout=0.05, poll_interval=0.01)


# A paused turn produced no answer and is not going to produce one on this
# stream: the run continues server-side once somebody decides the approval.
# Returning "" would look exactly like a model that said nothing, and the
# caller would report failure for a turn that is working correctly.
def test_a_paused_turn_raises_rather_than_looking_empty():
    from promptserv import RunSuspended

    frames = [
        {"type": "thinking", "content": "checking"},
        {
            "type": "run_suspended",
            "approval_id": "ap-1",
            "tool_name": "create_key",
            "question_payload": {"suspended_run_id": "sr-1", "approval_id": "ap-1"},
        },
    ]
    with pytest.raises(RunSuspended) as exc:
        collect_text(iter(frames))

    assert exc.value.approval_id == "ap-1"
    assert exc.value.suspended_run_id == "sr-1"
    # The message has to say what to do about it, not only that it happened.
    assert "decided" in str(exc.value)


def test_an_ordinary_turn_is_unaffected():
    frames = [{"type": "content", "content": "hello"}, {"type": "done"}]
    assert collect_text(iter(frames)) == "hello"
