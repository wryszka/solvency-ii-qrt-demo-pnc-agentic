# Databricks notebook source
# MAGIC %md
# MAGIC # Solvency II QRT Demo — AI Actuarial Review Agent
# MAGIC
# MAGIC ## Demo Walkthrough (Technical Version)
# MAGIC
# MAGIC This notebook walks through the **agentic workflow** added to the Solvency II QRT reporting platform.
# MAGIC An AI agent reviews each QRT before human sign-off, producing a structured actuarial assessment
# MAGIC in seconds — replacing 2-3 hours of manual analysis per template.
# MAGIC
# MAGIC ---
# MAGIC
# MAGIC ### Architecture
# MAGIC
# MAGIC ```
# MAGIC ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────┐
# MAGIC │ QRT Pipeline │───>│ Summary Data │───>│  AI Agent        │───>│ Human Review │
# MAGIC │ (DLT + Jobs) │    │ (Gold tables)│    │  (FMAPI + Guard) │    │ (Approve/Rej)│
# MAGIC └─────────────┘    └──────────────┘    └─────────────────┘    └──────────────┘
# MAGIC       │                    │                     │                     │
# MAGIC       ▼                    ▼                     ▼                     ▼
# MAGIC  Unity Catalog       Row/Col Filters      Audit in UC Table     Approval Table
# MAGIC  Lineage             Serving ACLs         Guardrail Verdicts    PDF Certificate
# MAGIC ```
# MAGIC
# MAGIC **Key principle:** The AI agent is an *advisor*, never a *decision-maker*.
# MAGIC It cannot approve, reject, or submit a QRT. A human actuary always has the final say.

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. What the Agent Sees
# MAGIC
# MAGIC The agent receives **pre-aggregated summary data only** — never raw policyholder records.
# MAGIC This is the maximum privilege boundary. Let's see what gets passed to the LLM.

# COMMAND ----------

# DBTITLE 1,Current Period — S.25.01 SCR Summary
catalog = "lr_serverless_aws_us_catalog"
schema = "solvency2demo_ai"

df = spark.sql(f"""
    SELECT * FROM {catalog}.{schema}.s2501_summary
    ORDER BY reporting_period DESC
    LIMIT 2
""")
display(df)

# COMMAND ----------

# MAGIC %md
# MAGIC The agent sees this summary (2 rows: current + prior quarter), not the 17 individual risk factor inputs.
# MAGIC It also receives:
# MAGIC - **Data quality results** from the DLT expectations
# MAGIC - **Cross-QRT reconciliation** checks
# MAGIC - **Model version info** (Champion vs Challenger)
# MAGIC
# MAGIC All of this is assembled server-side in `_gather_context()` and formatted into a structured prompt.

# COMMAND ----------

# DBTITLE 1,Data Quality Expectations for S.25.01
display(spark.sql(f"""
    SELECT expectation_name, total_records, passing_records, failing_records,
           ROUND(passing_records * 100.0 / total_records, 1) AS pass_rate_pct
    FROM {catalog}.{schema}.dq_expectation_results
    WHERE pipeline_name LIKE '%S.25.01%'
    AND reporting_period = (SELECT MAX(reporting_period) FROM {catalog}.{schema}.s2501_summary)
"""))

# COMMAND ----------

# DBTITLE 1,Cross-QRT Reconciliation
display(spark.sql(f"""
    SELECT source_qrt, target_qrt, check_description, status,
           source_value, target_value, difference, tolerance
    FROM {catalog}.{schema}.cross_qrt_reconciliation
    WHERE reporting_period = (SELECT MAX(reporting_period) FROM {catalog}.{schema}.s2501_summary)
"""))

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. How the Agent Works
# MAGIC
# MAGIC The agent is a **single-shot LLM call** via Databricks Foundation Model API (FMAPI).
# MAGIC No multi-turn conversation, no tool calling, no RAG. The entire context is in the prompt.
# MAGIC
# MAGIC | Component | Implementation |
# MAGIC |-----------|---------------|
# MAGIC | **Model** | Claude Sonnet (preferred) or Meta Llama 3.3 70B (fallback) |
# MAGIC | **System prompt** | Senior actuarial reviewer persona with structured output format |
# MAGIC | **User prompt** | Per-QRT template filled with summary data, DQ, reconciliation |
# MAGIC | **Temperature** | 0.2 (low creativity, high consistency) |
# MAGIC | **Max tokens** | 2,048 (sufficient for a 2-page review) |
# MAGIC | **Latency** | ~8-15 seconds |
# MAGIC
# MAGIC The prompt templates are QRT-specific. For example, S.25.01 focuses on:
# MAGIC - Solvency ratio level and trend
# MAGIC - Risk module movements
# MAGIC - Diversification benefit range
# MAGIC - Own funds composition
# MAGIC - Champion vs Challenger model impact

# COMMAND ----------

# DBTITLE 1,Calling the Agent Programmatically
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.serving import ChatMessage, ChatMessageRole

w = WorkspaceClient()

