"""AI Agent Guardrails for Solvency II QRT Review.

Implements defence-in-depth controls that map to Databricks governance:
1. Input validation   — sanitise data before it reaches the LLM
2. Output validation  — verify the review contains required sections
3. PII detection      — flag/redact personal data in LLM output
4. Rate limiting      — per-user, per-QRT throttle
5. Content safety     — block hallucinated approvals or regulatory claims
6. Audit enrichment   — attach guardrail verdicts to the audit record
"""

import logging
import re
import time
from dataclasses import dataclass, field
from collections import defaultdict

logger = logging.getLogger(__name__)

# ── Configuration ────────────────────────────────────────────────────────────

MAX_INPUT_CHARS = 50_000          # Refuse if context > 50K chars
MAX_OUTPUT_CHARS = 15_000         # Truncate if output > 15K chars
RATE_LIMIT_PER_USER = 10          # Max reviews per user per hour
RATE_LIMIT_WINDOW_SECONDS = 3600  # 1 hour window

REQUIRED_SECTIONS = [
    "Executive Summary",
    "Key Metrics",
    "Recommendation",
]

# Patterns that indicate the LLM is overstepping its role
FORBIDDEN_PATTERNS = [
    r"(?i)I\s+hereby\s+approv",                      # LLM must not approve
    r"(?i)this\s+QRT\s+is\s+(?:hereby\s+)?approved",  # LLM must not approve
    r"(?i)submitted?\s+to\s+(?:the\s+)?(?:regulator|BaFin|EIOPA|PRA|ACPR)",  # LLM must not claim submission
    r"(?i)I\s+am\s+(?:a|the)\s+(?:appointed|chief)\s+actuary",  # LLM must not impersonate
    r"(?i)on\s+behalf\s+of\s+the\s+board",           # LLM must not claim authority
]

