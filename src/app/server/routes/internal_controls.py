"""Internal Controls — Pillar 2 page.

Surfaces the AI guardrails as a 12-control × 7-layer matrix, the live audit
trail of agent calls, the count of forbidden-pattern attempts blocked, and
the architectural assertion that "AI cannot approve".
"""

from __future__ import annotations

import logging
from typing import Any

from databricks.sdk.service.sql import StatementParameterListItem
from fastapi import APIRouter, HTTPException

from server.config import fqn
from server.guardrails import FORBIDDEN_PATTERNS
from server.sql import execute_query, execute_query_cached

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/internal-controls", tags=["internal-controls"])


# 12 controls × 7 layers — described once, surfaced as a matrix.
CONTROLS: list[dict[str, Any]] = [
    {"id": "C01", "layer": "Input",          "control": "Rate limiting",
     "description": "Per-user, per-hour throttle on AI calls.",
     "implementation": "server/guardrails.py _check_rate_limit"},
    {"id": "C02", "layer": "Input",          "control": "Input size validation",
     "description": "Refuse oversized prompts (> 50K chars).",
     "implementation": "validate_input MAX_INPUT_CHARS"},
    {"id": "C03", "layer": "Input",          "control": "Empty/short prompt rejection",
     "description": "Reject prompts that are too short to be substantive.",
     "implementation": "validate_input min length"},

    {"id": "C04", "layer": "Identity",       "control": "OBO user attribution",
     "description": "Every API call is logged with the actual end-user from X-Forwarded-* headers, not the SP.",
     "implementation": "server/config.py get_request_user + audit middleware"},
    {"id": "C05", "layer": "Identity",       "control": "Segregation of duties",
     "description": "Submitter cannot be the same identity as the reviewer for QRT approvals.",
     "implementation": "server/routes/approvals.py review_qrt"},

    {"id": "C06", "layer": "Output",         "control": "Required-section validation",
     "description": "Reject outputs missing required sections (Exec Summary, Key Metrics, Recommendation).",
     "implementation": "validate_output REQUIRED_SECTIONS"},
    {"id": "C07", "layer": "Output",         "control": "Forbidden-pattern blocking",
     "description": "Block outputs containing approval/impersonation phrases.",
     "implementation": "validate_output FORBIDDEN_PATTERNS"},
    {"id": "C08", "layer": "Output",         "control": "PII detection + flagging",
     "description": "Flag named individuals, emails, phone numbers, LEIs in AI outputs.",
     "implementation": "validate_output PII_PATTERNS"},
    {"id": "C09", "layer": "Output",         "control": "Output truncation",
     "description": "Cap output length at 15K chars; truncate gracefully.",
     "implementation": "truncate_output MAX_OUTPUT_CHARS"},

    {"id": "C10", "layer": "Persistence",    "control": "Audit-record enrichment",
     "description": "Every guardrail verdict is attached to the persisted audit row.",
     "implementation": "GuardrailVerdict.to_dict on every AI call"},

    {"id": "C11", "layer": "Architecture",   "control": "AI cannot approve",
     "description": "Approval workflow is human-only. AI agents are read-only over regulatory tables.",
     "implementation": "approvals.review_qrt requires human X-Forwarded-User"},

    {"id": "C12", "layer": "Catalog",        "control": "UC GRANT-based access",
     "description": "App SP has SELECT on raw/staging/gold and INSERT/UPDATE only on 6_ai_approvals + drafts.",
     "implementation": "Unity Catalog GRANTs (deploy_demo.sh)"},
]


@router.get("/matrix")
async def matrix():
    """Return the 12-control matrix grouped by layer."""
    layers: dict[str, list[dict[str, Any]]] = {}
    for c in CONTROLS:
        layers.setdefault(c["layer"], []).append(c)
    return {
        "layers": [{"layer": l, "controls": cs} for l, cs in layers.items()],
        "total_controls": len(CONTROLS),
        "layer_count": len(layers),
        "forbidden_patterns": [str(p) for p in FORBIDDEN_PATTERNS],
    }


@router.get("/audit")
async def audit(limit: int = 50):
    """Return the most recent agent calls from the audit table.

    The audit table is populated by an explicit insert from the audit
    middleware (only on /api/* paths). If the table doesn't exist yet, this
    returns an empty list rather than 500 — matching the rest of the app's
    posture against missing infrastructure.
    """
    try:
        rows = await execute_query(
            f"SELECT * FROM {fqn('5_mon_agent_audit')} ORDER BY called_at DESC LIMIT :lim",
            parameters=[StatementParameterListItem(name="lim", value=str(limit), type="INT")],
        )
        return {"calls": rows}
    except Exception:
        return {"calls": [], "note": "Audit table not yet populated."}


@router.get("/blocked-counter")
async def blocked_counter():
    """Return aggregate counts of guardrail blocks from the audit table."""
    try:
        rows = await execute_query_cached(
            f"SELECT pattern_hits AS hits, forbidden_blocks AS blocks, pii_flags AS pii "
            f"FROM (SELECT 0 AS pattern_hits, 0 AS forbidden_blocks, 0 AS pii_flags) WHERE 1=0",
            ttl_seconds=15,
        )
    except Exception:
        rows = []

    # Pull forbidden-pattern hits from the agent audit table if it exists.
    try:
        a_rows = await execute_query(
            f"SELECT "
            f"  SUM(CASE WHEN status = 'blocked_forbidden' THEN 1 ELSE 0 END) AS forbidden, "
            f"  SUM(CASE WHEN status = 'pii_flagged' THEN 1 ELSE 0 END) AS pii, "
            f"  SUM(CASE WHEN status = 'rate_limited' THEN 1 ELSE 0 END) AS rate_limited, "
            f"  SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS errors, "
            f"  COUNT(*) AS total "
            f"FROM {fqn('5_mon_agent_audit')}"
        )
        if a_rows:
            r = a_rows[0]
            return {
                "forbidden_blocks": int(r.get("forbidden", 0) or 0),
                "pii_flags": int(r.get("pii", 0) or 0),
                "rate_limited": int(r.get("rate_limited", 0) or 0),
                "errors": int(r.get("errors", 0) or 0),
                "total_calls": int(r.get("total", 0) or 0),
            }
    except Exception:
        pass
    return {"forbidden_blocks": 0, "pii_flags": 0, "rate_limited": 0, "errors": 0, "total_calls": 0}


@router.get("/architecture-assertion")
async def architecture_assertion():
    """Return the architectural invariants surfaced on the page."""
    return {
        "invariants": [
            {
                "title": "AI cannot approve a QRT",
                "detail": "Approval routes require a human X-Forwarded-User; AI agents have no path to approve.",
                "implementation": "server/routes/approvals.py review_qrt",
            },
            {
                "title": "AI is read-only against regulatory tables",
                "detail": "App SP has SELECT on raw/staging/gold layers; only 6_ai_* tables (approvals, drafts, narratives) are writable.",
                "implementation": "Unity Catalog GRANTs",
            },
            {
                "title": "Every AI output is hashed + audited",
                "detail": "AFR + SFCR drafts and ORSA narratives carry SHA-256 content hashes; every API call logs user + duration.",
                "implementation": "audit middleware (app.py) + content_hash columns in gold_*_drafts tables",
            },
        ]
    }
