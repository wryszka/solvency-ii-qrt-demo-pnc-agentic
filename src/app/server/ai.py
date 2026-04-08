"""Foundation Model API wrapper with MLflow Tracing and AI Gateway support.

Tries Claude Sonnet (via Databricks external model endpoint) first,
falls back to Meta Llama 3.3 70B Instruct.

All calls are traced via MLflow for Mosaic AI observability.
"""

import logging
import os
from dataclasses import dataclass

from databricks.sdk import WorkspaceClient
from databricks.sdk.service.serving import ChatMessage, ChatMessageRole

from server.config import get_workspace_client

logger = logging.getLogger(__name__)

# MLflow tracing — initialise if available
try:
    import mlflow
    mlflow.set_tracking_uri("databricks")
    _MLFLOW_AVAILABLE = True
    logger.info("MLflow tracing enabled")
except ImportError:
    _MLFLOW_AVAILABLE = False
    logger.info("MLflow not available — tracing disabled")

# AI Gateway endpoint (if configured, routes through gateway for content filtering)
AI_GATEWAY_ENDPOINT = os.getenv("AI_GATEWAY_ENDPOINT", "")

# Model preference order: Gateway first (if set), then Sonnet, then Llama
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
        return ep is not None
    except Exception:
        return False


def _find_endpoint(client: WorkspaceClient) -> str:
    """Find the first available model endpoint."""
    global _active_endpoint
    if _active_endpoint:
        return _active_endpoint

    # Prefer AI Gateway if configured
    if AI_GATEWAY_ENDPOINT:
        if _probe_endpoint(client, AI_GATEWAY_ENDPOINT):
            logger.info("Using AI Gateway endpoint: %s", AI_GATEWAY_ENDPOINT)
            _active_endpoint = AI_GATEWAY_ENDPOINT
            return AI_GATEWAY_ENDPOINT

    for endpoint in MODEL_ENDPOINTS:
        if _probe_endpoint(client, endpoint):
            logger.info("Using model endpoint: %s", endpoint)
            _active_endpoint = endpoint
            return endpoint

    raise RuntimeError(
        f"No model endpoint available. Tried: {', '.join(MODEL_ENDPOINTS)}. "
        "Please enable a Foundation Model endpoint in your workspace."
    )


def _call_llm(system_prompt: str, user_prompt: str, agent_name: str = "unknown") -> AiResponse:
    """Call Foundation Model API (synchronous, runs in thread)."""
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


def _call_llm_traced(system_prompt: str, user_prompt: str, agent_name: str = "unknown") -> AiResponse:
    """Call LLM with MLflow tracing if available."""
    if _MLFLOW_AVAILABLE:
        with mlflow.start_span(name=f"agent.{agent_name}") as span:
            span.set_inputs({
                "agent": agent_name,
                "system_prompt_length": len(system_prompt),
                "user_prompt_length": len(user_prompt),
            })
            result = _call_llm(system_prompt, user_prompt, agent_name)
            span.set_outputs({
                "model_used": result.model_used,
                "input_tokens": result.input_tokens,
                "output_tokens": result.output_tokens,
                "response_length": len(result.text),
            })
            return result
    else:
        return _call_llm(system_prompt, user_prompt, agent_name)


async def generate_review(
    system_prompt: str,
    user_prompt: str,
    agent_name: str = "actuarial_review",
) -> AiResponse:
    """Call Foundation Model API with the given prompts. Traced via MLflow."""
    import asyncio
    return await asyncio.to_thread(_call_llm_traced, system_prompt, user_prompt, agent_name)


def reset_endpoint_cache():
    """Reset cached endpoint (for testing or after config change)."""
    global _active_endpoint
    _active_endpoint = None
