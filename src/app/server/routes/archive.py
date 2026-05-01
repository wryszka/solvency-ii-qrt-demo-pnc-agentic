"""Submissions archive + process-management metrics.

The archive route exposes every (qrt_id, reporting_period) submission with
its status, approver, DQ pass rate snapshot, and summary metric so a
process manager can browse history and download the PDF for any past
period.

The process-metrics route aggregates KPIs across periods (cycle time,
on-time rate, rejection rate, DQ trend) for the Governance page.
"""

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from server.config import fqn
from server.sql import execute_query, execute_query_cached

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/archive", tags=["archive"])


QRT_INFO = {
    "s0602": {"name": "S.06.02", "title": "List of Assets", "summary_table": "3_qrt_s0602_summary"},
    "s0501": {"name": "S.05.01", "title": "Premiums, Claims & Expenses", "summary_table": "3_qrt_s0501_summary"},
    "s2501": {"name": "S.25.01", "title": "SCR — Standard Formula", "summary_table": "3_qrt_s2501_summary"},
    "s2606": {"name": "S.26.06", "title": "Non-Life Underwriting Risk", "summary_table": "3_qrt_s2606_summary"},
}


@router.get("/submissions")
async def list_submissions():
    """List every submission (qrt × period) with status, approver, DQ snapshot."""
    try:
        approvals_q = f"""
            SELECT approval_id, qrt_id, reporting_period, status,
                   submitted_by, submitted_at, reviewed_by, reviewed_at, comments
            FROM {fqn('6_ai_approvals')}
            ORDER BY reporting_period DESC, qrt_id
        """
        # DQ pass rate per period — joined later in Python
        dq_q = f"""
            SELECT reporting_period,
                   ROUND(SUM(passing_records) * 100.0 / NULLIF(SUM(total_records), 0), 1) AS pass_rate_pct
            FROM {fqn('5_mon_dq_expectation_results')}
            GROUP BY reporting_period
        """
        # SLA — count of late or missing feeds per period
        sla_q = f"""
            SELECT reporting_period,
                   COUNT(*) AS feed_count,
                   SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late_count,
                   SUM(CASE WHEN status = 'missing' THEN 1 ELSE 0 END) AS missing_count
            FROM {fqn('5_mon_pipeline_sla_status')}
            GROUP BY reporting_period
        """

        approvals, dq_rows, sla_rows = await asyncio.gather(
            execute_query_cached(approvals_q, ttl_seconds=15),
            execute_query_cached(dq_q, ttl_seconds=60),
            execute_query_cached(sla_q, ttl_seconds=60),
            return_exceptions=True,
        )

        def _ok(x: Any) -> list:
            return [] if isinstance(x, Exception) else x

        approvals = _ok(approvals)
        dq_by_period = {r["reporting_period"]: r["pass_rate_pct"] for r in _ok(dq_rows)}
        sla_by_period = {r["reporting_period"]: r for r in _ok(sla_rows)}

        # Compute cycle time per row (review timestamp - submit timestamp), in hours
        def _cycle_hours(submitted: str | None, reviewed: str | None) -> float | None:
            if not submitted or not reviewed:
                return None
            try:
                from datetime import datetime
                fmt = "%Y-%m-%d %H:%M:%S"
                # Strip timezone if present
                s = submitted.split('+')[0].split('.')[0].replace('T', ' ').strip()
                r = reviewed.split('+')[0].split('.')[0].replace('T', ' ').strip()
                t_s = datetime.strptime(s, fmt)
                t_r = datetime.strptime(r, fmt)
                return round((t_r - t_s).total_seconds() / 3600, 1)
            except Exception:
                return None

        out = []
        for a in approvals:
            qrt_id = a.get("qrt_id", "")
            info = QRT_INFO.get(qrt_id, {"name": qrt_id, "title": qrt_id})
            period = a.get("reporting_period", "")
            sla = sla_by_period.get(period, {})
            out.append({
                "approval_id": a.get("approval_id"),
                "qrt_id": qrt_id,
                "qrt_name": info["name"],
                "qrt_title": info["title"],
                "reporting_period": period,
                "status": a.get("status"),
                "submitted_by": a.get("submitted_by"),
                "submitted_at": a.get("submitted_at"),
                "reviewed_by": a.get("reviewed_by"),
                "reviewed_at": a.get("reviewed_at"),
                "comments": a.get("comments"),
                "cycle_hours": _cycle_hours(a.get("submitted_at"), a.get("reviewed_at")),
                "dq_pass_rate_pct": dq_by_period.get(period),
                "feeds_late": int(sla.get("late_count", 0) or 0),
                "feeds_missing": int(sla.get("missing_count", 0) or 0),
            })

        return {"data": out}
    except Exception as exc:
        logger.exception("Failed to list submissions")
        raise HTTPException(500, str(exc)) from exc


