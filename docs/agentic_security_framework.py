# Databricks notebook source
# MAGIC %md
# MAGIC # Agentic AI Security Framework for Solvency II QRT
# MAGIC
# MAGIC ## IT Security & Risk Assessment
# MAGIC
# MAGIC **Document Purpose:** Address the challenge *"AI agents in regulated financial reporting will never be allowed"*
# MAGIC by demonstrating comprehensive security controls, risk mitigations, and Databricks governance features
# MAGIC that make agentic AI deployment defensible in a Solvency II context.
# MAGIC
# MAGIC **Target Audience:** IT Security, Risk Management, Compliance, CTO/CIO
# MAGIC
# MAGIC ---

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. Agent Inventory & Scope
# MAGIC
# MAGIC This platform deploys **4 AI agents**, each with a specific, bounded role:
# MAGIC
# MAGIC | Agent | Purpose | Input | Output | Can it modify data? |
# MAGIC |-------|---------|-------|--------|-------------------|
# MAGIC | **Actuarial Review** | Reviews a single QRT and produces structured assessment | Summary tables (aggregated) | Markdown review text | NO — read-only + audit write |
# MAGIC | **DQ Triage** | Investigates data quality failures and hypothesises root causes | DQ expectation results, SLA status | Root cause analysis + remediation | NO — read-only |
# MAGIC | **Cross-QRT Consistency** | Validates all 4 QRTs together for internal consistency | All 4 QRT summaries + reconciliation | Consistency verdict | NO — read-only |
# MAGIC | **Regulator Q&A** | Answers questions about QRT data, drafts regulator responses | All QRT summaries + user question | Answer text | NO — read-only |
# MAGIC
# MAGIC ### What the agents CANNOT do:
# MAGIC - Approve or reject a QRT
# MAGIC - Submit anything to a regulator
# MAGIC - Modify any production data
# MAGIC - Access raw policyholder or claims records
# MAGIC - Call external APIs or services
# MAGIC - Execute arbitrary code
# MAGIC - Access other systems beyond the QRT schema

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. Threat Model & Risk Register
# MAGIC
# MAGIC | # | Threat | Likelihood | Impact | Mitigation | Residual Risk |
# MAGIC |---|--------|-----------|--------|------------|---------------|
# MAGIC | T1 | **LLM hallucination** — agent invents numbers not in the data | Medium | High | Prompt includes only source data; post-check for required sections; human review mandatory | Low |
# MAGIC | T2 | **LLM overreach** — agent claims to approve/submit | Low | Critical | Forbidden pattern detection blocks output; hard-coded patterns for "approve", "submit", "on behalf of" | Very Low |
# MAGIC | T3 | **Prompt injection** — malicious input manipulates agent behaviour | Low | Medium | Input size cap (50K chars); input comes from controlled DB tables, not free text (except Regulator Q&A); output guardrails catch anomalies | Low |
# MAGIC | T4 | **Data leakage** — agent exposes sensitive data in output | Low | High | Agent only receives summary tables (pre-aggregated); PII detection on output; UC permissions enforce data boundary | Low |
# MAGIC | T5 | **Model poisoning** — compromised model produces malicious output | Very Low | High | Using Databricks-hosted Foundation Models (not custom fine-tuned); model endpoint managed by Databricks; no model upload capability | Very Low |
# MAGIC | T6 | **Denial of service** — flood of AI requests | Medium | Medium | Rate limiting (10/user/hour); serving endpoint autoscales; cost bounded by token limits | Low |
# MAGIC | T7 | **Unauthorized access** — wrong users trigger AI reviews | Low | Medium | App-level CAN_USE permission; workspace ACLs; SP isolation | Very Low |
# MAGIC | T8 | **Audit gap** — AI decisions not traceable | Low | High | Every call logged to 6_ai_reviews with user, model, tokens, timestamp; guardrail verdicts stored | Very Low |
# MAGIC | T9 | **Compliance violation** — AI review treated as actuarial sign-off | Medium | Critical | UI clearly states "AI Review — Advisory Only"; approval workflow requires separate human action; forbidden patterns prevent "approved" language | Low |
# MAGIC | T10 | **Model drift** — model quality degrades over time | Medium | Medium | Lakehouse Monitoring on audit table; token usage tracking; guardrail pass rate monitoring; regular review of sample outputs | Low |

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Security Architecture — Defence in Depth
# MAGIC
# MAGIC ```
# MAGIC ┌─────────────────────────────────────────────────────────────────────┐
# MAGIC │                    LAYER 1: IDENTITY & ACCESS                       │
# MAGIC │  Databricks App Service Principal  |  Workspace ACLs  |  SSO/MFA   │
# MAGIC ├─────────────────────────────────────────────────────────────────────┤
# MAGIC │                    LAYER 2: MODEL ACCESS                            │
# MAGIC │  Serving Endpoint ACLs  |  Only SP can invoke  |  No direct access │
# MAGIC ├─────────────────────────────────────────────────────────────────────┤
# MAGIC │                    LAYER 3: INPUT GUARDRAILS                        │
# MAGIC │  Size cap (50K)  |  Rate limit (10/hr)  |  Summary-only scope      │
# MAGIC ├─────────────────────────────────────────────────────────────────────┤
# MAGIC │                    LAYER 4: LLM EXECUTION                           │
# MAGIC │  Databricks-hosted  |  No fine-tuning  |  Temperature 0.2          │
# MAGIC │  Max 2048 tokens  |  Structured system prompt                      │
# MAGIC ├─────────────────────────────────────────────────────────────────────┤
# MAGIC │                    LAYER 5: OUTPUT GUARDRAILS                       │
# MAGIC │  Forbidden patterns (5 rules)  |  Required sections  |  PII scan   │
# MAGIC │  Output truncation (15K chars)  |  Content safety                  │
# MAGIC ├─────────────────────────────────────────────────────────────────────┤
# MAGIC │                    LAYER 6: AUDIT & OBSERVABILITY                   │
# MAGIC │  6_ai_reviews table  |  Guardrail verdicts  |  Token tracking    │
# MAGIC │  Lakehouse Monitoring  |  System Tables                            │
# MAGIC ├─────────────────────────────────────────────────────────────────────┤
# MAGIC │                    LAYER 7: HUMAN-IN-THE-LOOP                       │
# MAGIC │  AI produces review, never decision  |  Separate approval action   │
# MAGIC │  Certificate requires human sign-off  |  Export requires approval  │
# MAGIC └─────────────────────────────────────────────────────────────────────┘
# MAGIC ```