# PII patterns (conservative — flags for review, doesn't block)
PII_PATTERNS = [
    (r"\b[A-Z][a-z]+\s[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\s*(?:,\s*(?:FIA|FCA|CERA|ACAS|FCAS|FSA|MAAA))", "Named individual with credentials"),
    (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "Email address"),
    (r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b", "Phone number"),
    (r"\b\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{2}\b", "LEI-like identifier"),
]


# ── Data structures ──────────────────────────────────────────────────────────

@dataclass
class GuardrailVerdict:
    """Result of all guardrail checks — attached to audit record."""
    passed: bool = True
    checks_run: int = 0
    checks_passed: int = 0
    checks_failed: int = 0
    warnings: list[str] = field(default_factory=list)
    failures: list[str] = field(default_factory=list)
    pii_flags: list[str] = field(default_factory=list)
    output_truncated: bool = False
    rate_limited: bool = False

    def to_dict(self) -> dict:
        return {
            "passed": self.passed,
            "checks_run": self.checks_run,
            "checks_passed": self.checks_passed,
            "checks_failed": self.checks_failed,
            "warnings": self.warnings,
            "failures": self.failures,
            "pii_flags": self.pii_flags,
            "output_truncated": self.output_truncated,
            "rate_limited": self.rate_limited,
        }


# ── Rate limiter (in-memory, resets on app restart) ──────────────────────────

_rate_log: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(user: str) -> bool:
    """Return True if the user is within rate limits."""
    now = time.time()
    window = now - RATE_LIMIT_WINDOW_SECONDS
    # Prune old entries
    _rate_log[user] = [t for t in _rate_log[user] if t > window]
    if len(_rate_log[user]) >= RATE_LIMIT_PER_USER:
        return False
    _rate_log[user].append(now)
    return True


# ── Pre-call checks (on the prompt / input) ─────────────────────────────────

def validate_input(user_prompt: str, user: str) -> GuardrailVerdict:
    """Run all pre-call guardrails on the prompt before sending to LLM."""
    verdict = GuardrailVerdict()

    # 1. Rate limit
    verdict.checks_run += 1
    if not _check_rate_limit(user):
        verdict.rate_limited = True
        verdict.passed = False
        verdict.checks_failed += 1
        verdict.failures.append(
            f"Rate limit exceeded: max {RATE_LIMIT_PER_USER} reviews per hour per user"
        )
        return verdict  # Hard stop
    verdict.checks_passed += 1

    # 2. Input size
    verdict.checks_run += 1
    if len(user_prompt) > MAX_INPUT_CHARS:
        verdict.passed = False
        verdict.checks_failed += 1
        verdict.failures.append(
            f"Input too large: {len(user_prompt):,} chars (max {MAX_INPUT_CHARS:,})"
        )
        return verdict  # Hard stop
    verdict.checks_passed += 1

    # 3. Input not empty
    verdict.checks_run += 1
    if len(user_prompt.strip()) < 100:
        verdict.passed = False
        verdict.checks_failed += 1
        verdict.failures.append("Input context too small — insufficient data for review")
        return verdict
    verdict.checks_passed += 1

    return verdict


# ── Post-call checks (on the LLM output) ────────────────────────────────────

def validate_output(review_text: str) -> GuardrailVerdict:
    """Run all post-call guardrails on the LLM output."""
    verdict = GuardrailVerdict()

    # 1. Output size / truncation
    verdict.checks_run += 1
    if len(review_text) > MAX_OUTPUT_CHARS:
        verdict.output_truncated = True
        verdict.warnings.append(
            f"Output truncated: {len(review_text):,} chars -> {MAX_OUTPUT_CHARS:,}"
        )
    verdict.checks_passed += 1

    # 2. Required sections present
    for section in REQUIRED_SECTIONS:
        verdict.checks_run += 1
        if section.lower() in review_text.lower():
            verdict.checks_passed += 1
        else:
            verdict.checks_failed += 1
            verdict.warnings.append(f"Missing section: '{section}'")

    # 3. Forbidden patterns (LLM overstepping)
    for pattern in FORBIDDEN_PATTERNS:
        verdict.checks_run += 1
        match = re.search(pattern, review_text)
        if match:
            verdict.checks_failed += 1
            verdict.passed = False
            verdict.failures.append(
                f"Forbidden content detected: '{match.group()[:60]}...' — "
                "the AI must not approve QRTs or claim regulatory authority"
            )
        else:
            verdict.checks_passed += 1

    # 4. PII detection (warnings, not blockers)
    for pattern, label in PII_PATTERNS:
        verdict.checks_run += 1
        matches = re.findall(pattern, review_text)
        if matches:
            verdict.pii_flags.append(f"{label}: {len(matches)} occurrence(s)")
            verdict.warnings.append(f"Potential PII: {label}")
        verdict.checks_passed += 1  # PII is a warning, not a failure

    # 5. Non-empty output
    verdict.checks_run += 1
    if len(review_text.strip()) < 50:
        verdict.passed = False
        verdict.checks_failed += 1
        verdict.failures.append("Output too short — LLM may have refused or errored")
    else:
        verdict.checks_passed += 1

    return verdict


def truncate_output(text: str) -> str:
    """Truncate output to max length, preserving markdown structure."""
    if len(text) <= MAX_OUTPUT_CHARS:
        return text
    truncated = text[:MAX_OUTPUT_CHARS]
    # Try to cut at a section boundary
    last_header = truncated.rfind("\n## ")
    if last_header > MAX_OUTPUT_CHARS * 0.7:
        truncated = truncated[:last_header]
    truncated += "\n\n---\n*[Review truncated by guardrail — output exceeded maximum length]*"
    return truncated


# ── Governance summary (for the demo UI) ─────────────────────────────────────

def get_governance_controls() -> list[dict]:
    """Return a structured list of all governance controls for display."""
    return [
        {
            "layer": "Identity & Access",
            "control": "Databricks App Service Principal",
            "description": "The AI agent runs as the app service principal — not the end user. Unity Catalog governs which tables the agent can read.",
            "databricks_feature": "Unity Catalog + App Service Principals",
            "icon": "shield",
        },
        {
            "layer": "Identity & Access",
            "control": "App-level Permissions",
            "description": "Only users with CAN_USE permission on the app can trigger AI reviews. Controlled via Databricks workspace ACLs.",
            "databricks_feature": "Databricks Apps Permissions",
            "icon": "lock",
        },
        {
            "layer": "Model Access",
            "control": "Foundation Model API Endpoint ACL",
            "description": "The serving endpoint has its own ACL — only the app service principal can invoke the model. No direct user access to the LLM.",
            "databricks_feature": "Model Serving Endpoint Permissions",
            "icon": "key",
        },
        {
            "layer": "Input Guardrails",
            "control": "Input Size & Rate Limiting",
            "description": f"Prompts capped at {MAX_INPUT_CHARS:,} chars. Users limited to {RATE_LIMIT_PER_USER} reviews/hour to prevent abuse or runaway costs.",
            "databricks_feature": "Custom Guardrails + AI Gateway",
            "icon": "gauge",
        },
        {
            "layer": "Input Guardrails",
            "control": "Data Scope Restriction",
            "description": "The agent only receives pre-aggregated summary data — never raw policyholder or claims records. Summary tables are the maximum privilege boundary.",
            "databricks_feature": "Unity Catalog Row/Column Filters",
            "icon": "filter",
        },
        {
            "layer": "Output Guardrails",
            "control": "Forbidden Pattern Detection",
            "description": "Post-generation scan blocks the AI from approving QRTs, claiming regulatory authority, or impersonating named actuaries. Hard block — review is rejected.",
            "databricks_feature": "Custom Guardrails + Lakehouse Monitoring",
            "icon": "alert-triangle",
        },
        {
            "layer": "Output Guardrails",
            "control": "Required Section Verification",
            "description": "Every review must contain: Executive Summary, Key Metrics, and Recommendation. Missing sections trigger a warning.",
            "databricks_feature": "Custom Guardrails",
            "icon": "check-square",
        },
        {
            "layer": "Output Guardrails",
            "control": "PII Detection",
            "description": "Scans output for email addresses, phone numbers, and named individuals with actuarial credentials. Flags for human review.",
            "databricks_feature": "Custom Guardrails + AI Gateway",
            "icon": "eye-off",
        },
        {
            "layer": "Output Guardrails",
            "control": "Output Truncation",
            "description": f"Output capped at {MAX_OUTPUT_CHARS:,} chars to prevent token runaway. Truncation preserves markdown section boundaries.",
            "databricks_feature": "Custom Guardrails",
            "icon": "scissors",
        },
        {
            "layer": "Audit & Observability",
            "control": "Full Audit Trail in Unity Catalog",
            "description": "Every AI review is stored in 6_ai_reviews with: review_id, model_used, token counts, timestamp, user identity. Queryable via SQL.",
            "databricks_feature": "Unity Catalog Tables + System Tables",
            "icon": "database",
        },
        {
            "layer": "Audit & Observability",
            "control": "Lakehouse Monitoring",
            "description": "Token usage, latency, and guardrail pass rates can be tracked via Databricks Lakehouse Monitoring on the audit table.",
            "databricks_feature": "Lakehouse Monitoring + Alerts",
            "icon": "activity",
        },
        {
            "layer": "Human-in-the-Loop",
            "control": "AI Cannot Approve",
            "description": "The agent produces a review, not a decision. A human actuary must still click Approve or Reject. The AI review is attached as supporting evidence.",
            "databricks_feature": "App Workflow Design",
            "icon": "user-check",
        },
    ]
