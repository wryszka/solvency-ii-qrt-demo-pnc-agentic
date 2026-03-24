"""Foundation Model API wrapper for actuarial review generation.

Tries Claude Sonnet (via Databricks external model endpoint) first,
falls back to Meta Llama 3.3 70B Instruct.
"""

import logging
from dataclasses import dataclass

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.serving import ChatMessage, ChatMessageRole

from server.config import get_workspace_client

logger = logging.getLogger(__name__)

# Model preference order: Sonnet first, Llama fallback
MODEL_ENDPOINTS = [
    "databricks-claude-sonnet-4",
    "databricks-claude-3-7-sonnet",
    "databricks-meta-llama-3-3-70b-instruct",
]

_active_endpoint: str | None = None


@dataclass
class AiResponse:
    text: str
    model_used: str
    input_tokens: int
    output_tokens: int


def _probe_endpoint(client: WorkspaceClient, endpoint: str) -> bool:
    """Check if a serving endpoint exists and is ready."""
    try:
        ep = client.serving_endpoints.get(endpoint)
        if ep.state and ep.state.ready == "READY":
            return True
        # Some endpoints don't have state but still work (external models)
        return ep is not None
    except Exception:
        return False


def _find_endpoint(client: WorkspaceClient) -> str:
    """Find the first available model endpoint."""
    global _active_endpoint
    if _active_endpoint:
        return _active_endpoint

    for endpoint in MODEL_ENDPOINTS:
        if _probe_endpoint(client, endpoint):
            logger.info("Using model endpoint: %s", endpoint)
            _active_endpoint = endpoint
            return endpoint

    raise RuntimeError(
        f"No model endpoint available. Tried: {', '.join(MODEL_ENDPOINTS)}. "
        "Please enable a Foundation Model endpoint in your workspace."
    )


async def generate_review(system_prompt: str, user_prompt: str) -> AiResponse:
    """Call Foundation Model API with the given prompts."""
    import asyncio

    def _call() -> AiResponse:
        client = get_workspace_client()
        endpoint = _find_endpoint(client)

        response = client.serving_endpoints.query(
            name=endpoint,
            messages=[
                ChatMessage(role=ChatMessageRole.SYSTEM, content=system_prompt),
                ChatMessage(role=ChatMessageRole.USER, content=user_prompt),
            ],
            max_tokens=2048,
            temperature=0.2,
        )

        text = ""
        if response.choices:
            msg = response.choices[0].message
            if msg:
                text = msg.content or ""

        input_tokens = 0
        output_tokens = 0
        if response.usage:
            input_tokens = response.usage.prompt_tokens or 0
            output_tokens = response.usage.completion_tokens or 0

        return AiResponse(
            text=text,
            model_used=endpoint,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
        )

    return await asyncio.to_thread(_call)


def reset_endpoint_cache():
    """Reset cached endpoint (for testing or after config change)."""
    global _active_endpoint
    _active_endpoint = None