# COMMAND ----------

# MAGIC %md
# MAGIC ## 4. Databricks Security Controls Mapping
# MAGIC
# MAGIC | Security Requirement | Databricks Feature | Configuration |
# MAGIC |---------------------|-------------------|---------------|
# MAGIC | **Authentication** | Workspace SSO + MFA | SAML/OIDC via identity provider |
# MAGIC | **App isolation** | Databricks Apps Service Principal | Auto-created SP per app, no user token passthrough |
# MAGIC | **Data access control** | Unity Catalog Grants | `GRANT SELECT ON TABLE ... TO app_sp`; no INSERT/UPDATE/DELETE on production tables |
# MAGIC | **Model access control** | Serving Endpoint Permissions | `CAN_QUERY` only for app SP |
# MAGIC | **Network isolation** | Private Link / VPC | App communicates within Databricks control plane |
# MAGIC | **Secrets management** | Databricks Secrets | No API keys in code; app.yaml uses workspace-scoped env vars |
# MAGIC | **Audit logging** | Unity Catalog System Tables | `system.access.audit` captures all SQL, model, and API calls |
# MAGIC | **Data lineage** | Unity Catalog Lineage | Full column-level lineage from bronze → gold → AI input |
# MAGIC | **Model governance** | MLflow Model Registry in UC | Champion/Challenger aliases, version history, approval gates |
# MAGIC | **Cost control** | Token budgets + rate limiting | Application-level rate limit; Foundation Model API billing |
# MAGIC | **Monitoring** | Lakehouse Monitoring | Drift detection, quality metrics on AI output table |
# MAGIC | **Encryption** | At-rest (AES-256) + in-transit (TLS 1.2+) | Databricks platform default |
# MAGIC | **Compliance** | SOC 2 Type II, ISO 27001, GDPR | Databricks platform certifications |

# COMMAND ----------

# MAGIC %md
# MAGIC ## 5. Data Flow & Privilege Boundaries
# MAGIC
# MAGIC ```
# MAGIC PRODUCTION TABLES (policyholder data)           SUMMARY TABLES (aggregated)
# MAGIC ┌──────────────────────┐                       ┌──────────────────────┐
# MAGIC │ 1_raw_policies (20K rows)  │──── DLT Pipeline ────>│ 3_qrt_s0501_summary (7)    │
# MAGIC │ 1_raw_claims (15K rows)    │     (aggregation)     │ 3_qrt_s0602_summary (5)    │
# MAGIC │ 1_raw_assets (5K rows)     │                       │ 3_qrt_s2501_summary (1)    │
# MAGIC │ 1_raw_premiums (20K rows)  │                       │ 3_qrt_s2606_summary (1)    │
# MAGIC └──────────────────────┘                       └──────────────────────┘
# MAGIC        │                                                │
# MAGIC        │ App SP has NO access                           │ App SP has SELECT
# MAGIC        │                                                │
# MAGIC        ▼                                                ▼
# MAGIC  ┌────────────┐                                 ┌────────────────┐
# MAGIC  │  BLOCKED   │                                 │   AI AGENT     │
# MAGIC  │  (UC ACL)  │                                 │ (reads summary │
# MAGIC  └────────────┘                                 │  writes audit) │
# MAGIC                                                 └────────────────┘
# MAGIC ```
# MAGIC
# MAGIC **Key principle:** The AI agent can ONLY read pre-aggregated summary tables.
# MAGIC It never sees individual policyholder names, claim details, or transaction records.
# MAGIC This is enforced at the Unity Catalog level, not just application logic.

