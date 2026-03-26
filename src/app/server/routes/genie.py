"""Genie space integration — query data via natural language."""

import logging
import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server.config import get_workspace_client, get_genie_space_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/genie", tags=["genie"])


class GenieQuestion(BaseModel):
    question: str


def _query_genie_sync(question: str) -> dict:
    """Call Genie synchronously (runs in thread)."""
    w = get_workspace_client()
    space_id = get_genie_space_id()

    response = w.genie.start_conversation_and_wait(
        space_id=space_id,
        content=question,
    )

    texts = []
    query_sql = None
    columns = []
    rows = []

    if response.attachments:
        for att in response.attachments:
            # Text attachment
            if att.text:
                try:
                    texts.append(att.text.content)
                except Exception:
                    pass

            # Query attachment — extract SQL and try to get results
            if att.query:
                try:
                    query_sql = getattr(att.query, 'query', None) or getattr(att.query, 'sql', None)
                except Exception:
                    pass

                # Try to get the query result data
                try:
                    result = w.genie.get_message_query_result(
                        space_id=space_id,
                        conversation_id=response.conversation_id,
                        message_id=response.id,
                    )
                    # Extract columns and rows from the statement response
                    sr = result.statement_response
                    if sr and sr.manifest and sr.manifest.schema and sr.manifest.schema.columns:
                        columns = [c.name for c in sr.manifest.schema.columns]
                    if sr and sr.result and sr.result.data_array:
                        rows = [list(r) for r in sr.result.data_array[:50]]
                except Exception as e:
                    logger.debug("Could not get query result: %s", e)

    return {
        "answer": "\n".join(texts) if texts else "Query executed successfully." if rows else "No response from Genie.",
        "sql": query_sql,
        "columns": columns,
        "rows": rows,
        "conversation_id": getattr(response, 'conversation_id', None),
    }


@router.post("/ask")
async def ask_genie(req: GenieQuestion):
    """Send a natural language question to the Genie space."""
    if not req.question or len(req.question.strip()) < 3:
        raise HTTPException(400, "Question too short")

    try:
        result = await asyncio.to_thread(_query_genie_sync, req.question)
        return result
    except Exception as exc:
        logger.exception("Genie query failed")
        raise HTTPException(500, f"Genie query failed: {str(exc)}") from exc
