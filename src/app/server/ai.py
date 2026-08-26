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

# Model preference order — configurable via the FM_MODEL_ENDPOINTS env var
# (comma-separated list, declared in app.yaml from bundle var). Empty/unset
# falls back to the Claude-then-Llama preference that works on standard
# Databricks workspaces.
#
# For free-edition Databricks workspaces the default Foundation Model endpoint
# is `databricks-gpt-oss-120b` (GPT-OSS-120B from OpenAI) — set
# `fm_model_endpoints: "databricks-gpt-oss-120b"` in databricks.yml to use it.
#
# The app probes each endpoint in order and uses the first one that's READY.
_FM_DEFAULT = [
    "databricks-claude-sonnet-5",
    "databricks-claude-sonnet-4",
    "databricks-meta-llama-3-3-70b-instruct",
]
_FM_ENV = os.getenv("FM_MODEL_ENDPOINTS", "").strip()
MODEL_ENDPOINTS = [s.strip() for s in _FM_ENV.split(",") if s.strip()] if _FM_ENV else _FM_DEFAULT

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

    _msgs = [
        ChatMessage(role=ChatMessageRole.SYSTEM, content=system_prompt),
        ChatMessage(role=ChatMessageRole.USER, content=user_prompt),
    ]
    # Newer Claude models (Sonnet 5 / Opus 4.x) reject the temperature param;
    # older models + Llama honour it. Try with, fall back without on that error.
    try:
        response = client.serving_endpoints.query(
            name=endpoint, messages=_msgs, max_tokens=2048, temperature=0.2,
        )
    except Exception as exc:
        if "temperature" in str(exc).lower():
            response = client.serving_endpoints.query(
                name=endpoint, messages=_msgs, max_tokens=2048,
            )
        else:
            raise

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


# NOTE: A raw-HTTP tool-calling helper (`call_with_tools`) used to live here. It
# extracted the bearer token by hand and hit the invocations API directly. It had
# no callers — agentic tool-calling now lives in the Mosaic AI Agent Framework
# agent (src/07_AI_Agents/register_agents.py), which does tool-calling natively
# over governed UC functions. The dead helper was removed (security review 5.3):
# nothing in the app should hand-extract auth tokens.


def reset_endpoint_cache():
    """Reset cached endpoint (for testing or after config change)."""
    global _active_endpoint
    _active_endpoint = None
