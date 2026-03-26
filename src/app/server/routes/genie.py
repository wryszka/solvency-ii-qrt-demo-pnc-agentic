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

    # Extract text and query results from attachments
    texts = []
    query = None
    columns = []
    rows = []

    if response.attachments:
        for att in response.attachments:
            if att.text:
                texts.append(att.text.content)
            if att.query:
                query = att.query.query
                if att.query.columns:
                    columns = [c.name for c in att.query.columns]
                if att.query.result and att.query.result.row_count:
                    # Try to get the data
                    try:
                        result = w.genie.get_message_query_result(
                            space_id=space_id,
                            conversation_id=response.conversation_id,
                            message_id=response.id,
                        )
                        if result.statement_response and result.statement_response.result:
                            data = result.statement_response.result.data_array
                            if data:
                                rows = [list(r) for r in data[:50]]  # Cap at 50 rows
                    except Exception:
                        pass

    return {
        "answer": "\n".join(texts) if texts else "Genie returned no text response.",
        "sql": query,
        "columns": columns,
        "rows": rows,
        "conversation_id": response.conversation_id,
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
