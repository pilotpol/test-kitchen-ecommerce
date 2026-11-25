"""Verifying a callback the gateway sent you.

This is the receiving half of `callback_url`. It is a separate module with no
client and no configuration because it runs in a different place - a web
handler in the caller's application - and needs nothing but the shared secret.

Checking the signature is not optional in the way it may appear. The callback
URL is an ordinary HTTP endpoint; anyone who learns it can POST a made-up
result to it, and an application that acts on the body without checking has no
way to tell that from a real one.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any, Dict, Mapping, Union

HEADER_SIGNATURE = "X-PromptServe-Signature"
HEADER_TIMESTAMP = "X-PromptServe-Timestamp"
HEADER_EVENT = "X-PromptServe-Event"
HEADER_EXECUTION = "X-PromptServe-Execution-Id"

# How far the delivery's timestamp may be from now. Five minutes covers clock
# drift and a slow retry; much more than that and a delivery captured off the
# wire could be replayed at leisure.
DEFAULT_TOLERANCE_SECONDS = 300


class SignatureError(Exception):
    """The delivery did not verify. Treat the request as untrusted."""


def sign(secret: str, timestamp: str, body: bytes) -> str:
    """Compute the expected signature. Mirrors the gateway exactly."""
    mac = hmac.new(secret.encode(), digestmod=hashlib.sha256)
    mac.update(timestamp.encode())
    mac.update(b".")
    mac.update(body)
    return "sha256=" + mac.hexdigest()


def verify(
    secret: str,
    headers: Mapping[str, str],
    body: Union[bytes, str],
    *,
    tolerance_seconds: int = DEFAULT_TOLERANCE_SECONDS,
) -> Dict[str, Any]:
    """Check a delivery and return its decoded payload.

    Raises SignatureError on anything wrong. Pass the **raw** request body -
    the bytes as received. Re-serialising a parsed dict will not produce the
    same bytes the gateway signed, and the check will fail for a delivery that
    was perfectly good.

    Header lookup is case-insensitive, because WSGI, ASGI and the various
    frameworks each normalise header names differently.

        payload = verify(SECRET, request.headers, await request.body())
    """
    if isinstance(body, str):
        body = body.encode()

    lookup = {k.lower(): v for k, v in headers.items()}
    signature = lookup.get(HEADER_SIGNATURE.lower(), "")
    timestamp = lookup.get(HEADER_TIMESTAMP.lower(), "")
    if not signature or not timestamp:
        raise SignatureError(
            f"missing {HEADER_SIGNATURE} or {HEADER_TIMESTAMP}; "
            "this request did not come from a PromptServe gateway"
        )

    try:
        sent_at = int(timestamp)
    except ValueError as exc:
        raise SignatureError(f"{HEADER_TIMESTAMP} is not a unix timestamp: {timestamp!r}") from exc

    drift = abs(time.time() - sent_at)
    if drift > tolerance_seconds:
        # Checked before the signature so that a genuine replay is reported as
        # a replay. A stale delivery has a perfectly valid signature - that is
        # the whole reason the timestamp is signed with it.
        raise SignatureError(
            f"delivery is {int(drift)}s away from now, outside the {tolerance_seconds}s window; "
            "this is either a replay or a clock that needs fixing"
        )

    expected = sign(secret, timestamp, body)
    if not hmac.compare_digest(expected, signature):
        raise SignatureError("signature does not match; the body was altered or the secret differs")

    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise SignatureError(f"body verified but is not JSON: {exc}") from exc
