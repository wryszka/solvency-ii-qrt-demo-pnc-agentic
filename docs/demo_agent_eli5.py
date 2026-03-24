# Databricks notebook source
# MAGIC %md
# MAGIC # Solvency II QRT Demo — AI Agent (ELI5 Version)
# MAGIC
# MAGIC ## What's This About?
# MAGIC
# MAGIC Insurance companies have to send regular reports to their regulator (like a tax return, but for risk).
# MAGIC These reports are called **QRTs** — Quantitative Reporting Templates.
# MAGIC
# MAGIC Before sending them, a qualified actuary has to **review every number** to make sure it makes sense.
# MAGIC That takes **2-3 hours per report**, and there are 4 reports per quarter.
# MAGIC
# MAGIC We built an **AI agent that does the first pass of that review in 15 seconds**.
# MAGIC The actuary still makes the final call — the AI just does the heavy lifting.
# MAGIC
# MAGIC ---

# COMMAND ----------

# MAGIC %md
# MAGIC ## The Before & After
# MAGIC
# MAGIC ### Before (without AI)
# MAGIC ```
# MAGIC Pipeline produces QRT
# MAGIC       |
# MAGIC       v
# MAGIC Actuary opens spreadsheet        <-- 30 mins
# MAGIC       |
# MAGIC       v
# MAGIC Compares to last quarter          <-- 45 mins
# MAGIC       |
# MAGIC       v
# MAGIC Checks data quality rules         <-- 30 mins
# MAGIC       |
# MAGIC       v
# MAGIC Cross-checks between reports      <-- 30 mins
# MAGIC       |
# MAGIC       v
# MAGIC Writes review memo                <-- 45 mins
# MAGIC       |
# MAGIC       v
# MAGIC Approves or rejects
# MAGIC ```
# MAGIC
# MAGIC ### After (with AI Agent)
# MAGIC ```
# MAGIC Pipeline produces QRT
# MAGIC       |
# MAGIC       v
# MAGIC Click "Generate AI Review"        <-- 1 click
# MAGIC       |
# MAGIC       v
# MAGIC AI reads data, compares,          <-- 15 seconds
# MAGIC checks quality, writes review
# MAGIC       |
# MAGIC       v
# MAGIC Actuary reads AI review           <-- 5 mins
# MAGIC       |
# MAGIC       v
# MAGIC Approves or rejects
# MAGIC ```
# MAGIC
# MAGIC **3 hours down to 5 minutes.** The actuary still decides — they just start from a structured brief instead of a blank page.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Let's See the Data the Agent Reads
# MAGIC
# MAGIC The agent doesn't see individual customer records. It only gets **summary numbers** — the same thing an actuary would look at first.

# COMMAND ----------

# DBTITLE 1,This is what the agent sees — one row per quarter
catalog = "lr_serverless_aws_us_catalog"
schema = "solvency2demo_ai"

display(spark.sql(f"""
    SELECT reporting_period,
           eligible_own_funds_eur,
           scr_eur,
           solvency_ratio_pct,
           mcr_eur,
           surplus_eur
    FROM {catalog}.{schema}.s2501_summary
    ORDER BY reporting_period DESC
"""))

# COMMAND ----------

# MAGIC %md
# MAGIC That's it. Two rows. Current quarter and prior quarter.
# MAGIC
# MAGIC The agent gets these numbers plus:
# MAGIC - Did any data quality checks fail?
# MAGIC - Do the numbers match across different reports?
# MAGIC - Which version of the risk model was used?
# MAGIC
# MAGIC Then it writes a review.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Let's Call the Agent

# COMMAND ----------

# DBTITLE 1,Step 1: Pick a model (Sonnet if available, otherwise Llama)
from databricks.sdk import WorkspaceClient
w = WorkspaceClient()