@router.get("/process-metrics")
async def process_metrics():
    """Aggregate KPIs for the process-manager dashboard."""
    try:
        approvals_q = f"""
            SELECT qrt_id, reporting_period, status, submitted_at, reviewed_at
            FROM {fqn('6_ai_approvals')}
        """
        dq_trend_q = f"""
            SELECT reporting_period,
                   ROUND(SUM(passing_records) * 100.0 / NULLIF(SUM(total_records), 0), 1) AS pass_rate_pct,
                   COUNT(CASE WHEN failing_records > 0 THEN 1 END) AS failing_checks
            FROM {fqn('5_mon_dq_expectation_results')}
            GROUP BY reporting_period
            ORDER BY reporting_period
        """
        sla_trend_q = f"""
            SELECT reporting_period,
                   COUNT(*) AS feed_count,
                   SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late_count,
                   SUM(CASE WHEN status = 'missing' THEN 1 ELSE 0 END) AS missing_count,
                   SUM(CASE WHEN status = 'on_time' THEN 1 ELSE 0 END) AS on_time_count
            FROM {fqn('5_mon_pipeline_sla_status')}
            GROUP BY reporting_period
            ORDER BY reporting_period
        """

        approvals, dq_trend, sla_trend = await asyncio.gather(
            execute_query_cached(approvals_q, ttl_seconds=30),
            execute_query_cached(dq_trend_q, ttl_seconds=60),
            execute_query_cached(sla_trend_q, ttl_seconds=60),
            return_exceptions=True,
        )

        def _ok(x: Any) -> list:
            return [] if isinstance(x, Exception) else x

        approvals = _ok(approvals)
        dq_trend = _ok(dq_trend)
        sla_trend = _ok(sla_trend)

        # Aggregate KPIs
        total = len(approvals)
        approved = sum(1 for a in approvals if a.get("status") == "approved")
        rejected = sum(1 for a in approvals if a.get("status") == "rejected")
        pending = sum(1 for a in approvals if a.get("status") == "pending")
        periods = sorted({a.get("reporting_period", "") for a in approvals if a.get("reporting_period")})

        # Cycle times — only for approved rows
        cycle_hours: list[float] = []
        from datetime import datetime
        fmt = "%Y-%m-%d %H:%M:%S"
        for a in approvals:
            if a.get("status") != "approved":
                continue
            s, r = a.get("submitted_at"), a.get("reviewed_at")
            if not s or not r:
                continue
            try:
                ts = datetime.strptime(str(s).split('+')[0].split('.')[0].replace('T', ' ').strip(), fmt)
                tr = datetime.strptime(str(r).split('+')[0].split('.')[0].replace('T', ' ').strip(), fmt)
                cycle_hours.append((tr - ts).total_seconds() / 3600)
            except Exception:
                pass

        avg_cycle_hours = round(sum(cycle_hours) / len(cycle_hours), 1) if cycle_hours else None
        median_cycle_hours = None
        if cycle_hours:
            sorted_ch = sorted(cycle_hours)
            median_cycle_hours = round(sorted_ch[len(sorted_ch) // 2], 1)

        approval_rate = round(approved * 100.0 / total, 1) if total > 0 else None
        rejection_rate = round(rejected * 100.0 / total, 1) if total > 0 else None

        # Approver workload — count of reviews per reviewer
        from collections import Counter
        reviewer_counter: Counter[str] = Counter()
        submitter_counter: Counter[str] = Counter()
        for a in approvals:
            if a.get("reviewed_by"):
                reviewer_counter[a["reviewed_by"]] += 1
            if a.get("submitted_by"):
                submitter_counter[a["submitted_by"]] += 1
        top_reviewers = [{"name": n, "count": c} for n, c in reviewer_counter.most_common(5)]
        top_submitters = [{"name": n, "count": c} for n, c in submitter_counter.most_common(5)]

        # Submissions per period
        period_counter: Counter[str] = Counter()
        for a in approvals:
            if a.get("reporting_period"):
                period_counter[a["reporting_period"]] += 1
        submissions_per_period = sorted(
            [{"period": p, "count": c} for p, c in period_counter.items()],
            key=lambda x: x["period"],
        )

        return {
            "kpis": {
                "total_submissions": total,
                "approved": approved,
                "rejected": rejected,
                "pending": pending,
                "approval_rate_pct": approval_rate,
                "rejection_rate_pct": rejection_rate,
                "avg_cycle_hours": avg_cycle_hours,
                "median_cycle_hours": median_cycle_hours,
                "periods_covered": len(periods),
                "earliest_period": periods[0] if periods else None,
                "latest_period": periods[-1] if periods else None,
            },
            "dq_trend": dq_trend,
            "sla_trend": sla_trend,
            "submissions_per_period": submissions_per_period,
            "top_reviewers": top_reviewers,
            "top_submitters": top_submitters,
        }
    except Exception as exc:
        logger.exception("Failed to compute process metrics")
        raise HTTPException(500, str(exc)) from exc
