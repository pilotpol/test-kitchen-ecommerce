"""HTTP plumbing shared by every namespace."""

from __future__ import annotations

import json
from typing import Any, Dict, Iterator, Optional

import httpx

from .auth import Auth
from .errors import TimeoutError_, from_response

DEFAULT_TIMEOUT = 60.0


class Transport:
    """Sends requests and turns failures into this package's errors."""

    def __init__(
        self,
        base_url: str,
        auth: Auth,
        *,
        timeout: float = DEFAULT_TIMEOUT,
        client: Optional[httpx.Client] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.auth = auth
        self.timeout = timeout
        # An injected client is how a caller supplies their own proxy, TLS
        # settings or test double without this package growing a setting for
        # each one.
        self._client = client or httpx.Client(timeout=timeout)
        self._owns_client = client is None

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def _headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers = {"Content-Type": "application/json", **self.auth.headers()}
        if extra:
            headers.update(extra)
        return headers

    def request(
        self,
        method: str,
        path: str,
        *,
        body: Any = None,
        params: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
    ) -> Any:
        url = f"{self.base_url}{path}"
        try:
            resp = self._client.request(
                method,
                url,
                json=body,
                params=params,
                headers=self._headers(headers),
                timeout=timeout or self.timeout,
            )
        except httpx.TimeoutException as exc:
            raise TimeoutError_(f"{method} {path} timed out after {timeout or self.timeout}s") from exc

        if resp.status_code >= 400:
            raise from_response(resp.status_code, _json_or_text(resp))
        if not resp.content:
            return None
        return _json_or_text(resp)

    def stream_sse(
        self,
        path: str,
        *,
        body: Any = None,
        timeout: Optional[float] = None,
    ) -> Iterator[Dict[str, Any]]:
        """Yield decoded `data:` payloads from a server-sent event stream.

        Yields dicts. The terminal `[DONE]` sentinel is consumed rather than
        yielded, because it is a framing detail of the protocol and not
        something a caller should have to recognise.
        """
        url = f"{self.base_url}{path}"
        headers = self._headers({"Accept": "text/event-stream"})
        try:
            with self._client.stream(
                "POST", url, json=body, headers=headers, timeout=timeout or self.timeout
            ) as resp:
                if resp.status_code >= 400:
                    resp.read()
                    raise from_response(resp.status_code, _json_or_text(resp))
                for line in resp.iter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    payload = line[len("data:") :].strip()
                    if payload == "[DONE]":
                        return
                    try:
                        yield json.loads(payload)
                    except json.JSONDecodeError:
                        # A frame we cannot parse is skipped rather than
                        # raised: one malformed chunk should not discard the
                        # answer already streamed.
                        continue
        except httpx.TimeoutException as exc:
            raise TimeoutError_(f"stream {path} timed out") from exc


def _json_or_text(resp: httpx.Response) -> Any:
    try:
        return resp.json()
    except ValueError:
        return resp.text
