import json
import logging

from fastapi import APIRouter, HTTPException, Query

from server.config import fqn, get_current_user
from server.sql import execute_query
from server.ai import generate_review
from server.prompts import DQ_TRIAGE_SYSTEM, DQ_TRIAGE_PROMPT
from server.guardrails import validate_input, validate_output, truncate_output

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


@router.get("/sla-status")
async def get_sla_status(period: str = Query(None)):
    """Feed arrival status vs SLA deadlines."""
    try:
        where = f"WHERE reporting_period = '{period}'" if period else \
            f"WHERE reporting_period = (SELECT MAX(reporting_period) FROM {fqn('5_mon_pipeline_sla_status')})"
        rows = await execute_query(f"SELECT * FROM {fqn('5_mon_pipeline_sla_status')} {where} ORDER BY sla_deadline")
        return {"data": rows}
    except Exception as exc:
        logger.exception("Failed to fetch SLA status")
        raise HTTPException(500, str(exc)) from exc


@router.get("/dq-summary")
async def get_dq_summary(period: str = Query(None)):
    """DQ expectation pass/fail rates by pipeline and table."""
    try:
        where = f"WHERE reporting_period = '{period}'" if period else \
            f"WHERE reporting_period = (SELECT MAX(reporting_period) FROM {fqn('5_mon_dq_expectation_results')})"
        rows = await execute_query(f"""
            SELECT * FROM {fqn('5_mon_dq_expectation_results')} {where}
            ORDER BY pipeline_name, table_name, expectation_name
        """)

        # Also compute aggregates
        agg = await execute_query(f"""
            SELECT
                SUM(total_records) AS total_records,
                SUM(passing_records) AS total_passing,
                SUM(failing_records) AS total_failing,
                ROUND(SUM(passing_records) * 100.0 / NULLIF(SUM(total_records), 0), 1) AS overall_pass_rate,
                COUNT(*) AS total_expectations,
                COUNT(CASE WHEN failing_records > 0 THEN 1 END) AS failing_expectations
            FROM {fqn('5_mon_dq_expectation_results')} {where}
        """)

        return {"data": rows, "aggregate": agg[0] if agg else None}
    except Exception as exc:
        logger.exception("Failed to fetch DQ summary")
        raise HTTPException(500, str(exc)) from exc


@router.get("/dq-trends")
async def get_dq_trends():
    """DQ pass rate trend across all quarters."""
    try:
        rows = await execute_query(f"""
            SELECT
                reporting_period,
                SUM(total_records) AS total_records,
                SUM(passing_records) AS total_passing,
                SUM(failing_records) AS total_failing,
                ROUND(SUM(passing_records) * 100.0 / NULLIF(SUM(total_records), 0), 1) AS pass_rate_pct,
                COUNT(CASE WHEN failing_records > 0 THEN 1 END) AS failing_checks
            FROM {fqn('5_mon_dq_expectation_results')}
            GROUP BY reporting_period
            ORDER BY reporting_period
        """)
        return {"data": rows}
    except Exception as exc:
        logger.exception("Failed to fetch DQ trends")
        raise HTTPException(500, str(exc)) from exc


@router.get("/reconciliation")
async def get_reconciliation(period: str = Query(None)):
    """Cross-QRT reconciliation checks."""
    try:
        where = f"WHERE reporting_period = '{period}'" if period else \
            f"WHERE reporting_period = (SELECT MAX(reporting_period) FROM {fqn('5_mon_cross_qrt_reconciliation')})"
        rows = await execute_query(f"""
            SELECT * FROM {fqn('5_mon_cross_qrt_reconciliation')} {where}
            ORDER BY check_name
        """)
        return {"data": rows}
    except Exception as exc:
        logger.exception("Failed to fetch reconciliation")
        raise HTTPException(500, str(exc)) from exc


