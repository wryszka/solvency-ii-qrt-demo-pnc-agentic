"""Agent #2: Regulator Q&A — Solvency II aware Q&A with data context."""

import json
import logging
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from server.config import fqn, get_current_user
from server.sql import execute_query
from server.ai import generate_review
from server.prompts import REGULATOR_QA_SYSTEM, REGULATOR_QA_PROMPT
from server.guardrails import validate_input, validate_output, truncate_output

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/regulator", tags=["regulator"])

ENTITY_NAME = os.getenv("ENTITY_NAME", "Bricksurance SE")
ENTITY_LEI = os.getenv("ENTITY_LEI", "5493001KJTIIGC8Y1R12")

EXAMPLE_QUESTIONS = [
    {
        "category": "Regulator Responses",
        "questions": [
            "The regulator is asking why our property losses went up — draft a response",
            "Prepare a letter explaining our solvency position to BaFin",
            "Why did our risk capital requirement change this quarter?",
        ],
    },
    {
        "category": "Board & Management",
        "questions": [
            "Summarise our financial position for the board in plain English",
            "What are the top 3 things the CEO should worry about this quarter?",
            "Compare this quarter to last — what got better and what got worse?",
        ],
    },
    {
        "category": "Analysis & Interpretation",
        "questions": [
            "Are we in good financial health this quarter?",
            "Is our reinsurance programme adequate for the risks we hold?",
            "Explain the relationship between our assets and our risk charges",
        ],
    },
]

GENIE_EXAMPLES = [
    "What is the solvency ratio for Q3 2025?",
    "Show combined ratio by line of business",
    "Which line of business has the highest gross written premium?",
    "Show asset allocation by CIC category",
    "Compare own funds vs SCR across all quarters",
    "How many claims were there in Q3 for motor?",
]


class QuestionRequest(BaseModel):
    question: str


async def _gather_full_context() -> dict:
    """Gather summary data from all 4 QRTs for the Q&A context."""

    async def get_latest(table: str):
        try:
            rows = await execute_query(
                f"SELECT * FROM {fqn(table)} ORDER BY reporting_period DESC LIMIT 2"
            )
            return rows
        except Exception:
            return []

    s0602 = await get_latest("3_qrt_s0602_summary")
    s0501 = await get_latest("3_qrt_s0501_summary")
    s2501 = await get_latest("3_qrt_s2501_summary")
    s2606 = await get_latest("3_qrt_s2606_summary")

    # Get reporting period from whichever table has data
    reporting_period = "Unknown"
    for rows in [s2501, s0501, s0602, s2606]:
        if rows:
            reporting_period = rows[0].get("reporting_period", "Unknown")
            break

    # Reconciliation
    try:
        recon = await execute_query(f"""
            SELECT * FROM {fqn('5_mon_cross_qrt_reconciliation')}
            WHERE reporting_period = '{reporting_period}'
        """)
    except Exception:
        recon = []

    # DQ summary
    try:
        dq = await execute_query(f"""
            SELECT pipeline_name,
                   SUM(CAST(failing_records AS INT)) AS total_failing,
                   ROUND(SUM(CAST(passing_records AS INT)) * 100.0 /
                         NULLIF(SUM(CAST(total_records AS INT)), 0), 1) AS pass_rate_pct
            FROM {fqn('5_mon_dq_expectation_results')}
            WHERE reporting_period = '{reporting_period}'
            GROUP BY pipeline_name
        """)
    except Exception:
        dq = []

    def fmt(rows):
        return json.dumps(rows, indent=2, default=str) if rows else "Not available."

    return {
        "entity_name": ENTITY_NAME,
        "entity_lei": ENTITY_LEI,
        "reporting_period": reporting_period,
        "s0602_summary": fmt(s0602),
        "s0501_summary": fmt(s0501),
        "s2501_summary": fmt(s2501),
        "s2606_summary": fmt(s2606),
        "reconciliation_data": fmt(recon),
        "dq_summary": fmt(dq),
    }


@router.get("/examples")
async def get_examples():
    """Return example questions grouped by category."""
    return {"examples": EXAMPLE_QUESTIONS, "genie_examples": GENIE_EXAMPLES}


@router.post("/ask")
async def ask_question(req: QuestionRequest):
    """Answer a Solvency II regulatory question using QRT data context."""
    if not req.question or len(req.question.strip()) < 5:
        raise HTTPException(400, "Question too short")

    user = get_current_user()

    try:
        # Gather full data context
        context = await _gather_full_context()
        context["question"] = req.question

        # Build prompt
        user_prompt = REGULATOR_QA_PROMPT.format(**context)

        # Guardrails
        input_verdict = validate_input(user_prompt, user)
        if not input_verdict.passed:
            status_code = 429 if input_verdict.rate_limited else 400
            raise HTTPException(status_code, {
                "error": "Input guardrail failed",
                "guardrails": input_verdict.to_dict(),
            })

        # Call LLM
        result = await generate_review(REGULATOR_QA_SYSTEM, user_prompt, agent_name="regulator_qa")

        # Output guardrails
        output_verdict = validate_output(result.text)
        answer_text = truncate_output(result.text)

        return {
            "question": req.question,
            "answer": answer_text,
            "reporting_period": context["reporting_period"],
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
        logger.exception("Regulator Q&A failed")
        raise HTTPException(500, f"Q&A failed: {str(exc)}") from exc