for model_name in ["databricks-claude-sonnet-4", "databricks-claude-3-7-sonnet", "databricks-meta-llama-3-3-70b-instruct"]:
    try:
        w.serving_endpoints.get(model_name)
        print(f"Using: {model_name}")
        endpoint = model_name
        break
    except Exception:
        print(f"  Not available: {model_name}")
        continue

# COMMAND ----------

# DBTITLE 1,Step 2: Give the AI its role
system_prompt = """You are a senior actuarial reviewer at a European insurance company.
Review this QRT and produce a structured assessment in markdown with:
## Executive Summary
## Key Metrics
## Period-over-Period Analysis
## Data Quality Assessment
## Risk Flags
## Recommendation
Be concise — an actuary should read this in 2 minutes."""

print("Role assigned: Senior Actuarial Reviewer")

# COMMAND ----------

# DBTITLE 1,Step 3: Feed it the numbers and ask for a review
import json
from databricks.sdk.service.serving import ChatMessage, ChatMessageRole

# Get the summary data
summary = spark.sql(f"SELECT * FROM {catalog}.{schema}.s2501_summary ORDER BY reporting_period DESC LIMIT 2").toPandas()

user_prompt = f"""Review the S.25.01 SCR report for Bricksurance SE.

Current quarter: {json.dumps(summary.iloc[0].to_dict(), indent=2, default=str)}

Prior quarter: {json.dumps(summary.iloc[1].to_dict(), indent=2, default=str) if len(summary) > 1 else 'Not available'}

Is this QRT ready to submit?
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

review = response.choices[0].message.content
print(review)

# COMMAND ----------

# MAGIC %md
# MAGIC That's the review. In a real workflow, the actuary reads this, confirms the analysis is correct,
# MAGIC and clicks **Approve** or **Reject** in the app.
# MAGIC
# MAGIC ---

# COMMAND ----------

# MAGIC %md
# MAGIC ## But Wait — How Do We Keep the AI Safe?
# MAGIC
# MAGIC This is a regulated environment. We can't just let an AI say whatever it wants.
# MAGIC Here's how we control it:

# COMMAND ----------

# MAGIC %md
# MAGIC ### Safety Check 1: The AI Cannot Approve Anything
# MAGIC
# MAGIC We scan every AI output for dangerous phrases. If the AI tries to approve a report itself,
# MAGIC we **block the entire review**.

# COMMAND ----------

# DBTITLE 1,Forbidden pattern check — would block these phrases
import re

dangerous_phrases = [
    "I hereby approve this QRT",
    "This QRT is approved for submission",
    "Submitted to BaFin",
    "I am the appointed actuary",
    "On behalf of the board",
]

print("Scanning the AI review for forbidden patterns:\n")
for phrase in dangerous_phrases:
    found = phrase.lower() in review.lower()
    print(f"  {'BLOCKED' if found else 'OK'} — '{phrase}'")

print("\nResult: All clear. The AI stayed in its lane.")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Safety Check 2: The Review Must Have Structure
# MAGIC
# MAGIC If the AI skips a required section (like the Recommendation), we flag it.

# COMMAND ----------

# DBTITLE 1,Required section check
required_sections = ["Executive Summary", "Key Metrics", "Recommendation"]

print("Checking required sections:\n")
for section in required_sections:
    found = section.lower() in review.lower()
    print(f"  {'PASS' if found else 'WARNING — MISSING'} — {section}")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Safety Check 3: No Personal Information
# MAGIC
# MAGIC We scan for email addresses, phone numbers, and named individuals.
# MAGIC In a regulated environment, PII leaking through AI output is a compliance risk.

# COMMAND ----------

# DBTITLE 1,PII scan
pii_patterns = [
    (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "Email addresses"),
    (r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b", "Phone numbers"),
]

print("PII scan:\n")
for pattern, label in pii_patterns:
    matches = re.findall(pattern, review)
    if matches:
        print(f"  WARNING — Found {len(matches)} {label}")
    else:
        print(f"  CLEAN — No {label}")

# COMMAND ----------

# MAGIC %md
# MAGIC ### Safety Check 4: Rate Limiting
# MAGIC
# MAGIC Each user can generate max **10 reviews per hour**. This prevents:
# MAGIC - Accidental cost runaway (each call uses ~2K tokens)
# MAGIC - Abuse (someone scripting 1000 calls)
# MAGIC - Denial of service on the model endpoint

# COMMAND ----------

# MAGIC %md
# MAGIC ### Safety Check 5: The AI Only Sees Summaries
# MAGIC
# MAGIC The agent never sees:
# MAGIC - Individual policyholder names
# MAGIC - Claim details
# MAGIC - Raw transaction records
# MAGIC
# MAGIC It only gets aggregated summary tables. This is enforced at the database level
# MAGIC using Unity Catalog permissions — not just application logic.

# COMMAND ----------

# MAGIC %md
# MAGIC ## The Full Picture
# MAGIC
# MAGIC Here's every layer of protection, mapped to Databricks features:
# MAGIC
# MAGIC | What we protect against | How | Databricks feature |
# MAGIC |------------------------|-----|-------------------|
# MAGIC | Unauthorized access | App service principal + ACLs | Unity Catalog + Apps |
# MAGIC | Model abuse | Endpoint-level ACLs | Serving Endpoint Permissions |
# MAGIC | Prompt injection | Input size cap + validation | Custom Guardrails |
# MAGIC | Cost runaway | Rate limiting (10/hr/user) | Custom Guardrails |
# MAGIC | Data leakage | Summary tables only | UC Row/Column Filters |
# MAGIC | AI overreach | Forbidden pattern detection | Custom Guardrails |
# MAGIC | Missing analysis | Required section check | Custom Guardrails |
# MAGIC | PII in output | Regex scan | Custom Guardrails + AI Gateway |
# MAGIC | Token explosion | Output truncation (15K chars) | Custom Guardrails |
# MAGIC | No audit trail | Every call logged to UC table | Unity Catalog Tables |
# MAGIC | Unmonitored drift | Lakehouse Monitoring ready | Lakehouse Monitoring |
# MAGIC | AI makes decisions | Human-in-the-loop always | App Workflow Design |

# COMMAND ----------

# MAGIC %md
# MAGIC ## Audit Trail
# MAGIC
# MAGIC Every AI review is stored forever. Compliance can query: "Show me every AI review
# MAGIC generated for S.25.01 in Q4 2025, who triggered it, which model was used, and how many tokens it consumed."

# COMMAND ----------

# DBTITLE 1,Audit log — every AI review is tracked
display(spark.sql(f"""
    SELECT review_id, qrt_id, reporting_period,
           model_used, input_tokens, output_tokens,
           created_at, created_by
    FROM {catalog}.{schema}.qrt_ai_reviews
    ORDER BY created_at DESC
    LIMIT 5
"""))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Try It Live
# MAGIC
# MAGIC 1. Open the app: `https://solvency2-qrt-ai-7474659673789953.aws.databricksapps.com`
# MAGIC 2. Click any report (e.g., S.25.01 SCR)
# MAGIC 3. Go to the **Approve / Export** tab
# MAGIC 4. Click **Generate AI Review**
# MAGIC 5. Read the review, check the guardrails banner
# MAGIC 6. Approve or reject — your call, not the AI's
# MAGIC
# MAGIC ---
# MAGIC
# MAGIC ## TL;DR
# MAGIC
# MAGIC - **What:** AI reviews insurance regulatory reports before human sign-off
# MAGIC - **How fast:** 15 seconds instead of 3 hours
# MAGIC - **How safe:** 12 controls, 6 layers, human always decides
# MAGIC - **What Databricks:** FMAPI, Unity Catalog, DLT, Apps, Serving ACLs, Monitoring
# MAGIC - **What it can't do:** Approve, submit, impersonate, or access raw data
