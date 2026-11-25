"""Errors raised by the client.

The gateway answers with a JSON body that says what to fix. These types keep
that message rather than replacing it with a status code, because the message
is usually the whole answer - "model 'x' is not allowed for this API key" needs
no further investigation, while "403" starts one.
"""

from __future__ import annotations

from typing import Any, Optional


class PromptServError(Exception):
    """Base class. Catch this to catch everything from this package."""


class APIError(PromptServError):
    """The gateway answered, and said no."""

    def __init__(self, status: int, message: str, *, code: str = "", body: Any = None):
        super().__init__(f"[{status}] {message}" if message else f"HTTP {status}")
        self.status = status
        self.message = message
        self.code = code
        self.body = body


class AuthError(APIError):
    """401 or 403. The key is wrong, or is not allowed to do this."""


class NotFoundError(APIError):
    """404. Usually a model, agent or run id that does not exist."""


class RateLimitError(APIError):
    """429. Retry later; `retry_after` is the server's advice in seconds."""

    def __init__(self, status: int, message: str, *, retry_after: Optional[float] = None, **kw):
        super().__init__(status, message, **kw)
        self.retry_after = retry_after


class TimeoutError_(PromptServError):
    """The request did not finish in time.

    Named with a trailing underscore so it cannot shadow the builtin for anyone
    doing `from promptserv.errors import *`.
    """


def from_response(status: int, body: Any) -> APIError:
    """Build the most specific error for a response."""
    message, code = _extract(body)
    if status in (401, 403):
        return AuthError(status, message, code=code, body=body)
    if status == 404:
        return NotFoundError(status, message, code=code, body=body)
    if status == 429:
        return RateLimitError(status, message, code=code, body=body)
    return APIError(status, message, code=code, body=body)


def _extract(body: Any) -> tuple[str, str]:
    """Pull message and code out of the shapes the gateway actually uses.

    There are three: {"error": {...}} from the proxy paths, {"error": "..."}
    from the admin API, and {"message": ...} from the user API. Guessing one
    and dropping the others would turn a specific explanation into "HTTP 400".
    """
    if not isinstance(body, dict):
        return (str(body) if body else "", "")
    err = body.get("error")
    if isinstance(err, dict):
        return str(err.get("message", "")), str(err.get("code", "") or err.get("type", ""))
    if isinstance(err, str):
        return err, str(body.get("code", ""))
    if "message" in body:
        return str(body["message"]), str(body.get("code", ""))
    return "", ""
