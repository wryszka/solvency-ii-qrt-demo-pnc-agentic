# Databricks notebook source
# MAGIC %md
# MAGIC # Backstage — Technical Deep Dive
# MAGIC
# MAGIC *This notebook is the "behind the scenes" companion to the Solvency II Regulatory Reporting demo.*
# MAGIC *Use it during technical Q&A to show architecture, code, governance, and Databricks features.*
# MAGIC
# MAGIC ---
# MAGIC
# MAGIC ## Solution Architecture
# MAGIC
# MAGIC ```
# MAGIC ┌─────────────────────────────────────────────────────────────────────────────────┐
# MAGIC │                          DATABRICKS LAKEHOUSE PLATFORM                           │
# MAGIC │                                                                                  │
# MAGIC │  ┌─────────────┐   ┌──────────────────┐   ┌─────────────────┐   ┌────────────┐ │
# MAGIC │  │ SOURCE FEEDS │──>│ DECLARATIVE       │──>│ GOLD QRT TABLES │──>│ AI AGENTS  │ │
# MAGIC │  │              │   │ PIPELINES (DLT)   │   │ (EIOPA format)  │   │ (5 agents) │ │
# MAGIC │  │ Simcorp      │   │                    │   │                 │   │            │ │
# MAGIC │  │ Guidewire    │   │ - Expectations     │   │ 3_qrt_s0602_*  │   │ Actuarial  │ │
# MAGIC │  │ SAP          │   │ - Quarantine       │   │ 3_qrt_s0501_*  │   │ DQ Triage  │ │
# MAGIC │  │ Claims Mgmt  │   │ - Auto-lineage     │   │ 3_qrt_s2501_*  │   │ Cross-QRT  │ │
# MAGIC │  │ Stochastic   │   │                    │   │ 3_qrt_s2606_*  │   │ Stochastic │ │
# MAGIC │  │ Engine       │   │ Silver layer:      │   │                 │   │ Regulatory │ │
# MAGIC │  └──────┬───────┘   │ 2_stg_* tables     │   │ Summary tables  │   │            │ │
# MAGIC │         │           └──────────┬─────────┘   └────────┬────────┘   └─────┬──────┘ │
# MAGIC │         │                      │                      │                   │        │
# MAGIC │         ▼                      ▼                      ▼                   ▼        │
# MAGIC │  ┌─────────────┐   ┌──────────────────┐   ┌─────────────────┐   ┌────────────┐  │
# MAGIC │  │ UNITY       │   │ MLFLOW MODEL     │   │ AI/BI           │   │ DATABRICKS │  │
# MAGIC │  │ CATALOG     │   │ REGISTRY         │   │                 │   │ APP        │  │
# MAGIC │  │             │   │                  │   │ - Dashboards    │   │ (FastAPI + │  │
# MAGIC │  │ - Governance│   │ - Champion v1    │   │ - Genie Room    │   │  React)    │  │
# MAGIC │  │ - Lineage   │   │ - Challenger v2  │   │                 │   │            │  │
# MAGIC │  │ - ACLs      │   │ - Version history│   │                 │   │ - 12 guard │  │
# MAGIC │  │ - Audit     │   │ - Auto-tracking  │   │                 │   │   rails    │  │
# MAGIC │  └─────────────┘   └──────────────────┘   └─────────────────┘   │ - Audit    │  │
# MAGIC │                                                                  │   trail    │  │
# MAGIC │  ┌──────────────────────────────────────────────────────────┐    └────────────┘  │
# MAGIC │  │ FOUNDATION MODEL API                                      │                    │
# MAGIC │  │ Claude Sonnet (preferred) → Llama 3.3 70B (fallback)     │                    │
# MAGIC │  │ Serving endpoint ACLs · Rate limiting · Token tracking    │                    │
# MAGIC │  └──────────────────────────────────────────────────────────┘                    │
# MAGIC └─────────────────────────────────────────────────────────────────────────────────┘
# MAGIC ```
# MAGIC
# MAGIC ---
# MAGIC
# MAGIC ## Databricks Product Features Used
# MAGIC
# MAGIC | Feature | Where in the demo | What it does |
# MAGIC |---------|------------------|-------------|
# MAGIC | **Unity Catalog** | All tables in `solvency2demo_agentic` | Governance, lineage, ACLs, audit |
# MAGIC | **Declarative Pipelines (DLT)** | 4 QRT pipelines | Medallion architecture, expectations, auto-lineage |
# MAGIC | **DLT Expectations** | Every silver/gold table | Data quality gates — DROP ROW, FAIL UPDATE, WARN |
# MAGIC | **MLflow Model Registry** | S.25.01 SCR model | Champion/Challenger, version history, UC integration |
# MAGIC | **Foundation Model API** | 5 AI agents | Claude Sonnet / Llama 70B via serving endpoints |
# MAGIC | **Databricks Apps** | The web application | FastAPI + React, service principal isolation |
# MAGIC | **AI/BI Dashboards** | Visual Analytics tab | Published Lakeview dashboard, embeddable |
# MAGIC | **AI/BI Genie** | Regulatory AI tab | Natural language → SQL → tables/charts |
# MAGIC | **Workflows / Jobs** | 4 QRT jobs | Orchestration, scheduling, dependencies |
# MAGIC | **Unity Catalog Volumes** | Stochastic engine I/O | CSV export/import for external model integration |
# MAGIC | **Serverless Compute** | All pipelines and jobs | No cluster management |
# MAGIC | **System Tables** | Audit trail | `system.access.audit` for compliance |

