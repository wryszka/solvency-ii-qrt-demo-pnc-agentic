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

    The comparison runs both registered model versions (Champion + Challenger)
    against the same risk factors, summarising the +4% delta.
    """
    try:
        # Reload both models and run them against the latest risk factors
        import mlflow
        from server.config import get_catalog, get_schema
        catalog = get_catalog()
        schema = get_schema()
        model_name = f"{catalog}.{schema}.standard_formula"

        rf_q = f"""
            SELECT risk_module, risk_sub_module, CAST(charge_eur AS DOUBLE) AS charge_eur
            FROM {fqn('1_raw_risk_factors')}
            WHERE reporting_period = (SELECT MAX(reporting_period) FROM {fqn('1_raw_risk_factors')})
        """
        rf_rows = await execute_query(rf_q)
        if not rf_rows:
            raise HTTPException(404, "No risk factors loaded — run the SCR pipeline first")

        import pandas as pd
        rf_df = pd.DataFrame(rf_rows)

        mlflow.set_registry_uri("databricks-uc")

        def _run_model(alias: str) -> dict:
            try:
                m = mlflow.pyfunc.load_model(f"models:/{model_name}@{alias}")
                out = m.predict(rf_df)
                rows = out.to_dict(orient="records") if hasattr(out, "to_dict") else out
                return {"alias": alias, "rows": rows}
            except Exception as exc:
                return {"alias": alias, "error": str(exc), "rows": []}

        # Run sequentially to avoid MLflow client races
        champion = await asyncio.to_thread(_run_model, "Champion")
        challenger = await asyncio.to_thread(_run_model, "Challenger")

        def _by_component(rows: list[dict]) -> dict[str, float]:
            return {r.get("component"): float(r.get("amount_eur", 0) or 0) for r in rows}

        champ_map = _by_component(champion.get("rows", []))
        chal_map  = _by_component(challenger.get("rows", []))

        components = ["SCR_market", "SCR_default", "SCR_non_life", "SCR_health", "SCR_life",
                      "BSCR", "Op_risk", "LAC_DT", "SCR"]
        rows: list[dict[str, Any]] = []
        for c in components:
            champ = champ_map.get(c, 0.0)
            chal = chal_map.get(c, 0.0)
            delta = chal - champ
            delta_pct = round((delta / champ) * 100, 2) if champ else 0.0
            rows.append({
                "component": c,
                "champion_eur": round(champ, 2),
                "challenger_eur": round(chal, 2),
                "delta_eur": round(delta, 2),
                "delta_pct": delta_pct,
            })
        return {
            "model_name": model_name,
            "comparison": rows,
            "champion_error": champion.get("error"),
            "challenger_error": challenger.get("error"),
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
