"""MCP server — the Solvency II QRT workbench exposed as callable tools.

MCP-first: the app route handlers are the single implementation; this exposes
them as an MCP tool surface so the app UI, notebooks and external agents — the
Bricksurance control tower included — are all clients of one surface.

Every tool DELEGATES to the existing route handler, reusing its logic AND its
server-side gate (a gated action re-checks its rule in the handler it calls, so
it cannot be bypassed here). Reads are idempotent; [action]/[gated] tools write
through the governed handler. A 401/403 becomes a clean {"ok":False,"gated":True}.

Transport: JSON-RPC 2.0 over one POST + a GET manifest (mirrors
pricing-workbench-gen2/routes/mcp.py). Auth = whatever the Databricks App
enforces in front of the container.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Awaitable

from fastapi import APIRouter, HTTPException, Request

from server.routes import (
    reports, approvals, audit, overlays, governance, model_governance,
    model_development, monitoring, orsa, sfcr, rsr, afr, internal_controls,
    life, archive, landing, regulator, agents, supervisor, genie, demo,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/mcp", tags=["mcp"])

PROTOCOL_VERSION = "2025-06-18"
SERVER_INFO = {"name": "bricksurance-solvency2-workbench", "version": "1.0.0"}


def _mk(name, desc, props=None, required=None):
    return {"name": name, "description": desc,
            "inputSchema": {"type": "object", "properties": props or {}, "required": required or []}}


async def _call(coro: Awaitable) -> dict:
    try:
        r = await coro
    except HTTPException as e:
        gated = e.status_code in (401, 403)
        return {"ok": False, **({"gated": True} if gated else {}), "error": f"{e.status_code}: {e.detail}"}
    except Exception as e:
        logger.warning("mcp solvency delegate failed: %s", str(e)[:200])
        return {"ok": False, "error": str(e)[:200]}
    return r if isinstance(r, dict) else {"ok": True, "data": r}


class _AgentReq:
    """Request shim so handlers that read request.headers attribute the action to the agent."""
    def __init__(self, agent_id: str):
        self.headers = {"x-forwarded-email": f"agent:{agent_id}", "user-agent": agent_id}


def _m(ModelCls, a: dict):
    """Build a Pydantic request model from agent args, keeping only declared fields."""
    fields = getattr(ModelCls, "model_fields", None) or {}
    return ModelCls(**{k: v for k, v in a.items() if k in fields})


_QRT = {"qrt_id": {"type": "string", "description": "QRT template id, e.g. S.02.01, S.25.01, S.19.01"}}
_PERIOD = {"period": {"type": "string", "description": "Reporting period, e.g. 2025-Q4"}}
_MODEL = {"model_id": {"type": "string"}}
_OID = {"overlay_id": {"type": "string"}}


# ---- reports / QRT ----
async def _t_qrt_list(a, s, ag):        return await _call(reports.list_reports())
async def _t_qrt_content(a, s, ag):     return await _call(reports.get_content(str(a.get("qrt_id") or ""), a.get("period"), int(a.get("page") or 1), int(a.get("page_size") or 100)))
async def _t_qrt_quality(a, s, ag):     return await _call(reports.get_quality(str(a.get("qrt_id") or ""), a.get("period")))
async def _t_qrt_comparison(a, s, ag):  return await _call(reports.get_comparison(str(a.get("qrt_id") or "")))
async def _t_qrt_lineage(a, s, ag):     return await _call(reports.get_lineage(str(a.get("qrt_id") or "")))
async def _t_qrt_periods(a, s, ag):     return await _call(reports.get_periods(str(a.get("qrt_id") or "")))
async def _t_qrt_ai_reviews(a, s, ag):  return await _call(reports.list_ai_reviews(str(a.get("qrt_id") or "")))
async def _t_qrt_agent_gov(a, s, ag):   return await _call(reports.get_agent_governance())
async def _t_qrt_gov_log(a, s, ag):     return await _call(reports.get_governance_log(str(a.get("qrt_id") or ""), _AgentReq(ag)))
async def _t_qrt_gen_review(a, s, ag):  return await _call(reports.generate_ai_review(str(a.get("qrt_id") or ""), _AgentReq(ag)))
async def _t_qrt_cross_review(a, s, ag):return await _call(reports.cross_qrt_consistency_review(_AgentReq(ag)))
async def _t_qrt_stochastic_review(a, s, ag): return await _call(reports.stochastic_engine_review(_AgentReq(ag)))
async def _t_qrt_audit(a, s, ag):       return await _call(audit.get_audit(str(a.get("qrt_id") or ""), a.get("period")))
async def _t_qrt_versions(a, s, ag):    return await _call(audit.list_versions(str(a.get("qrt_id") or "")))

# ---- approvals (maker/checker on each QRT) ----
async def _t_appr_all(a, s, ag):        return await _call(approvals.get_all_approvals())
async def _t_appr_get(a, s, ag):        return await _call(approvals.get_approval(str(a.get("qrt_id") or "")))
async def _t_appr_submit(a, s, ag):     return await _call(approvals.submit_for_review(str(a.get("qrt_id") or ""), _AgentReq(ag)))
async def _t_appr_review(a, s, ag):     return await _call(approvals.review_qrt(str(a.get("qrt_id") or ""), _m(approvals.ReviewRequest, a), _AgentReq(ag)))
async def _t_appr_certificate(a, s, ag):return await _call(approvals.generate_certificate(str(a.get("qrt_id") or "")))

# ---- overlays (expert-judgement register) ----
async def _t_ov_list(a, s, ag):         return await _call(overlays.list_overlays(a.get("quarter"), a.get("line_of_business"), a.get("status"), a.get("model_name"), int(a.get("limit") or 200)))
async def _t_ov_summary(a, s, ag):      return await _call(overlays.overlay_summary(a.get("quarter")))
async def _t_ov_get(a, s, ag):          return await _call(overlays.get_overlay(str(a.get("overlay_id") or "")))
async def _t_ov_lineage(a, s, ag):      return await _call(overlays.get_overlay_lineage(str(a.get("overlay_id") or "")))
async def _t_ov_by_cell(a, s, ag):      return await _call(overlays.overlays_by_qrt_cell(str(a.get("cell_prefix") or ""), a.get("quarter")))
async def _t_ov_create(a, s, ag):       return await _call(overlays.create_overlay(_m(overlays.OverlayCreate, a), _AgentReq(ag)))
async def _t_ov_approve(a, s, ag):      return await _call(overlays.approve_overlay(str(a.get("overlay_id") or ""), _m(overlays.OverlayApprove, a), _AgentReq(ag)))
async def _t_ov_retire(a, s, ag):       return await _call(overlays.retire_overlay(str(a.get("overlay_id") or ""), _AgentReq(ag)))

# ---- governance (internal model) ----
async def _t_gov_models(a, s, ag):      return await _call(governance.list_models())
async def _t_gov_model(a, s, ag):       return await _call(governance.get_model(str(a.get("model_id") or "")))
async def _t_gov_diag(a, s, ag):        return await _call(governance.get_model_diagnostics(str(a.get("model_id") or ""), a.get("period")))
async def _t_gov_promotions(a, s, ag):  return await _call(governance.get_model_promotions(str(a.get("model_id") or "")))
async def _t_gov_validation(a, s, ag):  return await _call(governance.model_validation())
async def _t_gov_all_promos(a, s, ag):  return await _call(governance.list_all_promotions(int(a.get("limit") or 100)))
async def _t_gov_summary(a, s, ag):     return await _call(governance.governance_summary(a.get("period")))
async def _t_gov_landing(a, s, ag):     return await _call(governance.governance_landing(a.get("period")))
async def _t_gov_promote(a, s, ag):     return await _call(governance.promote(str(a.get("model_id") or ""), _m(governance.PromoteRequest, a), _AgentReq(ag)))

# ---- model governance / development (validation lab) ----
async def _t_mgov_registry(a, s, ag):   return await _call(model_governance.registry())
async def _t_mgov_comparison(a, s, ag): return await _call(model_governance.comparison())
async def _t_mgov_runs(a, s, ag):       return await _call(model_governance.list_runs(a.get("model_name"), int(a.get("limit") or 50)))
async def _t_mgov_approvals(a, s, ag):  return await _call(model_governance.list_approvals())
async def _t_mgov_record(a, s, ag):     return await _call(model_governance.record_approval(_m(model_governance.ApprovalDecision, a), _AgentReq(ag)))
async def _t_mdev_native(a, s, ag):     return await _call(model_development.list_native_models())
async def _t_mdev_examples(a, s, ag):   return await _call(model_development.list_worked_examples())
async def _t_mdev_engines(a, s, ag):    return await _call(model_development.list_external_engines())

# ---- monitoring (SLA / DQ / recon) ----
async def _t_mon_sla(a, s, ag):         return await _call(monitoring.get_sla_status(a.get("period")))
async def _t_mon_dq(a, s, ag):          return await _call(monitoring.get_dq_summary(a.get("period")))
async def _t_mon_dq_trends(a, s, ag):   return await _call(monitoring.get_dq_trends())
async def _t_mon_recon(a, s, ag):       return await _call(monitoring.get_reconciliation(a.get("period")))
async def _t_mon_q4_pains(a, s, ag):    return await _call(monitoring.q4_pain_summary())
async def _t_mon_model_vers(a, s, ag):  return await _call(monitoring.get_model_versions(a.get("period")))
async def _t_mon_feed(a, s, ag):        return await _call(monitoring.get_feed_detail(str(a.get("feed_name") or "")))
async def _t_mon_recon_investigate(a, s, ag): return await _call(monitoring.investigate_reconciliation(_AgentReq(ag), a.get("body") or {}))
async def _t_mon_dq_investigate(a, s, ag):    return await _call(monitoring.investigate_dq_failures(_AgentReq(ag)))

# ---- ORSA ----
async def _t_orsa_scenarios(a, s, ag):  return await _call(orsa.list_scenarios())
async def _t_orsa_plan(a, s, ag):       return await _call(orsa.get_business_plan())
async def _t_orsa_runs(a, s, ag):       return await _call(orsa.list_runs(a.get("scenario_id")))
async def _t_orsa_run_get(a, s, ag):    return await _call(orsa.get_run(str(a.get("run_id") or "")))
async def _t_orsa_narratives(a, s, ag): return await _call(orsa.list_narratives(str(a.get("run_id") or "")))
async def _t_orsa_run(a, s, ag):        return await _call(orsa.run_scenario(_m(orsa.OrsaRunRequest, a), _AgentReq(ag)))
async def _t_orsa_narrative(a, s, ag):  return await _call(orsa.generate_narrative(_m(orsa.OrsaNarrativeRequest, a), _AgentReq(ag)))

# ---- narrative reports: SFCR / RSR / AFR ----
def _rep_tools(mod):
    async def _sections(a, s, ag): return await _call(mod.list_sections())
    async def _drafts(a, s, ag):   return await _call(mod.list_drafts(a.get("reporting_period")))
    async def _create(a, s, ag):   return await _call(mod.create_draft(_m(mod.DraftRequest, a), _AgentReq(ag)))
    async def _save(a, s, ag):     return await _call(mod.save_draft(_m(mod.SaveRequest, a), _AgentReq(ag)))
    async def _approve(a, s, ag):  return await _call(mod.approve_draft(_m(mod.ApproveRequest, a), _AgentReq(ag)))
    return _sections, _drafts, _create, _save, _approve

_sfcr = _rep_tools(sfcr); _rsr = _rep_tools(rsr); _afr = _rep_tools(afr)

# ---- internal controls / life / archive / landing / regulator / agents / supervisor / genie ----
async def _t_ctrl_matrix(a, s, ag):     return await _call(internal_controls.matrix())
async def _t_ctrl_audit(a, s, ag):      return await _call(internal_controls.audit(int(a.get("limit") or 50)))
async def _t_ctrl_blocked(a, s, ag):    return await _call(internal_controls.blocked_counter())
async def _t_ctrl_arch(a, s, ag):       return await _call(internal_controls.architecture_assertion())
async def _t_life_reserves(a, s, ag):   return await _call(life.reserves())
async def _t_life_uw(a, s, ag):         return await _call(life.uw_risk())
async def _t_life_lapses(a, s, ag):     return await _call(life.lapses())
async def _t_arch_submissions(a, s, ag):return await _call(archive.list_submissions())
async def _t_arch_metrics(a, s, ag):    return await _call(archive.process_metrics())
async def _t_landing_status(a, s, ag):  return await _call(landing.landing_status())
async def _t_reg_examples(a, s, ag):    return await _call(regulator.get_examples())
async def _t_reg_ask(a, s, ag):         return await _call(regulator.ask_question(_m(regulator.QuestionRequest, a), _AgentReq(ag)))
async def _t_agent_reserving(a, s, ag): return await _call(agents.senior_reserving_review(a.get("period_q4") or "2025-Q4"))
async def _t_agent_ask(a, s, ag):       return await _call(agents.workbench_assistant(_m(agents.AssistantRequest, a), _AgentReq(ag)))
async def _t_sup_specialists(a, s, ag): return await _call(supervisor.list_specialists())
async def _t_sup_recent(a, s, ag):      return await _call(supervisor.recent_routings(int(a.get("limit") or 10)))
async def _t_sup_trace(a, s, ag):       return await _call(supervisor.trace_detail(str(a.get("trace_id") or "")))
async def _t_sup_ask(a, s, ag):         return await _call(supervisor.supervisor_ask_sync(_m(supervisor.SupervisorRequest, a), _AgentReq(ag)))
async def _t_genie_ask(a, s, ag):       return await _call(genie.ask_genie(_m(genie.GenieQuestion, a)))
# ---- selected demo reads (portfolio state; skip resets/whatif plumbing) ----
async def _t_demo_solvency_daily(a, s, ag): return await _call(demo.solvency_daily(int(a.get("days") or 90)))
async def _t_demo_cyber_book(a, s, ag):     return await _call(demo.cyber_book())
async def _t_demo_period_state(a, s, ag):   return await _call(demo.period_state())


TOOL_SCHEMAS: list[dict[str, Any]] = [
    _mk("qrt_list", "List every QRT report (id, name, status, period)."),
    _mk("qrt_content", "The content/cells of one QRT report.", _QRT, ["qrt_id"]),
    _mk("qrt_quality", "Data-quality result for a QRT (checks, pass/fail, DQ dimensions).", {**_QRT, **_PERIOD}, ["qrt_id"]),
    _mk("qrt_comparison", "Period-over-period comparison for a QRT.", _QRT, ["qrt_id"]),
    _mk("qrt_lineage", "Lineage for a QRT — the tables/models each cell derives from.", _QRT, ["qrt_id"]),
    _mk("qrt_periods", "The reporting periods available for a QRT.", _QRT, ["qrt_id"]),
    _mk("qrt_ai_reviews", "Prior AI reviews recorded against a QRT.", _QRT, ["qrt_id"]),
    _mk("qrt_agent_governance", "Agent-governance posture across the QRT AI reviewers."),
    _mk("qrt_governance_log", "The governance log for a QRT (who/what/when).", _QRT, ["qrt_id"]),
    _mk("qrt_generate_review", "[action] Generate an AI review of a QRT (grounded, audit-logged).", _QRT, ["qrt_id"]),
    _mk("qrt_cross_review", "[action] Run the cross-QRT consistency review across the return."),
    _mk("qrt_stochastic_review", "[action] Run the stochastic-engine review."),
    _mk("qrt_audit", "Audit trail for a QRT.", {**_QRT, **_PERIOD}, ["qrt_id"]),
    _mk("qrt_versions", "Version history for a QRT.", _QRT, ["qrt_id"]),
    _mk("approvals_all", "The maker/checker approval state of every QRT."),
    _mk("approval_get", "Approval state of one QRT.", _QRT, ["qrt_id"]),
    _mk("approval_submit", "[action] Submit a QRT for review (maker step).", _QRT, ["qrt_id"]),
    _mk("approval_review", "[gated] Review/decision on a QRT (checker step) — status approved/rejected + comments.", {**_QRT, "status": {"type": "string"}, "comments": {"type": "string"}}, ["qrt_id", "status"]),
    _mk("approval_certificate", "[action] Generate the sign-off certificate for an approved QRT.", _QRT, ["qrt_id"]),
    _mk("overlay_list", "The expert-judgement overlays register."),
    _mk("overlay_summary", "Overlay summary for a quarter.", {"quarter": {"type": "string"}}),
    _mk("overlay_get", "One overlay's detail.", _OID, ["overlay_id"]),
    _mk("overlay_lineage", "Lineage of an overlay to the QRT cells it affects.", _OID, ["overlay_id"]),
    _mk("overlays_by_qrt_cell", "Overlays matching a QRT cell prefix (e.g. s0501.R0210).", {"cell_prefix": {"type": "string"}, "quarter": {"type": "string"}}, ["cell_prefix"]),
    _mk("overlay_create", "[action] Raise an expert-judgement overlay — needs rationale, magnitude, direction, linked QRT cells; routes to an approval role by magnitude. Writes PENDING in the governed register.",
        {"quarter": {"type": "string"}, "line_of_business": {"type": "string"}, "accident_year": {"type": "integer"}, "magnitude_eur": {"type": "number"}, "direction": {"type": "string"}, "category": {"type": "string"}, "rationale": {"type": "string"}, "linked_qrt_cells": {"type": "array"}, "lifecycle_action": {"type": "string"}}, ["quarter", "line_of_business", "magnitude_eur", "direction", "category", "rationale"]),
    _mk("overlay_approve", "[gated] Approve a pending overlay (maker/checker; approval-role rule enforced in the handler).", {**_OID, "comments": {"type": "string"}}, ["overlay_id"]),
    _mk("overlay_retire", "[action] Retire an active overlay.", _OID, ["overlay_id"]),
    _mk("gov_models", "List internal-model components under governance."),
    _mk("gov_model", "One model component's governance record.", _MODEL, ["model_id"]),
    _mk("gov_model_diagnostics", "Validation diagnostics for a model component.", {**_MODEL, **_PERIOD}, ["model_id"]),
    _mk("gov_model_promotions", "Promotion history for a model component.", _MODEL, ["model_id"]),
    _mk("gov_model_validation", "The model-validation overview across components."),
    _mk("gov_all_promotions", "All model promotions (audit).", {"limit": {"type": "integer"}}),
    _mk("gov_summary", "Governance summary for a period.", _PERIOD),
    _mk("gov_landing", "Governance landing view for a period.", _PERIOD),
    _mk("gov_promote", "[gated] Promote a model component version to an alias — needs target_alias, candidate_version, justification, approver.", {**_MODEL, "target_alias": {"type": "string"}, "candidate_version": {"type": "string"}, "quarter": {"type": "string"}, "justification": {"type": "string"}, "approver": {"type": "string"}}, ["model_id", "target_alias", "candidate_version", "justification"]),
    _mk("mgov_registry", "The model-governance registry (validation lab)."),
    _mk("mgov_comparison", "Champion/challenger comparison in the validation lab."),
    _mk("mgov_runs", "MLflow runs for a model (or all).", {"model_name": {"type": "string"}, "limit": {"type": "integer"}}),
    _mk("mgov_approvals", "Recorded model-governance approvals."),
    _mk("mgov_record_approval", "[gated] Record a model-governance approval decision (approved/rejected + comments).", {"model_version": {"type": "string"}, "decision": {"type": "string"}, "comments": {"type": "string"}}, ["model_version", "decision"]),
    _mk("mdev_native_models", "Natively-developed models in the workbench."),
    _mk("mdev_worked_examples", "Worked-example model notebooks."),
    _mk("mdev_external_engines", "External-engine integrations (the model seam)."),
    _mk("mon_sla", "SLA status for the close.", _PERIOD),
    _mk("mon_dq", "Data-quality summary for a period.", _PERIOD),
    _mk("mon_dq_trends", "DQ trends over time."),
    _mk("mon_reconciliation", "Reconciliation status (subledger↔GL etc.).", _PERIOD),
    _mk("mon_q4_pains", "The Q4-close pain summary."),
    _mk("mon_model_versions", "Model versions in effect for a period.", _PERIOD),
    _mk("mon_feed", "Detail of one source feed.", {"feed_name": {"type": "string"}}, ["feed_name"]),
    _mk("mon_recon_investigate", "[action] Investigate a reconciliation break with the grounded agent.", {"body": {"type": "object"}}),
    _mk("mon_dq_investigate", "[action] Investigate DQ failures with the grounded agent."),
    _mk("orsa_scenarios", "The ORSA scenario library."),
    _mk("orsa_business_plan", "The business plan feeding ORSA."),
    _mk("orsa_runs", "ORSA runs (optionally for one scenario).", {"scenario_id": {"type": "string"}}),
    _mk("orsa_run_get", "One ORSA run's result.", {"run_id": {"type": "string"}}, ["run_id"]),
    _mk("orsa_narratives", "Narratives generated for an ORSA run.", {"run_id": {"type": "string"}}, ["run_id"]),
    _mk("orsa_run", "[action] Run an ORSA scenario/stress from the base period.", {"scenario_id": {"type": "string"}, "base_period": {"type": "string"}}, ["scenario_id"]),
    _mk("orsa_narrative", "[action] Generate the narrative for an ORSA run.", {"run_id": {"type": "string"}}, ["run_id"]),
    # SFCR / RSR / AFR
    _mk("sfcr_sections", "SFCR report sections."),
    _mk("sfcr_drafts", "SFCR drafts (optionally for a period).", {"reporting_period": {"type": "string"}}),
    _mk("sfcr_create_draft", "[action] Create an SFCR section draft.", {"section_id": {"type": "string"}, "reporting_period": {"type": "string"}}, ["section_id"]),
    _mk("sfcr_save_draft", "[action] Save an SFCR draft's content.", {"draft_id": {"type": "string"}, "content": {"type": "string"}}, ["draft_id", "content"]),
    _mk("sfcr_approve_draft", "[gated] Approve an SFCR draft.", {"draft_id": {"type": "string"}}, ["draft_id"]),
    _mk("rsr_sections", "RSR report sections."),
    _mk("rsr_drafts", "RSR drafts (optionally for a period).", {"reporting_period": {"type": "string"}}),
    _mk("rsr_create_draft", "[action] Create an RSR section draft.", {"section_id": {"type": "string"}, "reporting_period": {"type": "string"}}, ["section_id"]),
    _mk("rsr_save_draft", "[action] Save an RSR draft's content.", {"draft_id": {"type": "string"}, "content": {"type": "string"}}, ["draft_id", "content"]),
    _mk("rsr_approve_draft", "[gated] Approve an RSR draft.", {"draft_id": {"type": "string"}}, ["draft_id"]),
    _mk("afr_sections", "AFR (actuarial function report) sections."),
    _mk("afr_drafts", "AFR drafts (optionally for a period).", {"reporting_period": {"type": "string"}}),
    _mk("afr_create_draft", "[action] Create an AFR section draft.", {"section_id": {"type": "string"}, "reporting_period": {"type": "string"}}, ["section_id"]),
    _mk("afr_save_draft", "[action] Save an AFR draft's content.", {"draft_id": {"type": "string"}, "content": {"type": "string"}}, ["draft_id", "content"]),
    _mk("afr_approve_draft", "[gated] Approve an AFR draft.", {"draft_id": {"type": "string"}}, ["draft_id"]),
    # controls / life / archive / landing / regulator / agents / supervisor / genie / demo
    _mk("controls_matrix", "The internal-controls matrix."),
    _mk("controls_audit", "Internal-controls audit log.", {"limit": {"type": "integer"}}),
    _mk("controls_blocked_counter", "Count of actions the controls have blocked."),
    _mk("controls_architecture_assertion", "The architecture-assertion control statement."),
    _mk("life_reserves", "Life reserves view."),
    _mk("life_uw", "Life underwriting-risk view."),
    _mk("life_lapses", "Life lapse view."),
    _mk("archive_submissions", "Archived regulatory submissions."),
    _mk("archive_process_metrics", "Submission process metrics."),
    _mk("landing_status", "The landing/overview status of the close."),
    _mk("regulator_examples", "Example regulator questions the workbench can answer."),
    _mk("regulator_ask", "[action] Ask a regulator-facing question against the grounded return.", {"question": {"type": "string"}}, ["question"]),
    _mk("agent_reserving_review", "The Senior Reserving Actuary agent's review for a period.", {"period_q4": {"type": "string"}}),
    _mk("agent_workbench_ask", "[action] Ask the workbench assistant (routes to a specialist).", {"question": {"type": "string"}, "period": {"type": "string"}}, ["question"]),
    _mk("supervisor_specialists", "The specialist agents behind the supervisor."),
    _mk("supervisor_recent", "Recent supervisor routings.", {"limit": {"type": "integer"}}),
    _mk("supervisor_trace", "One routing trace in detail.", {"trace_id": {"type": "string"}}, ["trace_id"]),
    _mk("supervisor_ask", "[action] Ask the supervisor synchronously (classify + route + answer).", {"question": {"type": "string"}, "period": {"type": "string"}}, ["question"]),
    _mk("genie_ask", "[action] Ask AI/BI Genie a data question over the Solvency II space.", {"question": {"type": "string"}}, ["question"]),
    _mk("demo_solvency_daily", "Daily solvency-ratio series.", {"days": {"type": "integer"}}),
    _mk("demo_cyber_book", "The cyber book exposure view."),
    _mk("demo_period_state", "The current close period state."),
]

TOOL_IMPLS: dict[str, Any] = {
    "qrt_list": _t_qrt_list, "qrt_content": _t_qrt_content, "qrt_quality": _t_qrt_quality,
    "qrt_comparison": _t_qrt_comparison, "qrt_lineage": _t_qrt_lineage, "qrt_periods": _t_qrt_periods,
    "qrt_ai_reviews": _t_qrt_ai_reviews, "qrt_agent_governance": _t_qrt_agent_gov,
    "qrt_governance_log": _t_qrt_gov_log, "qrt_generate_review": _t_qrt_gen_review,
    "qrt_cross_review": _t_qrt_cross_review, "qrt_stochastic_review": _t_qrt_stochastic_review,
    "qrt_audit": _t_qrt_audit, "qrt_versions": _t_qrt_versions,
    "approvals_all": _t_appr_all, "approval_get": _t_appr_get, "approval_submit": _t_appr_submit,
    "approval_review": _t_appr_review, "approval_certificate": _t_appr_certificate,
    "overlay_list": _t_ov_list, "overlay_summary": _t_ov_summary, "overlay_get": _t_ov_get,
    "overlay_lineage": _t_ov_lineage, "overlays_by_qrt_cell": _t_ov_by_cell,
    "overlay_create": _t_ov_create, "overlay_approve": _t_ov_approve, "overlay_retire": _t_ov_retire,
    "gov_models": _t_gov_models, "gov_model": _t_gov_model, "gov_model_diagnostics": _t_gov_diag,
    "gov_model_promotions": _t_gov_promotions, "gov_model_validation": _t_gov_validation,
    "gov_all_promotions": _t_gov_all_promos, "gov_summary": _t_gov_summary, "gov_landing": _t_gov_landing,
    "gov_promote": _t_gov_promote,
    "mgov_registry": _t_mgov_registry, "mgov_comparison": _t_mgov_comparison, "mgov_runs": _t_mgov_runs,
    "mgov_approvals": _t_mgov_approvals, "mgov_record_approval": _t_mgov_record,
    "mdev_native_models": _t_mdev_native, "mdev_worked_examples": _t_mdev_examples,
    "mdev_external_engines": _t_mdev_engines,
    "mon_sla": _t_mon_sla, "mon_dq": _t_mon_dq, "mon_dq_trends": _t_mon_dq_trends,
    "mon_reconciliation": _t_mon_recon, "mon_q4_pains": _t_mon_q4_pains,
    "mon_model_versions": _t_mon_model_vers, "mon_feed": _t_mon_feed,
    "mon_recon_investigate": _t_mon_recon_investigate, "mon_dq_investigate": _t_mon_dq_investigate,
    "orsa_scenarios": _t_orsa_scenarios, "orsa_business_plan": _t_orsa_plan, "orsa_runs": _t_orsa_runs,
    "orsa_run_get": _t_orsa_run_get, "orsa_narratives": _t_orsa_narratives,
    "orsa_run": _t_orsa_run, "orsa_narrative": _t_orsa_narrative,
    "sfcr_sections": _sfcr[0], "sfcr_drafts": _sfcr[1], "sfcr_create_draft": _sfcr[2], "sfcr_save_draft": _sfcr[3], "sfcr_approve_draft": _sfcr[4],
    "rsr_sections": _rsr[0], "rsr_drafts": _rsr[1], "rsr_create_draft": _rsr[2], "rsr_save_draft": _rsr[3], "rsr_approve_draft": _rsr[4],
    "afr_sections": _afr[0], "afr_drafts": _afr[1], "afr_create_draft": _afr[2], "afr_save_draft": _afr[3], "afr_approve_draft": _afr[4],
    "controls_matrix": _t_ctrl_matrix, "controls_audit": _t_ctrl_audit,
    "controls_blocked_counter": _t_ctrl_blocked, "controls_architecture_assertion": _t_ctrl_arch,
    "life_reserves": _t_life_reserves, "life_uw": _t_life_uw, "life_lapses": _t_life_lapses,
    "archive_submissions": _t_arch_submissions, "archive_process_metrics": _t_arch_metrics,
    "landing_status": _t_landing_status,
    "regulator_examples": _t_reg_examples, "regulator_ask": _t_reg_ask,
    "agent_reserving_review": _t_agent_reserving, "agent_workbench_ask": _t_agent_ask,
    "supervisor_specialists": _t_sup_specialists, "supervisor_recent": _t_sup_recent,
    "supervisor_trace": _t_sup_trace, "supervisor_ask": _t_sup_ask, "genie_ask": _t_genie_ask,
    "demo_solvency_daily": _t_demo_solvency_daily, "demo_cyber_book": _t_demo_cyber_book,
    "demo_period_state": _t_demo_period_state,
}


def _ok(rpc_id, result):  return {"jsonrpc": "2.0", "id": rpc_id, "result": result}
def _err(rpc_id, code, m): return {"jsonrpc": "2.0", "id": rpc_id, "error": {"code": code, "message": m}}


@router.post("")
async def jsonrpc(request: Request) -> dict:
    try:
        body = await request.json()
    except Exception:
        return _err(None, -32700, "Parse error: body is not valid JSON")
    rpc_id = body.get("id"); method = body.get("method"); params = body.get("params") or {}
    agent_id = request.headers.get("user-agent", "unknown-agent")[:120]

    if method == "initialize":
        return _ok(rpc_id, {
            "protocolVersion": PROTOCOL_VERSION, "serverInfo": SERVER_INFO,
            "capabilities": {"tools": {}},
            "instructions": (
                "Solvency II QRT workbench for Bricksurance SE. Reads cover the full return "
                "(QRTs, approvals, overlays, internal model governance, monitoring, ORSA, "
                "SFCR/RSR/AFR narratives, controls). Actions write through the same governed "
                "handlers as the UI: submit≠review, overlay propose≠approve, model promotion is "
                "role-gated, and every action is audit-logged. Never invent a figure.")})
    if method in ("notifications/initialized", "notifications/cancelled"):
        return _ok(rpc_id, {})
    if method == "tools/list":
        return _ok(rpc_id, {"tools": TOOL_SCHEMAS})
    if method == "tools/call":
        name = params.get("name"); args = params.get("arguments") or {}
        impl = TOOL_IMPLS.get(name)
        if impl is None:
            return _err(rpc_id, -32601, f"Unknown tool: {name}")
        try:
            payload = await impl(args, "mcp", agent_id)
        except Exception as e:
            logger.exception("mcp tool %s failed", name)
            return _err(rpc_id, -32603, f"Tool execution failed: {str(e)[:200]}")
        return _ok(rpc_id, {
            "content": [{"type": "text", "text": json.dumps(payload, default=str)}],
            "structuredContent": payload,
            "isError": isinstance(payload, dict) and payload.get("ok") is False})
    return _err(rpc_id, -32601, f"Method not found: {method}")


@router.get("/manifest")
async def manifest() -> dict:
    return {"server": SERVER_INFO, "protocol_version": PROTOCOL_VERSION,
            "tools": [{"name": t["name"], "description": t["description"]} for t in TOOL_SCHEMAS]}
