"""Python client for the PromptServe AI Gateway.

Calling the gateway rather than a model provider directly is what puts a
request through the harness: guardrails and PII masking on the way in,
knowledge base retrieval and the tool registry during, and tracing, cost
accounting and audit on the way out. An agent named with `agent_model` gets all
of it; a plain model name gets the governance without the agent.
"""

from .agents import TERMINAL_STATUSES
from .auth import Auth, ChannelAuth, ChannelUserAuth, MasterAuth
from .chat import AGENT_MODEL_PREFIX, RunSuspended, agent_model, collect_text
from .client import PromptServ
from .errors import (
    APIError,
    AuthError,
    NotFoundError,
    PromptServError,
    RateLimitError,
    TimeoutError_,
)
from .webhooks import SignatureError, verify

__version__ = "0.1.0"

__all__ = [
    "PromptServ",
    "Auth",
    "ChannelAuth",
    "ChannelUserAuth",
    "MasterAuth",
    "agent_model",
    "collect_text",
    "RunSuspended",
    "AGENT_MODEL_PREFIX",
    "TERMINAL_STATUSES",
    "verify",
    "SignatureError",
    "PromptServError",
    "APIError",
    "AuthError",
    "NotFoundError",
    "RateLimitError",
    "TimeoutError_",
    "__version__",
]