@router.get("/model-versions")
async def get_model_versions(period: str = Query(None)):
    """Model version comparison — Champion vs Challenger."""
    try:
        where = f"WHERE reporting_period = '{period}'" if period else \
            f"WHERE reporting_period = (SELECT MAX(reporting_period) FROM {fqn('5_mon_model_registry_log')})"
        rows = await execute_query(f"""
            SELECT * FROM {fqn('5_mon_model_registry_log')} {where}
            ORDER BY model_version
        """)
        return {"data": rows}
    except Exception as exc:
        logger.exception("Failed to fetch model versions")
        raise HTTPException(500, str(exc)) from exc


# ── Agent #3: DQ Triage ─────────────────────────────────────────────────────

@router.post("/dq-investigate")
async def investigate_dq_failures():
    """AI agent investigates data quality failures and hypothesises root causes."""
    user = get_current_user()

    try:
        # Get latest period
        period_rows = await execute_query(f"""
            SELECT MAX(reporting_period) AS p FROM {fqn('5_mon_dq_expectation_results')}
        """)
        reporting_period = period_rows[0]["p"] if period_rows else "Unknown"

        # Get all DQ results
        all_checks = await execute_query(f"""
            SELECT * FROM {fqn('5_mon_dq_expectation_results')}
            WHERE reporting_period = '{reporting_period}'
            ORDER BY pipeline_name, table_name
        """)

        # Filter to failing only
        failing_checks = [c for c in all_checks if int(c.get("failing_records", 0)) > 0]

        if not failing_checks:
            return {
                "review_text": "## All Clear\n\nNo data quality failures detected for the current reporting period. All DLT expectations are passing.",
                "model_used": "none",
                "guardrails": {"passed": True, "checks_run": 0, "checks_passed": 0, "checks_failed": 0, "warnings": [], "failures": [], "pii_flags": [], "output_truncated": False, "rate_limited": False},
            }

        # Get SLA data for context
        try:
            sla_rows = await execute_query(f"""
                SELECT * FROM {fqn('5_mon_pipeline_sla_status')}
                WHERE reporting_period = '{reporting_period}'
            """)
        except Exception:
            sla_rows = []

        def fmt(rows):
            return json.dumps(rows, indent=2, default=str) if rows else "No data available."

        user_prompt = DQ_TRIAGE_PROMPT.format(
            entity_name="Bricksurance SE",
            reporting_period=reporting_period,
            failing_checks=fmt(failing_checks),
            all_checks=fmt(all_checks),
            sla_data=fmt(sla_rows),
        )

        # Guardrails
        input_verdict = validate_input(user_prompt, user)
        if not input_verdict.passed:
            status_code = 429 if input_verdict.rate_limited else 400
            raise HTTPException(status_code, {"error": "Input guardrail failed", "guardrails": input_verdict.to_dict()})

        result = await generate_review(DQ_TRIAGE_SYSTEM, user_prompt)
        output_verdict = validate_output(result.text)
        review_text = truncate_output(result.text)

        return {
            "reporting_period": reporting_period,
            "failing_count": len(failing_checks),
            "review_text": review_text,
            "model_used": result.model_used,
            "input_tokens": result.input_tokens,
            "output_tokens": result.output_tokens,
            "guardrails": {
                "passed": input_verdict.passed and output_verdict.passed,
                "checks_run": input_verdict.checks_run + output_verdict.checks_run,
                "checks_passed": input_verdict.checks_passed + output_verdict.checks_passed,
                "checks_failed": input_verdict.checks_failed + output_verdict.checks_failed,
                "warnings": input_verdict.warnings + output_verdict.warnings,
                "failures": input_verdict.failures + output_verdict.failures,
                "pii_flags": output_verdict.pii_flags,
                "output_truncated": output_verdict.output_truncated,
                "rate_limited": input_verdict.rate_limited,
            },
        }

    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(503, str(exc)) from exc
    except Exception as exc:
        logger.exception("DQ triage failed")
        raise HTTPException(500, f"DQ investigation failed: {str(exc)}") from exc