# COMMAND ----------

# MAGIC %md
# MAGIC ## Workspace Assets — Quick Links
# MAGIC
# MAGIC *Run this cell to generate clickable links to all demo assets.*

# COMMAND ----------

dbutils.widgets.text("catalog_name", "main")
catalog = dbutils.widgets.get("catalog_name")
schema = "solvency2demo_agentic"
host = spark.conf.get("spark.databricks.workspaceUrl", "")

print(f"Catalog: {catalog}")
print(f"Schema:  {schema}")
print(f"Host:    {host}")
print()

# Schema explorer
print(f"Schema:     https://{host}/explore/data/{catalog}/{schema}")
print(f"Lineage:    https://{host}/explore/data/{catalog}/{schema} (click any table → Lineage tab)")
print()

# List tables by layer
tables = spark.sql(f"SHOW TABLES IN `{catalog}`.`{schema}`").toPandas()
by_layer = {}
for _, row in tables.iterrows():
    name = row['tableName']
    layer = name.split('_')[0] + '_' + name.split('_')[1] if name[0].isdigit() else 'other'
    by_layer.setdefault(layer, []).append(name)

for layer in sorted(by_layer):
    print(f"\n{layer}: {len(by_layer[layer])} tables")
    for t in sorted(by_layer[layer]):
        print(f"  {t}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Jobs & Pipelines

# COMMAND ----------

from databricks.sdk import WorkspaceClient
w = WorkspaceClient()

print("=== DLT Pipelines ===")
for p in w.pipelines.list_pipelines():
    if 'S.' in (p.name or '') or 'qrt' in (p.name or '').lower():
        print(f"  {p.name}")
        print(f"    ID: {p.pipeline_id}")
        print(f"    URL: https://{host}/pipelines/{p.pipeline_id}")
        print(f"    State: {p.state}")
        print()

print("=== Workflow Jobs ===")
for j in w.jobs.list():
    name = j.settings.name if j.settings else ''
    if 'QRT' in name or 'qrt' in name.lower():
        print(f"  {name}")
        print(f"    ID: {j.job_id}")
        print(f"    URL: https://{host}/#job/{j.job_id}")
        print()

# COMMAND ----------

# MAGIC %md
# MAGIC ## MLflow Model Registry

# COMMAND ----------

import mlflow
mlflow.set_registry_uri("databricks-uc")

model_name = f"{catalog}.{schema}.standard_formula"
print(f"Model: {model_name}")
print(f"URL:   https://{host}/explore/data/models/{catalog}/{schema}/standard_formula")
print()

client = mlflow.MlflowClient()
for mv in client.search_model_versions(f"name='{model_name}'"):
    aliases = mv.aliases if hasattr(mv, 'aliases') else []
    print(f"  Version {mv.version}: {', '.join(aliases) if aliases else 'no alias'}")
    print(f"    Status: {mv.status}")
    print(f"    Created: {mv.creation_timestamp}")
    if mv.run_id:
        print(f"    Run: https://{host}/#mlflow/experiments/{mv.run_id}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Code Snippets — Key Features
# MAGIC
# MAGIC ### 1. DLT Expectations (Data Quality Gates)
# MAGIC
# MAGIC ```sql
# MAGIC -- From silver_assets_enriched.sql
# MAGIC CREATE OR REFRESH MATERIALIZED VIEW `2_stg_assets_enriched`(
# MAGIC   CONSTRAINT asset_id_not_null  EXPECT (asset_id IS NOT NULL)  ON VIOLATION DROP ROW,
# MAGIC   CONSTRAINT sii_value_positive EXPECT (sii_value > 0)         ON VIOLATION FAIL UPDATE,
# MAGIC   CONSTRAINT cic_code_valid     EXPECT (LENGTH(cic_code) = 4)  ON VIOLATION DROP ROW,
# MAGIC   CONSTRAINT currency_not_null  EXPECT (currency IS NOT NULL)  ON VIOLATION DROP ROW
# MAGIC ) AS
# MAGIC SELECT ...
# MAGIC FROM LIVE.`1_raw_assets`
# MAGIC ```
# MAGIC
# MAGIC **Key point:** Bad data is quarantined, not propagated. The expectation rules live next to the transformation — auditable by design.
# MAGIC
# MAGIC ### 2. Foundation Model API Call (AI Agent)
# MAGIC
# MAGIC ```python
# MAGIC from databricks.sdk import WorkspaceClient
# MAGIC from databricks.sdk.service.serving import ChatMessage, ChatMessageRole
# MAGIC
# MAGIC w = WorkspaceClient()
# MAGIC response = w.serving_endpoints.query(
# MAGIC     name="databricks-claude-sonnet-4",  # Falls back to Llama 70B
# MAGIC     messages=[
# MAGIC         ChatMessage(role=ChatMessageRole.SYSTEM, content=system_prompt),
# MAGIC         ChatMessage(role=ChatMessageRole.USER, content=user_prompt),
# MAGIC     ],
# MAGIC     max_tokens=2048,
# MAGIC     temperature=0.2,
# MAGIC )
# MAGIC ```
# MAGIC
# MAGIC **Key point:** One line change to switch models. No API keys — uses workspace auth.
# MAGIC
# MAGIC ### 3. Guardrails — Forbidden Pattern Detection
# MAGIC
# MAGIC ```python
# MAGIC # The AI CANNOT approve a QRT
# MAGIC FORBIDDEN_PATTERNS = [
# MAGIC     r"(?i)I\s+hereby\s+approv",
# MAGIC     r"(?i)this\s+QRT\s+is\s+(?:hereby\s+)?approved",
# MAGIC     r"(?i)submitted?\s+to\s+(?:the\s+)?(?:regulator|BaFin|EIOPA)",
# MAGIC     r"(?i)on\s+behalf\s+of\s+the\s+board",
# MAGIC ]
# MAGIC ```
# MAGIC
# MAGIC **Key point:** Hard block — if any pattern matches, the review is rejected. The human always decides.
# MAGIC
# MAGIC ### 4. Parameterized SQL (Injection Prevention)
# MAGIC
# MAGIC ```python
# MAGIC await execute_query(
# MAGIC     f"INSERT INTO {fqn('6_ai_reviews')} (...) VALUES (:review_id, :review_text, ...)",
# MAGIC     parameters=[
# MAGIC         StatementParameterListItem(name="review_id", value=review_id),
# MAGIC         StatementParameterListItem(name="review_text", value=review_text),
# MAGIC     ],
# MAGIC )
# MAGIC ```
# MAGIC
# MAGIC **Key point:** LLM output never touches SQL directly — parameterized queries prevent injection.
# MAGIC
# MAGIC ### 5. Genie SDK Integration
# MAGIC
# MAGIC ```python
# MAGIC response = w.genie.start_conversation_and_wait(
# MAGIC     space_id=space_id,
# MAGIC     content="What is the solvency ratio for Q3 2025?",
# MAGIC )
# MAGIC # Returns: text answer + SQL + data table
# MAGIC ```
# MAGIC
# MAGIC **Key point:** Genie runs natively inside the app — no iframe, no redirect. SDK-level integration.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Anticipated Technical Questions
# MAGIC
# MAGIC ### "How do you prevent the AI from hallucinating numbers?"
# MAGIC The agent receives actual data in its prompt (summary tables, not raw records).
# MAGIC The human actuary sees the same data on screen and can verify any claim.
# MAGIC Output guardrails check for required sections (Executive Summary, Key Metrics, Recommendation).
# MAGIC
# MAGIC ### "What if the LLM is down?"
# MAGIC The app tries Claude Sonnet first, then falls back to Llama 70B.
# MAGIC If both are down, the 503 error is clear — the rest of the app (data, pipelines, approval) still works.
# MAGIC The AI review is optional — you can still approve a QRT without it.
# MAGIC
# MAGIC ### "Can the AI access customer/policyholder data?"
# MAGIC No. The app's service principal has SELECT only on summary tables (`3_qrt_*`, `5_mon_*`).
# MAGIC It has zero access to `1_raw_*` tables containing individual records.
# MAGIC This is enforced by Unity Catalog, not application logic.
# MAGIC
# MAGIC ### "How do you audit what the AI said?"
# MAGIC Every AI call is stored in `6_ai_reviews`: review_id, user, model, tokens, timestamp, full text.
# MAGIC Queryable via SQL. Also captured in `system.access.audit` system tables.
# MAGIC
# MAGIC ### "What about GDPR / EU AI Act?"
# MAGIC - **GDPR Art. 22:** AI doesn't make decisions — it's advisory only. Human always approves.
# MAGIC - **EU AI Act:** This is a "limited risk" system (decision support), not "high risk" (autonomous).
# MAGIC - **DORA:** Databricks is SOC2/ISO27001 certified. No new third-party dependency.
# MAGIC
# MAGIC ### "Can this work with our existing stochastic engine (Igloo/Remetrica/RMS)?"
# MAGIC Yes. The stochastic integration is engine-agnostic — it exports exposures as CSV to a
# MAGIC Unity Catalog Volume, the engine processes them externally, results are imported back.
# MAGIC The AI agent that reviews the stochastic output works regardless of which engine produced it.
# MAGIC
# MAGIC ### "How long does deployment take?"
# MAGIC `bash deploy_demo.sh --catalog YOUR_CATALOG` — about 15 minutes.
# MAGIC Creates everything: schema, tables, pipelines, model, dashboard, Genie space, app.
# MAGIC
# MAGIC ### "What's the cost?"
# MAGIC - Serverless DLT pipelines: pay per pipeline run (~$2-5 per QRT)
# MAGIC - Foundation Model API: ~2K tokens per review (~$0.01-0.05 per call)
# MAGIC - Databricks App: included in platform
# MAGIC - SQL Warehouse: serverless, auto-scales to zero
# MAGIC
# MAGIC ### "Can this be adapted for US/NAIC statutory reporting?"
# MAGIC Yes — the architecture is market-agnostic. Only the templates and terminology change
# MAGIC (SCR→RBC, Own Funds→Surplus, BaFin→State DOI). Planned as a config switch, not a fork.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Data Lineage — Show This Live
# MAGIC
# MAGIC Open any gold table in Unity Catalog and click the **Lineage** tab:
# MAGIC
# MAGIC ```
# MAGIC 1_raw_assets → 2_stg_assets_enriched → 3_qrt_s0602_list_of_assets → 3_qrt_s0602_summary
# MAGIC ```
# MAGIC
# MAGIC This shows the full column-level lineage from source to QRT — automatically tracked by DLT.
# MAGIC No manual documentation needed.

# COMMAND ----------

# DBTITLE 1,Show lineage programmatically
# Table lineage via Unity Catalog
for table in ["3_qrt_s0602_summary", "3_qrt_s0501_summary", "3_qrt_s2501_summary", "3_qrt_s2606_summary"]:
    deps = spark.sql(f"DESCRIBE DETAIL `{catalog}`.`{schema}`.`{table}`").toPandas()
    print(f"\n{table}:")
    for _, row in deps.iterrows():
        print(f"  Format: {row.get('format', '?')}")
        print(f"  Location: {row.get('location', '?')}")
        print(f"  Created: {row.get('createdAt', '?')}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Audit Trail

# COMMAND ----------

# DBTITLE 1,AI review audit log — every call tracked
display(spark.sql(f"""
    SELECT review_id, qrt_id, reporting_period, model_used,
           input_tokens, output_tokens, created_at, created_by
    FROM `{catalog}`.`{schema}`.`6_ai_reviews`
    ORDER BY created_at DESC
    LIMIT 10
"""))

# COMMAND ----------

# DBTITLE 1,DQ expectation pass rates by pipeline
display(spark.sql(f"""
    SELECT pipeline_name,
           COUNT(*) AS total_expectations,
           SUM(CASE WHEN failing_records = 0 THEN 1 ELSE 0 END) AS passing,
           SUM(CASE WHEN failing_records > 0 THEN 1 ELSE 0 END) AS failing,
           ROUND(SUM(passing_records) * 100.0 / SUM(total_records), 2) AS pass_rate_pct
    FROM `{catalog}`.`{schema}`.`5_mon_dq_expectation_results`
    WHERE reporting_period = (SELECT MAX(reporting_period) FROM `{catalog}`.`{schema}`.`5_mon_dq_expectation_results`)
    GROUP BY pipeline_name
    ORDER BY pipeline_name
"""))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Schema Structure
# MAGIC
# MAGIC | Prefix | Layer | Count | Purpose |
# MAGIC |--------|-------|-------|---------|
# MAGIC | `1_raw_*` | Bronze | 13 | Source feeds — assets, claims, premiums, etc. |
# MAGIC | `2_stg_*` | Silver | 7 | Cleansed & aggregated (DLT materialized views) |
# MAGIC | `3_qrt_*` | Gold | 8 | EIOPA QRT templates — what goes to the regulator |
# MAGIC | `4_eng_*` | Engine | 2 | Stochastic simulation results + run log |
# MAGIC | `5_mon_*` | Monitoring | 4 | SLA, DQ, reconciliation, model versions |
# MAGIC | `6_ai_*` | AI | 2 | Agent reviews + approval workflow |
# MAGIC | `7_ref_*` | Reference | 1 | SCR correlation matrix |
# MAGIC
# MAGIC **Numbered prefixes** sort in pipeline order in the Unity Catalog explorer.
# MAGIC **AI agents only read `3_qrt_*` and `5_mon_*`** — never raw policyholder data.
