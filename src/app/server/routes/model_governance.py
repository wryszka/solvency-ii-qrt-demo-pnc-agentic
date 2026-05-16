"""Model Governance — Pillar 2 page.

- /api/model-governance/registry         → registered models + versions + aliases
- /api/model-governance/comparison       → Champion vs Challenger SCR side-by-side
- /api/model-governance/runs             → audit trail of every model run with hashes
- /api/model-governance/approvals        → list approval decisions
- /api/model-governance/approvals  POST  → record an approval/rejection (stub — does not flip alias)
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from databricks.sdk.service.sql import StatementParameterListItem
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from server.config import fqn, get_request_user, get_workspace_client
from server.sql import execute_query, execute_query_cached

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/model-governance", tags=["model-governance"])


# ── Bootstrap ───────────────────────────────────────────────────────────────

async def _ensure_tables() -> None:
    await execute_query(
        f"CREATE TABLE IF NOT EXISTS {fqn('6_ai_model_approvals')} ("
        " approval_id STRING, model_name STRING, model_version STRING,"
        " decision STRING, comments STRING,"
        " decided_at TIMESTAMP, decided_by STRING)"
    )
    await execute_query(
        f"CREATE TABLE IF NOT EXISTS {fqn('6_ai_model_runs')} ("
        " run_id STRING, model_name STRING, model_version STRING,"
        " input_period STRING, input_hash STRING, output_hash STRING,"
        " output_summary_json STRING, ran_at TIMESTAMP, ran_by STRING)"
    )


# ── Routes ──────────────────────────────────────────────────────────────────

@router.get("/registry")
async def registry():
    """Return registered models + versions from Unity Catalog (best-effort)."""
    try:
        from server.config import get_catalog, get_schema
        catalog = get_catalog()
        schema = get_schema()
        full = f"{catalog}.{schema}.standard_formula"
        try:
            client = get_workspace_client()
            model = client.registered_models.get(full_name=full, include_aliases=True)
            versions: list[dict[str, Any]] = []
            for v in client.model_versions.list(full_name=full):
                versions.append({
                    "version": v.version,
                    "comment": v.comment,
                    "created_at": str(v.created_at) if v.created_at else None,
                    "created_by": v.created_by,
                    "status": str(v.status) if v.status else None,
                })
            aliases = []
            for a in (model.aliases or []):
                aliases.append({"alias_name": a.alias_name, "version_num": a.version_num})
            return {"models": [{
                "full_name": full,
                "comment": model.comment,
                "owner": model.owner,
                "aliases": aliases,
                "versions": versions,
            }]}
        except Exception as exc:
            logger.warning("UC registry read failed: %s", exc)
            return {"models": [{"full_name": full, "aliases": [], "versions": [], "error": str(exc)}]}
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc


@router.get("/comparison")
async def comparison():
    """Champion vs Challenger SCR comparison for the latest period.

    Calibration parameters for both versions live in the governed UC table
    `0_cfg_sf_calibrations` (same values logged as MLflow run params at
    registration time; the table is the queryable source-of-truth that the
    app's service principal can read via the warehouse). Module charges
    come from `2_stg_scr_results`. The standard-formula aggregation runs
    in-process under each parameter set.
    """
    import math
    from server.config import get_catalog, get_schema
    try:
        catalog = get_catalog(); schema = get_schema()
        model_name = f"{catalog}.{schema}.standard_formula"

        # ── 1. Pull calibrations from the governed UC table ─────────────
        calib_rows = await execute_query(f"""
            SELECT version_alias, model_version, calibration_year,
                   op_risk_factor, lac_dt_cap, bscr_market_nl_corr,
                   bscr_nl_prem_cat_corr, spread_corr, change_summary
            FROM {fqn('0_cfg_sf_calibrations')}
            ORDER BY model_version
        """)
        if len(calib_rows) < 2:
            raise HTTPException(404, "Need at least two calibration rows in 0_cfg_sf_calibrations")
        champ = next((r for r in calib_rows if (r.get("version_alias") or "").lower() == "champion"), calib_rows[0])
        chall = next((r for r in calib_rows if (r.get("version_alias") or "").lower() == "challenger"), calib_rows[-1])

        # ── 2. Module charges from the latest gold scr-results row ──────
        scr_rows = await execute_query(f"""
            SELECT component, CAST(amount_eur AS DOUBLE) AS amount_eur
            FROM {fqn('2_stg_scr_results')}
            WHERE reporting_period = (SELECT MAX(reporting_period) FROM {fqn('2_stg_scr_results')})
              AND component IN ('SCR_market','SCR_default','SCR_non_life','SCR_health','SCR_life')
        """)
        label_map = {"SCR_market": "market", "SCR_default": "default",
                     "SCR_life": "life", "SCR_health": "health", "SCR_non_life": "non_life"}
        modules = {label_map[r["component"]]: float(r["amount_eur"] or 0)
                   for r in scr_rows if r["component"] in label_map}
        if not modules:
            raise HTTPException(404, "No SCR results — run the SCR pipeline first")

        # ── 3. Standard formula under each parameter set ────────────────
        labels = ["market", "default", "life", "health", "non_life"]
        base_corr = [
            [1.00, 0.25, 0.25, 0.25, 0.25],
            [0.25, 1.00, 0.25, 0.25, 0.50],
            [0.25, 0.25, 1.00, 0.25, 0.00],
            [0.25, 0.25, 0.25, 1.00, 0.00],
            [0.25, 0.50, 0.00, 0.00, 1.00],
        ]

        def _run_sf(cfg: dict) -> dict[str, float]:
            op_factor = float(cfg.get("op_risk_factor") or 0.03)
            lac_cap   = float(cfg.get("lac_dt_cap") or 0.10)
            mkt_nl    = float(cfg.get("bscr_market_nl_corr") or 0.25)
            corr = [row[:] for row in base_corr]
            corr[0][4] = corr[4][0] = mkt_nl
            total = 0.0
            for i, mi in enumerate(labels):
                for j, mj in enumerate(labels):
                    total += corr[i][j] * modules.get(mi, 0) * modules.get(mj, 0)
            bscr = math.sqrt(max(total, 0.0))
            op = bscr * op_factor
            lac = min(bscr * lac_cap, bscr * 0.15)
            scr = bscr + op - lac
            return {"BSCR": bscr, "Op_risk": op, "LAC_DT": lac, "SCR": scr,
                    **{f"SCR_{k}": v for k, v in modules.items()}}

        champ_out = _run_sf(champ)
        chall_out = _run_sf(chall)

        # ── 4. Component diff table ──────────────────────────────────────
        components = ["SCR_market", "SCR_default", "SCR_non_life", "SCR_health", "SCR_life",
                      "BSCR", "Op_risk", "LAC_DT", "SCR"]
        rows: list[dict[str, Any]] = []
        for c in components:
            ch = champ_out.get(c, 0.0); cl = chall_out.get(c, 0.0)
            delta = cl - ch
            delta_pct = round((delta / ch) * 100, 2) if ch else 0.0
            rows.append({
                "component": c,
                "champion_eur": round(ch, 2),
                "challenger_eur": round(cl, 2),
                "delta_eur": round(delta, 2),
                "delta_pct": delta_pct,
            })

        # ── 5. Parameter diff ────────────────────────────────────────────
        param_diff = []
        for k in ["calibration_year", "op_risk_factor", "lac_dt_cap",
                  "bscr_market_nl_corr", "bscr_nl_prem_cat_corr", "spread_corr"]:
            v1 = champ.get(k); v2 = chall.get(k)
            param_diff.append({
                "param": k,
                "champion": v1,
                "challenger": v2,
                "changed": str(v1) != str(v2),
            })

        return {
            "model_name": model_name,
            "champion_version": int(champ.get("model_version") or 1),
            "challenger_version": int(chall.get("model_version") or 2),
            "comparison": rows,
            "param_diff": param_diff,
            "change_summary": chall.get("change_summary"),
            "calibration_source": f"{catalog}.{schema}.`0_cfg_sf_calibrations`",
            "champion_error": None,
            "challenger_error": None,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Comparison failed")
        raise HTTPException(500, str(exc)) from exc


@router.get("/runs")
async def list_runs(model_name: str | None = None, limit: int = 50):
    """Return the audit trail of model runs with input + output hashes."""
    await _ensure_tables()
    if model_name:
        rows = await execute_query(
            f"SELECT * FROM {fqn('6_ai_model_runs')} WHERE model_name = :mn "
            f"ORDER BY ran_at DESC LIMIT :lim",
            parameters=[
                StatementParameterListItem(name="mn", value=model_name),
                StatementParameterListItem(name="lim", value=str(limit), type="INT"),
            ],
        )
    else:
        rows = await execute_query(
            f"SELECT * FROM {fqn('6_ai_model_runs')} ORDER BY ran_at DESC LIMIT :lim",
            parameters=[StatementParameterListItem(name="lim", value=str(limit), type="INT")],
        )
    return {"runs": rows}


class ApprovalDecision(BaseModel):
    model_name: str
    model_version: str
    decision: str  # 'approved' | 'rejected'
    comments: str | None = None


@router.get("/approvals")
async def list_approvals():
    await _ensure_tables()
    rows = await execute_query(
        f"SELECT * FROM {fqn('6_ai_model_approvals')} ORDER BY decided_at DESC LIMIT 100"
    )
    return {"approvals": rows}


@router.post("/approvals")
async def record_approval(req: ApprovalDecision, request: Request):
    """Persist an approval decision for a model version.

    Stub — does NOT flip the UC @Champion alias. The actuary records the
    decision; promotion is a separate (out-of-scope) operation.
    """
    if req.decision not in ("approved", "rejected"):
        raise HTTPException(400, "decision must be 'approved' or 'rejected'")
    await _ensure_tables()
    user = get_request_user(request)
    aid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    await execute_query(
        f"INSERT INTO {fqn('6_ai_model_approvals')} "
        "(approval_id, model_name, model_version, decision, comments, decided_at, decided_by) "
        "VALUES (:id, :mn, :mv, :dec, :c, CAST(:now AS TIMESTAMP), :user)",
        parameters=[
            StatementParameterListItem(name="id",  value=aid),
            StatementParameterListItem(name="mn",  value=req.model_name),
            StatementParameterListItem(name="mv",  value=req.model_version),
            StatementParameterListItem(name="dec", value=req.decision),
            StatementParameterListItem(name="c",   value=req.comments or ""),
            StatementParameterListItem(name="now", value=now),
            StatementParameterListItem(name="user", value=user),
        ],
    )
    return {
        "approval_id": aid,
        "decision": req.decision,
        "decided_at": now,
        "decided_by": user,
        "note": "Decision recorded. Production alias (@Champion) is not modified by this action.",
    }


# ── Helper for run-hash capture (called from run_standard_formula) ──────────

def hash_dict(d: dict) -> str:
    return hashlib.sha256(json.dumps(d, sort_keys=True, default=str).encode()).hexdigest()
