"""How a request identifies itself.

The gateway accepts three modes, and the difference matters for more than
access: a request that carries the end user's token is attributed to that user
in the audit log and can be scoped by tools that answer per-user, while one
that carries only a channel key is attributed to the channel.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Union


@dataclass(frozen=True)
class ChannelAuth:
    """System-to-system: one key, no end user."""

    channel_api_key: str

    def headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.channel_api_key}"}


@dataclass(frozen=True)
class ChannelUserAuth:
    """A channel acting for a signed-in user.

    Both are sent: the channel key says which application this is, the user
    token says who it is for. Tools that scope by caller read the second one,
    so sending only the channel key makes them answer "no user identity was
    forwarded" rather than failing outright - which reads as the tool being
    broken.
    """

    channel_api_key: str
    user_jwt: str

    def headers(self) -> Dict[str, str]:
        return {
            "X-Channel-Key": self.channel_api_key,
            "Authorization": f"Bearer {self.user_jwt}",
        }


@dataclass(frozen=True)
class MasterAuth:
    """The deployment's master key. Required for /admin, and only for /admin.

    Do not ship this to a browser or a customer application: it is the key to
    every tenant on the gateway, not a scoped one.
    """

    master_key: str

    def headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.master_key}"}


Auth = Union[ChannelAuth, ChannelUserAuth, MasterAuth]
