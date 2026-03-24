# Databricks notebook source
# MAGIC %md
# MAGIC # Solvency II QRT Demo (Agentic)
# MAGIC
# MAGIC 5 AI agents that review insurance regulatory reports before human sign-off.
# MAGIC They find issues that take actuaries hours to spot — in 15 seconds.
# MAGIC
# MAGIC ---
# MAGIC
# MAGIC ## Setup
# MAGIC
# MAGIC 1. Open **00_Generate_Data / 02_bootstrap_archive** and run it
# MAGIC 2. Deploy the bundle: `databricks bundle deploy -t dev`
# MAGIC 3. Trigger the 4 QRT pipelines from the Workflows page
# MAGIC
# MAGIC ## Demo prep
# MAGIC
# MAGIC 1. Open **00_Generate_Data / 04_inject_demo_gotchas** and run it
# MAGIC 2. Re-trigger S.05.01 and S.26.06 pipelines
# MAGIC 3. Open the app
# MAGIC
# MAGIC ## Demo scripts
# MAGIC
# MAGIC - **05_AI_Agents / 01_demo_agent_eli5** — simplified version for recording
# MAGIC - **05_AI_Agents / 02_demo_agent_walkthrough** — technical version with live code
# MAGIC - **05_AI_Agents / 03_agentic_security_framework** — IT security & governance
# MAGIC
# MAGIC ## Full guide
# MAGIC
# MAGIC Open **00_Generate_Data / 01_setup_guide_and_demo_script** for the complete
# MAGIC installation instructions, demo script with what-to-click and what-to-say,
# MAGIC and schema structure documentation.
# MAGIC
# MAGIC ---
# MAGIC
# MAGIC **Schema:** `solvency2demo_agentic` in your workspace catalog
# MAGIC
# MAGIC **App:** solvency2-qrt-ai (Databricks Apps)
