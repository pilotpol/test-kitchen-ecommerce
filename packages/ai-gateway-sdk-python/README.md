# promptserv (Python)

Python client for the PromptServe AI Gateway. Sibling of `@repo/ai-gateway-sdk`
for TypeScript.

## Why call the gateway rather than a provider

The harness lives on the server side of the gateway: guardrails and PII masking
on the way in, knowledge base retrieval and the tool registry during, tracing,
cost accounting and audit on the way out. Calling a provider directly skips all
of it. Naming an agent gets the agent's configuration too.

## Install

```bash
pip install -e packages/ai-gateway-sdk-python
```

One dependency, `httpx`. This package is installed into other people's
applications, and every dependency it adds is one they may already have at a
different version.

## Chat

```python
from promptserv import PromptServ, ChannelAuth, agent_model

with PromptServ("https://gateway.example.com", ChannelAuth(API_KEY)) as client:
    answer = client.chat.create(
        model=agent_model("watson"),          # or a plain model name
        messages=[{"role": "user", "content": "what is the leave policy?"}],
    )
    print(answer["choices"][0]["message"]["content"])
```

`agent_model("watson")` builds `"agent:watson"`. Any OpenAI client can do the
same by putting that string in its model box - the SDK is a convenience, not a
requirement.

`client.chat.models()` lists what the key may call, agents included.

### Streaming

```python
from promptserv import collect_text

frames = client.chat.stream(model="gpt-4o-mini", messages=[...])
print(collect_text(frames))
```

`stream` yields raw frames because the gateway emits two shapes: OpenAI
`chat.completion.chunk` objects on the compatibility path, and a named-event
envelope carrying agent steps and tool calls on the agent path. `collect_text`
handles the common case of wanting only the words; read the frames yourself to
show progress.

## Agent runs

```python
run = client.agents.run("agent-1", {"question": "..."},
                        idempotency_key="ticket-4821")
result = client.agents.wait(run["agent_execution_id"], timeout=600)
```

`idempotency_key` makes a retry safe: a repeat with the same key returns the
original run rather than starting a second one.

`wait` raises on timeout rather than returning an unfinished run, because a
caller handed a dict will read `output` from it and there is none. The run
keeps going; its id is in the message.

## Being told instead of asking

Polling works but every caller writes the same loop. Pass a `callback_url` and
the gateway POSTs the result when the run ends - including when it fails or is
cancelled, so a caller cannot mistake a dead run for a slow one.

```python
client.agents.run("agent-1", {...}, callback_url="https://you.example.com/hook")
```

The gateway requires https, refuses addresses on its own machine or private
network unless the deployment opted in, and refuses the callback entirely if
the deployment has no signing secret configured.

### Verifying what arrives

Your callback URL is an ordinary endpoint. Anyone who learns it can POST a
made-up result, and an application that acts on the body without checking
cannot tell the difference.

```python
from promptserv import verify, SignatureError

@app.post("/hook")
async def hook(request):
    try:
        payload = verify(SECRET, request.headers, await request.body())
    except SignatureError:
        return Response(status_code=400)
    ...
    return Response(status_code=200)
```

Pass the **raw body bytes**. Re-serialising a parsed dict produces different
bytes from the ones that were signed, and a perfectly good delivery fails.

`verify` also rejects deliveries whose timestamp is more than five minutes from
now. Their signatures are valid - that is exactly why the timestamp is signed
with the body.

Answer 2xx once you have stored the result. A 4xx tells the gateway you
understood and refused, and it will not retry; a 5xx or a timeout is retried a
few times with backoff. Either way the output stays on the execution row, and
`GET /admin/callbacks/undelivered` lists what never arrived.

## Auth

| | use | header |
|---|---|---|
| `ChannelAuth` | service to service | `Authorization: Bearer <channel key>` |
| `ChannelUserAuth` | acting for a signed-in user | `X-Channel-Key` + `Authorization: Bearer <user jwt>` |
| `MasterAuth` | `/admin` only | `Authorization: Bearer <master key>` |

Use `ChannelUserAuth` whenever there is a real end user. The user token is what
attributes the turn to them in the audit log and what per-user tools scope on;
with only a channel key those tools answer "no user identity was forwarded",
which reads as the tool being broken.

The master key is the key to every tenant on the gateway. Keep it in a backend
service - never in a browser, a notebook, or anything shipped to a customer.

## Errors

Everything raises a subclass of `PromptServError`. `APIError` keeps the
gateway's own message, which is usually the whole answer: "model 'x' is not
allowed for this API key" needs no investigation, while "403" starts one.

`AuthError` (401/403), `NotFoundError` (404), `RateLimitError` (429),
`TimeoutError_`.

## Tests

```bash
python -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/python -m pytest tests/ -q
```

`tests/test_signature_vectors.py` pins signatures the Go gateway produced. The
gateway signs and this SDK verifies in different languages, and nothing else in
either suite would notice them drifting apart - both would keep passing while
every real delivery failed. The matching Go test asserts the same values.
