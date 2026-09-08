"""
LeadWeave Python SDK.

Official client library for the LeadWeave WhatsApp API Gateway.

Example usage::

    from leadweave import LeadWeaveClient

    client = LeadWeaveClient(
        base_url="http://localhost:2785",
        api_key="owa_k1_…",
    )

    client.sessions.start("my-session")
    result = client.messages.send_text("my-session", {
        "chatId": "628123456789@c.us",
        "text": "Hello from the LeadWeave Python SDK!",
    })
    print(result["messageId"])
"""

from __future__ import annotations

from .client import LeadWeaveClient
from .errors import (
    LeadWeaveApiError,
    LeadWeaveAuthError,
    LeadWeaveConflictError,
    LeadWeaveError,
    LeadWeaveForbiddenError,
    LeadWeaveNotFoundError,
    LeadWeaveNotImplementedError,
    LeadWeaveServiceUnavailableError,
    LeadWeaveRateLimitError,
    LeadWeaveTimeoutError,
)

__all__ = [
    "LeadWeaveClient",
    "LeadWeaveError",
    "LeadWeaveApiError",
    "LeadWeaveAuthError",
    "LeadWeaveForbiddenError",
    "LeadWeaveNotFoundError",
    "LeadWeaveConflictError",
    "LeadWeaveRateLimitError",
    "LeadWeaveNotImplementedError",
    "LeadWeaveServiceUnavailableError",
    "LeadWeaveTimeoutError",
]
