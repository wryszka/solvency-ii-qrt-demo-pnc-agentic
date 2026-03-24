# Databricks notebook source
# MAGIC %md
# MAGIC # Solvency II QRT Demo (Agentic) — Start Here
# MAGIC
# MAGIC A regulatory reporting platform with **5 AI agents** that review QRTs before human sign-off.
# MAGIC The agents find issues that take actuaries hours to spot — in 15 seconds.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Folders

# COMMAND ----------

# Build clickable links dynamically from the current notebook path
import os

nb_path = dbutils.notebook.entry_point.getDbutils().notebook().getContext().notebookPath().get()
base = nb_path.rsplit("/", 1)[0]
host = spark.conf.get("spark.databricks.workspaceUrl", "")

def ws_link(subpath, label=None):
    """Generate a workspace link."""
    return f"[{label or subpath}](https://{host}#workspace{base}/{subpath})"

folders_md = f"""
| Folder | Contents | Link |
|--------|----------|------|
| **00_Generate_Data** | Data generation, setup guide, demo prep | {ws_link("00_Generate_Data")} |
| **01_QRT_S0602_Assets** | DLT pipeline — S.06.02 List of Assets | {ws_link("01_QRT_S0602_Assets")} |
| **02_QRT_S0501_PnL** | DLT pipeline — S.05.01 Premiums, Claims & Expenses | {ws_link("02_QRT_S0501_PnL")} |
| **03_QRT_S2501_SCR** | DLT pipeline + MLflow model — S.25.01 SCR | {ws_link("03_QRT_S2501_SCR")} |
| **04_QRT_S2606_NL_Risk** | DLT pipeline + stochastic engine — S.26.06 NL Risk | {ws_link("04_QRT_S2606_NL_Risk")} |
| **05_AI_Agents** | Demo scripts, ELI5 version, security framework | {ws_link("05_AI_Agents")} |
"""

displayHTML(folders_md.replace("|", "</td><td>").replace("\n|", "\n<tr><td>"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Quick Start

# COMMAND ----------

quick_md = f"""
| Step | What to do | Notebook |
|------|-----------|----------|
| 1 | **Read the full setup & demo guide** | {ws_link("00_Generate_Data/setup_guide_and_demo_script", "setup_guide_and_demo_script")} |
| 2 | **Generate Q1-Q3 data** (~6 min) | {ws_link("00_Generate_Data/bootstrap_archive", "bootstrap_archive")} |
| 3 | **Inject hidden issues for demo** | {ws_link("00_Generate_Data/inject_demo_gotchas", "inject_demo_gotchas")} |
| 4 | **Run the technical demo** | {ws_link("05_AI_Agents/demo_agent_walkthrough", "demo_agent_walkthrough")} |
| 5 | **Or the simplified version** | {ws_link("05_AI_Agents/demo_agent_eli5", "demo_agent_eli5")} |
| 6 | **Review security controls** | {ws_link("05_AI_Agents/agentic_security_framework", "agentic_security_framework")} |
| 7 | **Open the app** | [solvency2-qrt-ai](https://solvency2-qrt-ai-7474659673789953.aws.databricksapps.com) |
"""

displayHTML(quick_md.replace("|", "</td><td>").replace("\n|", "\n<tr><td>"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Data Schema (`solvency2demo_agentic`)
# MAGIC
# MAGIC Tables use numbered prefixes — they sort in pipeline order in Unity Catalog:
# MAGIC
# MAGIC | Prefix | Layer | Tables | AI reads? |
# MAGIC |--------|-------|--------|-----------|
# MAGIC | `1_raw_*` | Bronze — source feeds | 13 | No |
# MAGIC | `2_stg_*` | Silver — cleansed/aggregated | 7 | No |
# MAGIC | `3_qrt_*` | Gold — EIOPA QRT templates | 8 | Yes (summaries) |
# MAGIC | `4_eng_*` | Stochastic engine I/O | 2 | Yes |
# MAGIC | `5_mon_*` | Monitoring & governance | 4 | Yes |
# MAGIC | `6_ai_*` | AI agent outputs | 2 | Writes only |
# MAGIC | `7_ref_*` | Reference data | 1 | Yes |
# MAGIC
# MAGIC ---
# MAGIC
# MAGIC ## The 5 AI Agents
# MAGIC
# MAGIC | Agent | What it does | Where in the app |
# MAGIC |-------|-------------|-----------------|
# MAGIC | **Actuarial Review** | Reviews a QRT, compares periods, flags risks | Any report → Approve tab |
# MAGIC | **Regulator Q&A** | Answers questions, drafts BaFin responses | Top nav → Regulator Q&A |
# MAGIC | **DQ Triage** | Investigates data quality failures | Data Quality → Investigate |
# MAGIC | **Cross-QRT Consistency** | Validates all 4 QRTs together | Monitor → Run Consistency |
# MAGIC | **Stochastic Engine** | Reviews simulation inputs/outputs | S.26.06 → Stochastic Engine |
# MAGIC
# MAGIC ---
# MAGIC
# MAGIC *"The AI did the first 3 hours. The actuary spent 5 minutes on judgment."*