# The same call the app makes — try Sonnet, fall back to Llama
endpoints = [
    "databricks-claude-sonnet-4",
    "databricks-claude-3-7-sonnet",
    "databricks-meta-llama-3-3-70b-instruct",
]

endpoint = None
for ep in endpoints:
    try:
        info = w.serving_endpoints.get(ep)
        if info:
            endpoint = ep
            break
    except Exception:
        continue

print(f"Using model endpoint: {endpoint}")

# COMMAND ----------

# DBTITLE 1,System Prompt (Actuarial Reviewer Persona)
system_prompt = """You are a senior actuarial reviewer at a European P&C insurance company regulated under Solvency II.
You are reviewing a Quantitative Reporting Template (QRT) before it is submitted to the national supervisory authority.

Your review must be:
- Technically precise, using correct Solvency II terminology
- Structured with clear sections and bullet points
- Actionable — flag issues that need resolution vs observations for the record
- Concise — an experienced actuary should be able to read this in 2 minutes

Output your review in markdown format with these sections:
## Executive Summary
## Key Metrics
## Period-over-Period Analysis
## Data Quality Assessment
## Risk Flags
## Recommendation
"""

print(f"System prompt: {len(system_prompt)} chars")

# COMMAND ----------

# DBTITLE 1,Generate Review for S.25.01
import json

# Gather context (same as the app does)
summary = spark.sql(f"SELECT * FROM {catalog}.{schema}.s2501_summary ORDER BY reporting_period DESC LIMIT 2").toPandas()
current = summary.iloc[0].to_dict() if len(summary) > 0 else {}
prior = summary.iloc[1].to_dict() if len(summary) > 1 else {}

user_prompt = f"""Review the S.25.01 — SCR Standard Formula QRT for Bricksurance SE.
Reporting period: {current.get('reporting_period', 'Unknown')}.

## Current Period SCR Breakdown
{json.dumps(current, indent=2, default=str)}

## Prior Period SCR Breakdown
{json.dumps(prior, indent=2, default=str)}

Focus on: solvency ratio level/trend, risk module movements, diversification benefit, own funds composition.
"""

response = w.serving_endpoints.query(
    name=endpoint,
    messages=[
        ChatMessage(role=ChatMessageRole.SYSTEM, content=system_prompt),
        ChatMessage(role=ChatMessageRole.USER, content=user_prompt),
    ],
    max_tokens=2048,
    temperature=0.2,
)

review_text = response.choices[0].message.content
print(review_text)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Guardrails — Defence in Depth
# MAGIC
# MAGIC The agent has **12 governance controls** across 6 layers. This is what makes it safe
# MAGIC for a regulated environment.

# COMMAND ----------

# MAGIC %md
# MAGIC ### Layer 1: Identity & Access
# MAGIC
# MAGIC | Control | How |
# MAGIC |---------|-----|
# MAGIC | **App Service Principal** | The AI runs as the app SP, not the end user. UC governs table access. |
# MAGIC | **App Permissions** | Only users with `CAN_USE` on the app can trigger reviews. |
# MAGIC
# MAGIC ### Layer 2: Model Access
# MAGIC
# MAGIC | Control | How |
# MAGIC |---------|-----|
# MAGIC | **Serving Endpoint ACL** | Only the app SP can invoke the model. No direct user access. |
# MAGIC
# MAGIC ### Layer 3: Input Guardrails
# MAGIC
# MAGIC | Control | How |
# MAGIC |---------|-----|
# MAGIC | **Input Size Cap** | Prompts limited to 50,000 chars — prevents runaway token costs |
# MAGIC | **Rate Limiting** | 10 reviews/user/hour — prevents abuse |
# MAGIC | **Data Scope** | Only summary tables, never raw records |
# MAGIC
# MAGIC ### Layer 4: Output Guardrails
# MAGIC
# MAGIC | Control | How |
# MAGIC |---------|-----|
# MAGIC | **Forbidden Patterns** | Blocks: "I hereby approve", "submitted to regulator", "on behalf of the board" |
# MAGIC | **Required Sections** | Must contain: Executive Summary, Key Metrics, Recommendation |
# MAGIC | **PII Detection** | Flags: email addresses, phone numbers, named individuals with credentials |
# MAGIC | **Output Truncation** | Capped at 15,000 chars |
# MAGIC
# MAGIC ### Layer 5: Audit & Observability
# MAGIC
# MAGIC | Control | How |
# MAGIC |---------|-----|
# MAGIC | **Audit Table** | Every review stored in `qrt_ai_reviews` with full provenance |
# MAGIC | **Lakehouse Monitoring** | Token usage, latency, pass rates trackable via system tables |
# MAGIC
# MAGIC ### Layer 6: Human-in-the-Loop
# MAGIC
# MAGIC | Control | How |
# MAGIC |---------|-----|
# MAGIC | **AI Cannot Approve** | The agent produces a review, not a decision. Human always decides. |

# COMMAND ----------