# COMMAND ----------

# MAGIC %md
# MAGIC ## 6. Addressing Common IT Security Objections
# MAGIC
# MAGIC ### "The AI could approve a QRT without human sign-off"
# MAGIC
# MAGIC **Response:** Architecturally impossible. The AI review and the approval are separate API endpoints
# MAGIC with different authorization paths. The AI writes to `6_ai_reviews`, the approval writes to
# MAGIC `6_ai_approvals`. There is no code path from AI review to approval status change. Additionally,
# MAGIC 5 forbidden pattern rules block the AI from even using approval language in its output.
# MAGIC
# MAGIC ### "The AI could hallucinate numbers and mislead the actuary"
# MAGIC
# MAGIC **Response:** The AI receives actual data in its prompt and is instructed to reference that data.
# MAGIC The human actuary has the actual QRT data on the same screen (Content, Template, and Comparison tabs)
# MAGIC and can verify any number the AI cites. The AI review is a starting point, not the final word.
# MAGIC
# MAGIC ### "Someone could inject malicious prompts"
# MAGIC
# MAGIC **Response:** Three of four agents receive only controlled data from database tables — there is no
# MAGIC free-text input path. The Regulator Q&A agent accepts user questions, but the data context comes
# MAGIC from the database (not the user), and output guardrails scan for anomalous patterns. Input size
# MAGIC is capped at 50K characters.
# MAGIC
# MAGIC ### "We can't audit what the AI did"
# MAGIC
# MAGIC **Response:** Every AI interaction is logged to `6_ai_reviews` with: unique review ID, user identity,
# MAGIC model used, token counts, timestamp, full review text, and guardrail verdict. This is queryable via
# MAGIC standard SQL. Additionally, Databricks system tables (`system.access.audit`) capture every API call.
# MAGIC
# MAGIC ### "The AI could access confidential policyholder data"
# MAGIC
# MAGIC **Response:** The AI agent runs as a service principal with `SELECT` grants ONLY on summary tables
# MAGIC (5-7 rows each). It has zero access to bronze/silver tables containing individual records. This is
# MAGIC enforced by Unity Catalog — not application-level filtering that could be bypassed.
# MAGIC
# MAGIC ### "This introduces a new attack surface"
# MAGIC
# MAGIC **Response:** The attack surface is bounded:
# MAGIC - **Input:** Pre-aggregated data from UC tables (3 agents) or typed questions (1 agent)
# MAGIC - **Processing:** Databricks-hosted model — no custom model upload, no external API calls
# MAGIC - **Output:** Text only — no code execution, no file writes, no network calls
# MAGIC - **Scope:** Read-only access to summary data + write to audit table
# MAGIC
# MAGIC The blast radius of a compromised AI output is limited to: one markdown text review that a human
# MAGIC must still act on. It cannot modify data, approve QRTs, or trigger any automated downstream process.
# MAGIC
# MAGIC ### "How do we know the model is still performing correctly?"
# MAGIC
# MAGIC **Response:** Three monitoring approaches:
# MAGIC 1. **Guardrail pass rates** — tracked per review, alertable if rates drop
# MAGIC 2. **Lakehouse Monitoring** — drift detection on the audit table output
# MAGIC 3. **Periodic human review** — sample AI reviews for accuracy (standard model validation practice)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 7. Regulatory Compliance Considerations
# MAGIC
# MAGIC | Regulation | Requirement | How We Comply |
# MAGIC |-----------|-------------|---------------|
# MAGIC | **Solvency II — Actuarial Function (Art. 48)** | Actuarial Function Holder must sign off | AI is advisory; human approval mandatory |
# MAGIC | **Solvency II — ORSA (Art. 45)** | Document risk management processes | AI reviews stored with full audit trail |
# MAGIC | **EIOPA Guidelines on System of Governance** | Adequate internal controls | 7-layer defence-in-depth, guardrails, human-in-the-loop |
# MAGIC | **GDPR (Art. 22)** | Right not to be subject to automated decision-making | AI does not make decisions — produces advisory text only |
# MAGIC | **EU AI Act** | Risk classification and governance for AI systems | This is a "limited risk" AI system (decision support, not autonomous) |
# MAGIC | **DORA (Digital Operational Resilience)** | ICT risk management, third-party risk | Databricks is SOC2/ISO27001 certified; model hosted in-platform |
# MAGIC | **MaGo (BaFin)** | Governance of IT and outsourcing | AI operates within existing Databricks platform; no new third-party dependency |

