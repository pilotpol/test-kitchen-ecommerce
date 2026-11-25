"""The verifier is the part where being wrong is worst.

A bug here does not make the SDK fail visibly - it makes it accept a forged
delivery, and the application acts on invented data believing the gateway sent
it. So these tests are mostly about what must be rejected.
"""

import json
import time

import pytest

from promptserv.webhooks import (
    HEADER_SIGNATURE,
    HEADER_TIMESTAMP,
    SignatureError,
    sign,
    verify,
)

SECRET = "topsecret"


def delivery(body: dict, *, secret=SECRET, ts=None):
    raw = json.dumps(body).encode()
    ts = ts or str(int(time.time()))
    return {HEADER_SIGNATURE: sign(secret, ts, raw), HEADER_TIMESTAMP: ts}, raw


def test_a_genuine_delivery_verifies_and_returns_its_payload():
    headers, raw = delivery({"agent_execution_id": "exec-1", "status": "completed"})
    payload = verify(SECRET, headers, raw)
    assert payload["agent_execution_id"] == "exec-1"


def test_a_body_altered_after_signing_is_rejected():
    headers, raw = delivery({"status": "completed", "output": {"approved": False}})
    tampered = raw.replace(b"false", b"true ")
    with pytest.raises(SignatureError):
        verify(SECRET, headers, tampered)


def test_a_delivery_signed_with_another_secret_is_rejected():
    headers, raw = delivery({"status": "completed"}, secret="not-ours")
    with pytest.raises(SignatureError):
        verify(SECRET, headers, raw)


def test_an_old_delivery_is_rejected_as_a_replay():
    """Its signature is valid. That is exactly why the timestamp is signed."""
    old = str(int(time.time()) - 3600)
    headers, raw = delivery({"status": "completed"}, ts=old)
    with pytest.raises(SignatureError, match="replay"):
        verify(SECRET, headers, raw)


def test_an_unsigned_request_is_rejected_and_says_why():
    with pytest.raises(SignatureError, match="did not come from"):
        verify(SECRET, {}, b"{}")


def test_a_nonsense_timestamp_is_rejected():
    headers, raw = delivery({"status": "completed"})
    headers[HEADER_TIMESTAMP] = "yesterday"
    with pytest.raises(SignatureError):
        verify(SECRET, headers, raw)


def test_headers_are_matched_regardless_of_case():
    """WSGI, ASGI and each framework normalise header names differently."""
    headers, raw = delivery({"status": "completed"})
    lowered = {k.lower(): v for k, v in headers.items()}
    assert verify(SECRET, lowered, raw)["status"] == "completed"


def test_a_string_body_is_accepted_as_well_as_bytes():
    headers, raw = delivery({"status": "completed"})
    assert verify(SECRET, headers, raw.decode())["status"] == "completed"


def test_reserialising_the_body_is_the_mistake_the_docstring_warns_about():
    """Pinned so the guidance in verify() stays true.

    A caller who parses the JSON and re-encodes it gets different bytes - key
    order and separators - and a valid delivery fails. The failure is correct;
    the docstring telling people to pass raw bytes is what prevents it.
    """
    headers, raw = delivery({"b": 1, "a": 2})
    reserialised = json.dumps(json.loads(raw), sort_keys=True).encode()
    assert reserialised != raw
    with pytest.raises(SignatureError):
        verify(SECRET, headers, reserialised)
