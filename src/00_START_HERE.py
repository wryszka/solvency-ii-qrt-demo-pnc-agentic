# Databricks notebook source
# MAGIC %md
# MAGIC # Solvency II QRT Demo (Agentic) — Start Here
# MAGIC
# MAGIC ## Where You Are
# MAGIC
# MAGIC ```
# MAGIC solvency-ii-qrt-demo-agentic/
# MAGIC │
# MAGIC ├── 00_START_HERE              ← YOU ARE HERE
# MAGIC │
# MAGIC ├── 00_Generate_Data/          Setup & data generation
# MAGIC │   ├── 00_START_HERE          Full setup guide, demo script, all details
# MAGIC │   ├── bootstrap_archive      Step 1: generates Q1-Q3 data (~6 min)
# MAGIC │   ├── generate_data          Generates one quarter of data
# MAGIC │   ├── inject_demo_gotchas    Step 2: injects 4 hidden issues for AI to find
# MAGIC │   └── full_teardown          Cleanup: removes everything
# MAGIC │
# MAGIC ├── 01_QRT_S0602_Assets/       DLT pipeline — S.06.02 List of Assets
# MAGIC ├── 02_QRT_S0501_PnL/          DLT pipeline — S.05.01 Premiums, Claims & Expenses
# MAGIC ├── 03_QRT_S2501_SCR/          DLT pipeline + MLflow — S.25.01 SCR Standard Formula
# MAGIC ├── 04_QRT_S2606_NL_Risk/      DLT pipeline + stochastic engine — S.26.06 NL UW Risk
# MAGIC │
# MAGIC └── 05_AI_Agents/              Demo notebooks & security framework
# MAGIC     ├── demo_agent_walkthrough  Technical demo (run cells live)
# MAGIC     ├── demo_agent_eli5         Simplified demo (for recording)
# MAGIC     └── agentic_security_framework  IT security & governance
# MAGIC ```
# MAGIC
# MAGIC ## Quick Start
# MAGIC
# MAGIC | Step | What | Where |
# MAGIC |------|------|-------|
# MAGIC | 1 | **Read the full guide** | `00_Generate_Data/00_START_HERE` |
# MAGIC | 2 | **Generate data** | `00_Generate_Data/bootstrap_archive` |
# MAGIC | 3 | **Inject demo issues** | `00_Generate_Data/inject_demo_gotchas` |
# MAGIC | 4 | **Run the demo** | `05_AI_Agents/demo_agent_eli5` or `demo_agent_walkthrough` |
# MAGIC | 5 | **Open the app** | [solvency2-qrt-ai](https://solvency2-qrt-ai-7474659673789953.aws.databricksapps.com) |
# MAGIC
# MAGIC ## What This Is
# MAGIC
# MAGIC A Solvency II regulatory reporting platform with **5 AI agents** that review QRTs
# MAGIC before human sign-off. The agents find issues that take actuaries hours to spot — in 15 seconds.
# MAGIC
# MAGIC **The punchline:** *"The AI did the first 3 hours. The actuary spent 5 minutes on judgment."*
# MAGIC
# MAGIC ---
# MAGIC
# MAGIC **Next step:** Open `00_Generate_Data/00_START_HERE` for the full setup guide and demo script.
