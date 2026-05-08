"""Overlays Register — actuarial-judgement overlays.

Backed by `6_gov_overlays`. Each row is one judgement applied to a model
output for a quarter. Overlays are first-class objects: they have authors,
approvers, status, lineage to QRT cells, and a lifecycle (new / renewed
from prior / modified from prior / retired).

Endpoints:
- GET  /api/overlays                       → list (filterable by quarter, lob, status, model)
- GET  /api/overlays/{overlay_id}          → single overlay detail
- GET  /api/overlays/lineage/{overlay_id}  → lineage view (linked QRT cells)
- POST /api/overlays                       → create (status=draft or pending_approval)
- POST /api/overlays/{overlay_id}/approve  → approve (writes approver+approved_at, status=approved)
- POST /api/overlays/{overlay_id}/retire   → retire (status=retired)

The agent (Senior Reserving Actuary) cannot call POST endpoints — write paths
are gated to user-initiated requests only via the existing OBO middleware.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from databricks.sdk.service.sql import StatementParameterListItem
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from server.config import fqn, get_request_user
from server.sql import execute_query, execute_query_cached

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/overlays", tags=["overlays"])


# Magnitude-threshold approval routing. Any overlay greater than the
# `board_threshold` requires board-level sign-off; anything between
# `chief_threshold` and `board_threshold` requires Chief Actuary; anything
# below requires the senior-actuary signature only.
APPROVAL_THRESHOLDS = {
    "senior_actuary": 0.0,            # any magnitude
    "chief_actuary": 1_000_000.0,     # > 1m EUR
    "board": 10_000_000.0,            # > 10m EUR
}

VALID_STATUSES = {"draft", "pending_approval", "approved", "retired"}
VALID_DIRECTIONS = {"increase", "decrease"}
VALID_CATEGORIES = {
    "one_off_event", "methodology_judgement", "data_correction",
    "tail_extension", "expert_judgement_other",
}
VALID_LIFECYCLE = {"new", "renewed_from_prior", "modified_from_prior", "retired"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _required_approval_role(magnitude_eur: float) -> str:
    m = abs(magnitude_eur)
    if m >= APPROVAL_THRESHOLDS["board"]:
        return "board"
    if m >= APPROVAL_THRESHOLDS["chief_actuary"]:
        return "chief_actuary"
    return "senior_actuary"


# ── Read endpoints ──────────────────────────────────────────────────────────

@router.get("")
async def list_overlays(
    quarter: str | None = Query(None),
    line_of_business: str | None = Query(None),
    status: str | None = Query(None),
    model_name: str | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
):
    """List overlays with filters. Default sort: newest first."""
    where_parts: list[str] = []
    params: list[StatementParameterListItem] = []
    if quarter:
        where_parts.append("quarter = :q")
        params.append(StatementParameterListItem(name="q", value=quarter))
    if line_of_business:
        where_parts.append("line_of_business = :lob")
        params.append(StatementParameterListItem(name="lob", value=line_of_business))
    if status:
        where_parts.append("status = :st")
        params.append(StatementParameterListItem(name="st", value=status))
    if model_name:
        where_parts.append("model_name = :mn")
        params.append(StatementParameterListItem(name="mn", value=model_name))
    where_clause = ("WHERE " + " AND ".join(where_parts)) if where_parts else ""
    params.append(StatementParameterListItem(name="lim", value=str(limit), type="INT"))

    rows = await execute_query(
        f"SELECT * FROM {fqn('6_gov_overlays')} {where_clause} "
        f"ORDER BY created_at DESC LIMIT :lim",
        parameters=params,
    )
    return {"overlays": rows}


@router.get("/summary")
async def overlay_summary(quarter: str | None = Query(None)):
    """Aggregated counts and magnitudes by status / category — for the register header."""
    where = "WHERE quarter = :q" if quarter else ""
    params = [StatementParameterListItem(name="q", value=quarter)] if quarter else []

    by_status = await execute_query(
        f"SELECT status, COUNT(*) AS n, SUM(magnitude_eur) AS total_magnitude_eur "
        f"FROM {fqn('6_gov_overlays')} {where} GROUP BY status",
        parameters=params,
    )
    by_category = await execute_query(
        f"SELECT category, COUNT(*) AS n, SUM(magnitude_eur) AS total_magnitude_eur "
        f"FROM {fqn('6_gov_overlays')} {where} GROUP BY category",
        parameters=params,
    )
    by_lob = await execute_query(
        f"SELECT line_of_business, COUNT(*) AS n, SUM(magnitude_eur) AS total_magnitude_eur "
        f"FROM {fqn('6_gov_overlays')} {where} GROUP BY line_of_business",
        parameters=params,
    )
    return {
        "by_status": by_status,
        "by_category": by_category,
        "by_line_of_business": by_lob,
    }


@router.get("/{overlay_id}")
async def get_overlay(overlay_id: str):
    rows = await execute_query(
        f"SELECT * FROM {fqn('6_gov_overlays')} WHERE overlay_id = :id",
        parameters=[StatementParameterListItem(name="id", value=overlay_id)],
    )
    if not rows:
        raise HTTPException(404, "Overlay not found")
    return {"overlay": rows[0]}


@router.get("/lineage/{overlay_id}")
async def get_overlay_lineage(overlay_id: str):
    """Returns the linked QRT cells + any prior overlays in the lifecycle chain."""
    rows = await execute_query(
        f"SELECT overlay_id, quarter, line_of_business, magnitude_eur, direction, "
        f"  category, lifecycle_action, prior_overlay_id, linked_qrt_cells, status "
        f"FROM {fqn('6_gov_overlays')} WHERE overlay_id = :id",
        parameters=[StatementParameterListItem(name="id", value=overlay_id)],
    )
    if not rows:
        raise HTTPException(404, "Overlay not found")
    overlay = rows[0]

    # Walk the lifecycle chain backwards (renewed_from_prior / modified_from_prior)
    chain: list[dict[str, Any]] = [overlay]
    seen = {overlay_id}
    cur = overlay
    while cur.get("prior_overlay_id") and cur["prior_overlay_id"] not in seen:
        prior = await execute_query(
            f"SELECT overlay_id, quarter, line_of_business, magnitude_eur, direction, "
            f"  category, lifecycle_action, prior_overlay_id, status "
            f"FROM {fqn('6_gov_overlays')} WHERE overlay_id = :id",
            parameters=[StatementParameterListItem(name="id", value=cur["prior_overlay_id"])],
        )
        if not prior:
            break
        chain.append(prior[0])
        seen.add(prior[0]["overlay_id"])
        cur = prior[0]

    return {"overlay": overlay, "lifecycle_chain": chain}


# ── Write endpoints ─────────────────────────────────────────────────────────

class OverlayCreate(BaseModel):
    model_name: str
    quarter: str
    line_of_business: str
    accident_year: int | None = None
    magnitude_eur: float
    direction: str
    category: str
    rationale: str
    linked_qrt_cells: list[str] = []
    lifecycle_action: str = "new"
    prior_overlay_id: str | None = None
    submit_for_approval: bool = True


@router.post("")
async def create_overlay(req: OverlayCreate, request: Request):
    if req.direction not in VALID_DIRECTIONS:
        raise HTTPException(400, f"direction must be one of {sorted(VALID_DIRECTIONS)}")
    if req.category not in VALID_CATEGORIES:
        raise HTTPException(400, f"category must be one of {sorted(VALID_CATEGORIES)}")
    if req.lifecycle_action not in VALID_LIFECYCLE:
        raise HTTPException(400, f"lifecycle_action must be one of {sorted(VALID_LIFECYCLE)}")
    if req.lifecycle_action in {"renewed_from_prior", "modified_from_prior"} and not req.prior_overlay_id:
        raise HTTPException(400, "prior_overlay_id required for renewed/modified lifecycle actions")

    user = get_request_user(request)
    overlay_id = str(uuid.uuid4())
    now = _now_iso()
    status = "pending_approval" if req.submit_for_approval else "draft"
    required_role = _required_approval_role(req.magnitude_eur)

    # SQL parameters can't carry array literals, so build the linked_qrt_cells
    # as a literal in the statement.
    cells_lit = "array(" + ",".join("'" + c.replace("'", "''") + "'" for c in req.linked_qrt_cells) + ")"
    ay_lit = "NULL" if req.accident_year is None else str(int(req.accident_year))
    prior_lit = "NULL" if not req.prior_overlay_id else "'" + req.prior_overlay_id.replace("'", "''") + "'"

    params = [
        StatementParameterListItem(name="oid",     value=overlay_id),
        StatementParameterListItem(name="mn",      value=req.model_name),
        StatementParameterListItem(name="q",       value=req.quarter),
        StatementParameterListItem(name="lob",     value=req.line_of_business),
        StatementParameterListItem(name="mag",     value=str(req.magnitude_eur), type="DOUBLE"),
        StatementParameterListItem(name="dir",     value=req.direction),
        StatementParameterListItem(name="cat",     value=req.category),
        StatementParameterListItem(name="rat",     value=req.rationale),
        StatementParameterListItem(name="auth",    value=user),
        StatementParameterListItem(name="now",     value=now),
        StatementParameterListItem(name="st",      value=status),
        StatementParameterListItem(name="lif",     value=req.lifecycle_action),
    ]
    await execute_query(
        f"INSERT INTO {fqn('6_gov_overlays')} "
        "(overlay_id, model_name, quarter, line_of_business, accident_year, magnitude_eur, "
        " direction, category, rationale, author, created_at, approver, approved_at, status, "
        " linked_qrt_cells, lifecycle_action, prior_overlay_id) "
        f"VALUES (:oid, :mn, :q, :lob, {ay_lit}, :mag, :dir, :cat, :rat, :auth, "
        f"        CAST(:now AS TIMESTAMP), NULL, NULL, :st, {cells_lit}, :lif, {prior_lit})",
        parameters=params,
    )

    return {
        "overlay_id": overlay_id,
        "status": status,
        "required_approval_role": required_role,
    }


class OverlayApprove(BaseModel):
    comments: str | None = None


@router.post("/{overlay_id}/approve")
async def approve_overlay(overlay_id: str, req: OverlayApprove, request: Request):
    rows = await execute_query(
        f"SELECT status, magnitude_eur FROM {fqn('6_gov_overlays')} WHERE overlay_id = :id",
        parameters=[StatementParameterListItem(name="id", value=overlay_id)],
    )
    if not rows:
        raise HTTPException(404, "Overlay not found")
    if rows[0]["status"] not in {"draft", "pending_approval"}:
        raise HTTPException(409, f"Cannot approve overlay in status '{rows[0]['status']}'")

    user = get_request_user(request)
    now = _now_iso()
    await execute_query(
        f"UPDATE {fqn('6_gov_overlays')} "
        "SET status = 'approved', approver = :user, approved_at = CAST(:now AS TIMESTAMP) "
        "WHERE overlay_id = :id",
        parameters=[
            StatementParameterListItem(name="user", value=user),
            StatementParameterListItem(name="now", value=now),
            StatementParameterListItem(name="id", value=overlay_id),
        ],
    )
    return {"overlay_id": overlay_id, "status": "approved", "approver": user, "approved_at": now}


@router.post("/{overlay_id}/retire")
async def retire_overlay(overlay_id: str, request: Request):
    rows = await execute_query(
        f"SELECT status FROM {fqn('6_gov_overlays')} WHERE overlay_id = :id",
        parameters=[StatementParameterListItem(name="id", value=overlay_id)],
    )
    if not rows:
        raise HTTPException(404, "Overlay not found")

    await execute_query(
        f"UPDATE {fqn('6_gov_overlays')} SET status = 'retired' WHERE overlay_id = :id",
        parameters=[StatementParameterListItem(name="id", value=overlay_id)],
    )
    return {"overlay_id": overlay_id, "status": "retired"}


# ── Helper: linked QRT cell → overlays (used by Audit Panel) ────────────────

@router.get("/by-qrt-cell/lookup")
async def overlays_by_qrt_cell(
    cell_prefix: str = Query(..., description="QRT cell prefix to match, e.g. 's0501.R0210'"),
    quarter: str | None = Query(None),
):
    """Return every overlay whose linked_qrt_cells contains an entry beginning with cell_prefix."""
    where = ["array_contains(transform(linked_qrt_cells, c -> startswith(c, :pre)), true)"]
    params = [StatementParameterListItem(name="pre", value=cell_prefix)]
    if quarter:
        where.append("quarter = :q")
        params.append(StatementParameterListItem(name="q", value=quarter))
    rows = await execute_query(
        f"SELECT overlay_id, quarter, model_name, line_of_business, magnitude_eur, "
        f"  direction, category, status, author, approver "
        f"FROM {fqn('6_gov_overlays')} "
        f"WHERE {' AND '.join(where)} "
        f"ORDER BY created_at DESC LIMIT 50",
        parameters=params,
    )
    return {"overlays": rows}