# DBTITLE 1,Guardrails in Action — Forbidden Pattern Detection
import re

# These patterns will BLOCK the review if detected in LLM output
forbidden_patterns = [
    (r"(?i)I\s+hereby\s+approv", "LLM must not approve"),
    (r"(?i)this\s+QRT\s+is\s+(?:hereby\s+)?approved", "LLM must not approve"),
    (r"(?i)submitted?\s+to\s+(?:the\s+)?(?:regulator|BaFin|EIOPA)", "LLM must not claim submission"),
    (r"(?i)I\s+am\s+(?:a|the)\s+(?:appointed|chief)\s+actuary", "LLM must not impersonate"),
    (r"(?i)on\s+behalf\s+of\s+the\s+board", "LLM must not claim authority"),
]

# Test against the actual review
for pattern, reason in forbidden_patterns:
    match = re.search(pattern, review_text)
    status = "BLOCKED" if match else "PASS"
    print(f"  [{status}] {reason}")

# COMMAND ----------

# DBTITLE 1,Guardrails in Action — Required Section Check
required = ["Executive Summary", "Key Metrics", "Recommendation"]
for section in required:
    found = section.lower() in review_text.lower()
    print(f"  [{'PASS' if found else 'WARN'}] Section: {section}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Audit Trail
# MAGIC
# MAGIC Every AI review is persisted to a Unity Catalog table. This gives us:
# MAGIC - **Who** triggered the review
# MAGIC - **When** it was generated
# MAGIC - **Which model** was used
# MAGIC - **Token usage** for cost tracking
# MAGIC - **Full text** of the review for compliance audit

# COMMAND ----------

# DBTITLE 1,AI Review Audit Log
display(spark.sql(f"""
    SELECT review_id, qrt_id, reporting_period, model_used,
           input_tokens, output_tokens, created_at, created_by
    FROM {catalog}.{schema}.qrt_ai_reviews
    ORDER BY created_at DESC
    LIMIT 10
"""))

# COMMAND ----------

# MAGIC %md
# MAGIC ## 5. Comparing All 4 QRTs
# MAGIC
# MAGIC The same agent architecture works across all 4 QRTs with QRT-specific prompts:
# MAGIC
# MAGIC | QRT | Focus Areas |
# MAGIC |-----|-------------|
# MAGIC | **S.06.02** (Assets) | Allocation shifts, credit quality, duration risk, concentration |
# MAGIC | **S.05.01** (P&L) | Combined ratio by LoB, loss ratio trends, large losses |
# MAGIC | **S.25.01** (SCR) | Solvency ratio, risk modules, diversification, model version |
# MAGIC | **S.26.06** (NL Risk) | Premium vs reserve risk, cat risk, stochastic model output |
# MAGIC
# MAGIC Each prompt template is calibrated with actuarial domain knowledge —
# MAGIC the expected ranges, typical ratios, and red-flag thresholds for a European P&C insurer.

# COMMAND ----------

# MAGIC %md
# MAGIC ## 6. Live Demo — The App
# MAGIC
# MAGIC Open the deployed app and navigate to any QRT → **Approve / Export** tab:
# MAGIC
# MAGIC 1. Click **Generate AI Review**
# MAGIC 2. Watch the progress bar (8-15 seconds)
# MAGIC 3. Read the structured actuarial assessment
# MAGIC 4. Expand **Guardrails** banner — see checks passed/failed
# MAGIC 5. Expand **Agent Governance & Security Controls** — see all 12 controls
# MAGIC 6. Copy the review, attach to approval, then Approve or Reject
# MAGIC
# MAGIC The AI accelerates the review — the human makes the decision.
# MAGIC
# MAGIC ---
# MAGIC
# MAGIC **App URL:** `https://solvency2-qrt-ai-7474659673789953.aws.databricksapps.com`

# COMMAND ----------

# MAGIC %md
# MAGIC ## Summary
# MAGIC
# MAGIC | Capability | Before | After (with Agent) |
# MAGIC |-----------|--------|-------------------|
# MAGIC | QRT review time | 2-3 hours per template | ~15 seconds |
# MAGIC | Review consistency | Varies by reviewer | Structured, repeatable |
# MAGIC | Period comparison | Manual spreadsheet | Automated with % changes |
# MAGIC | Risk flag detection | Depends on experience | Systematic pattern matching |
# MAGIC | Audit trail | Email threads | Queryable UC table |
# MAGIC | Human decision | Always | Always (agent is advisory only) |
# MAGIC
# MAGIC ### Databricks Components Used
# MAGIC
# MAGIC - **Foundation Model API** — Claude Sonnet / Llama 70B via serving endpoints
# MAGIC - **Unity Catalog** — Table governance, model registry, audit tables
# MAGIC - **DLT** — Data quality expectations (the DQ data the agent reviews)
# MAGIC - **Databricks Apps** — Secure deployment with service principal isolation
# MAGIC - **Serving Endpoint ACLs** — Model access control
# MAGIC - **Lakehouse Monitoring** — Token/latency observability (configurable)
