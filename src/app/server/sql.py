import asyncio
import logging
import time
from typing import Any

from databricks.sdk.service.sql import StatementState, StatementParameterListItem

from server.config import get_workspace_client, get_warehouse_id

logger = logging.getLogger(__name__)

# Simple in-memory TTL cache for hot read-only queries.
# Key: SQL text (we never cache parameterised queries to avoid leakage / mismatches).
# Value: (expiry_epoch_seconds, rows)
_query_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}
_cache_max_entries = 256


def _execute_sync(
    sql: str,
    parameters: list[StatementParameterListItem] | None = None,
) -> list[dict[str, Any]]:
    client = get_workspace_client()
    warehouse_id = get_warehouse_id()
    logger.debug("SQL: %s", sql[:200])

    kwargs: dict[str, Any] = {
        "statement": sql,
        "warehouse_id": warehouse_id,
        "wait_timeout": "50s",
    }
    if parameters:
        kwargs["parameters"] = parameters

    response = client.statement_execution.execute_statement(**kwargs)

    if response.status and response.status.state == StatementState.FAILED:
        error_msg = response.status.error.message if response.status.error else "Unknown"
        raise RuntimeError(f"SQL failed: {error_msg}")

    if not response.manifest or not response.manifest.schema or not response.manifest.schema.columns:
        return []

    columns = [col.name for col in response.manifest.schema.columns]
    rows: list[dict[str, Any]] = []

    if response.result and response.result.data_array:
        for row_data in response.result.data_array:
            rows.append(dict(zip(columns, row_data)))

    if response.result and response.result.external_links:
        for link in response.result.external_links:
            chunk = client.statement_execution.get_statement_result_chunk_n(
                statement_id=response.statement_id,
                chunk_index=link.chunk_index,
            )
            if chunk.data_array:
                for row_data in chunk.data_array:
                    rows.append(dict(zip(columns, row_data)))

    return rows


async def execute_query(
    sql: str,
    parameters: list[StatementParameterListItem] | None = None,
) -> list[dict[str, Any]]:
    return await asyncio.to_thread(_execute_sync, sql, parameters)


async def execute_query_cached(
    sql: str,
    ttl_seconds: float = 30.0,
) -> list[dict[str, Any]]:
    """Run a read-only query, returning cached rows if still within TTL.

    Only use for queries that are safe to serve slightly stale (e.g. monitoring
    dashboards re-rendered every few seconds). Parameterised queries should use
    execute_query directly.
    """
    now = time.monotonic()
    cached = _query_cache.get(sql)
    if cached and cached[0] > now:
        return cached[1]
    rows = await asyncio.to_thread(_execute_sync, sql, None)
    # Bound cache size — drop oldest entries if we exceed the cap
    if len(_query_cache) >= _cache_max_entries:
        oldest_key = min(_query_cache, key=lambda k: _query_cache[k][0])
        _query_cache.pop(oldest_key, None)
    _query_cache[sql] = (now + ttl_seconds, rows)
    return rows


def invalidate_cache():
    """Clear the query cache (e.g. after a write)."""
    _query_cache.clear()