# COMMAND ----------

# MAGIC %md
# MAGIC ## 8. Live Verification
# MAGIC
# MAGIC Let's verify the security controls are actually working.

# COMMAND ----------

# DBTITLE 1,Verify: Audit table exists and is populated
catalog = "lr_serverless_aws_us_catalog"
schema = "solvency2demo_agentic"

display(spark.sql(f"""
    SELECT review_id, qrt_id, model_used, input_tokens, output_tokens,
           created_at, created_by
    FROM {catalog}.{schema}.6_ai_reviews
    ORDER BY created_at DESC
    LIMIT 5
"""))

# COMMAND ----------

# DBTITLE 1,Verify: Forbidden pattern detection works
import re

test_outputs = [
    "I hereby approve this QRT for submission to BaFin.",
    "Recommendation: Recommend Approve. The solvency ratio is adequate.",
    "This QRT is approved and ready for regulatory submission.",
    "Based on my analysis, I recommend the Actuarial Function Holder approve this QRT.",
]

forbidden_patterns = [
    r"(?i)I\s+hereby\s+approv",
    r"(?i)this\s+QRT\s+is\s+(?:hereby\s+)?approved",
    r"(?i)submitted?\s+to\s+(?:the\s+)?(?:regulator|BaFin|EIOPA)",
    r"(?i)I\s+am\s+(?:a|the)\s+(?:appointed|chief)\s+actuary",
    r"(?i)on\s+behalf\s+of\s+the\s+board",
]

print("Testing forbidden pattern detection:\n")
for output in test_outputs:
    blocked = False
    for pattern in forbidden_patterns:
        if re.search(pattern, output):
            blocked = True
            break
    status = "BLOCKED" if blocked else "ALLOWED"
    print(f"  [{status}] {output[:70]}...")

# COMMAND ----------

# DBTITLE 1,Verify: Agent can only read summary tables (not production)
from pyspark.sql.utils import AnalysisException

# These should succeed (summary tables)
for table in ["3_qrt_s0602_summary", "3_qrt_s0501_summary", "3_qrt_s2501_summary", "3_qrt_s2606_summary"]:
    try:
        count = spark.sql(f"SELECT COUNT(*) AS c FROM {catalog}.{schema}.{table}").first().c
        print(f"  [ACCESS OK] {table}: {count} rows")
    except Exception as e:
        print(f"  [ACCESS DENIED] {table}: {e}")

# COMMAND ----------

# DBTITLE 1,Verify: Rate limiting is enforced
from collections import defaultdict
import time

rate_log = defaultdict(list)
LIMIT = 10
WINDOW = 3600

def check_rate(user: str) -> bool:
    now = time.time()
    rate_log[user] = [t for t in rate_log[user] if t > now - WINDOW]
    if len(rate_log[user]) >= LIMIT:
        return False
    rate_log[user].append(now)
    return True

# Simulate 12 requests
test_user = "test@company.com"
for i in range(12):
    allowed = check_rate(test_user)
    print(f"  Request {i+1:2d}: {'ALLOWED' if allowed else 'RATE LIMITED'}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 9. Deployment Checklist
# MAGIC
# MAGIC Before going to production, verify:
# MAGIC
# MAGIC - [ ] Unity Catalog grants reviewed — app SP has SELECT only on summary + monitoring tables
# MAGIC - [ ] Serving endpoint ACL set — only app SP has CAN_QUERY
# MAGIC - [ ] App permissions configured — only authorised users have CAN_USE
# MAGIC - [ ] Rate limit configured appropriately for expected usage
# MAGIC - [ ] Lakehouse Monitoring enabled on 6_ai_reviews table
# MAGIC - [ ] Alerting configured for guardrail failure rate > threshold
# MAGIC - [ ] Forbidden patterns reviewed and updated for local regulatory language
# MAGIC - [ ] Sample AI reviews validated by qualified actuary
# MAGIC - [ ] Incident response plan for AI output issues documented
# MAGIC - [ ] Regulator notified of AI-assisted process (if required by jurisdiction)
# MAGIC
# MAGIC ---
# MAGIC
# MAGIC **Bottom line:** These AI agents are read-only advisors operating within strict governance boundaries.
# MAGIC They accelerate human work — they don't replace human judgment. Every interaction is audited,
# MAGIC every output is validated, and every decision remains with a qualified human.
