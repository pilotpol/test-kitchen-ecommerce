"""The entry point."""

from __future__ import annotations

from typing import Optional

import httpx

from .agents import AgentsNamespace
from .auth import Auth, ChannelAuth, ChannelUserAuth, MasterAuth
from .chat import ChatNamespace
from .transport import DEFAULT_TIMEOUT, Transport
from .workflows import WorkflowsNamespace


class PromptServ:
    """Client for the PromptServe AI Gateway.

        from promptserv import PromptServ, ChannelAuth, agent_model

        client = PromptServ("https://gateway.example.com", ChannelAuth(API_KEY))
        answer = client.chat.create(
            model=agent_model("watson"),
            messages=[{"role": "user", "content": "what is the leave policy?"}],
        )

    Usable as a context manager, which closes the underlying HTTP connections:

        with PromptServ(url, auth) as client:
            ...
    """

    def __init__(
        self,
        base_url: str,
        auth: Auth,
        *,
        timeout: float = DEFAULT_TIMEOUT,
        http_client: Optional[httpx.Client] = None,
    ):
        self._transport = Transport(base_url, auth, timeout=timeout, client=http_client)
        self.chat = ChatNamespace(self._transport)
        self.agents = AgentsNamespace(self._transport)
        self.workflows = WorkflowsNamespace(self._transport)

    @property
    def auth(self) -> Auth:
        return self._transport.auth

    def close(self) -> None:
        self._transport.close()

    def __enter__(self) -> "PromptServ":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()


__all__ = ["PromptServ", "ChannelAuth", "ChannelUserAuth", "MasterAuth"]
