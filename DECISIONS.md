# Decisions log

Reverse-chronological. Each entry is a self-contained decision + verification note.
A shared **Gotchas** section at the end carries once-bitten failure modes.

---

## 2026-08-26 — Review-fix pass (branch `review-fixes-2026-08-26`)

Applied after the 8-agent demo review (`docs/REVIEW/REVIEW_REPORT.md`). Cleared the
four open P0s, migrated the agents onto the framework, and fixed the security items.

### Agents → Mosaic AI Agent Framework (was: bespoke pyfunc + hand-rolled routing)
- **Decision.** The Workbench agent is now a single **`ResponsesAgent`** (MLflow 3,
  LangGraph tool-calling) whose tools are the governed `{catalog}.{schema}.fn_*`
  Unity Catalog functions. The LLM does the routing (tool selection) that the old
  hand-rolled classifier + per-specialist Python glue did. It is logged with
  `resources=[DatabricksServingEndpoint, DatabricksFunction…]` and served via
  `databricks.agents.deploy()`.
- **Why.** The previous build was a `mlflow.pyfunc.PythonModel` with a custom
  classifier, manual FM HTTP calls, and manual SQL — the "bespoke glue" the panel
  flagged (current-Databricks #6.1), and it was *built twice* (once in
  `07_AI_Agents/`, once inside `app/server/routes/supervisor.py`). One agent over
  governed UC-function tools is the framework-native shape; nothing is built twice.
- **Files.** `src/07_AI_Agents/register_agents.py` (authors + logs + registers the
  ResponsesAgent), `src/07_AI_Agents/deploy_supervisor_endpoint.py` (now
  `agents.deploy()`), `resources/ai_agents_job.yml` (framework deps), and the app's
  `_call_supervisor_endpoint` in `supervisor.py` (now OpenAI-`messages` in,
  ResponsesAgent `output`/`choices` parsed out). Model name kept
  `agent_workbench_supervisor` and endpoint `workbench-supervisor` for continuity.
- **In-app routing kept as an explicit fallback.** The `SPECIALISTS` registry +
  in-app classifier in `supervisor.py` remain the fallback when
  `SUPERVISOR_ENDPOINT_NAME` is unset or the endpoint is cold/unreachable, and they
  back the `/agents` architecture view. The framework endpoint is the primary path.
- **Verification.** `ast.parse` + `py_compile` clean on all changed Python;
  frontend `tsc --noEmit` exit 0. **Not yet runtime-verified on a workspace** — the
  register→deploy job (`ai_agents_setup`) must run on dev to build the endpoint;
  `register_agents.py` includes a `mlflow.models.predict(env_manager="uv")`
  pre-deploy validation, and `deploy_supervisor_endpoint.py` blocks on real READY.

### Security
- **Baked `DATABRICKS_TOKEN` removed.** The old deploy injected the notebook PAT
  into the serving endpoint's `environment_vars` (finding 5.1). `agents.deploy()`
  provisions scoped automatic auth from the logged `resources`; no token is baked.
- **Dead hand-rolled token path removed.** `call_with_tools` / `_call_llm_with_tools`
  in `app/server/ai.py` extracted the bearer token by hand and had no callers
  (finding 5.3) — deleted.
- **SQL injection fixed.** `bootstrap_governance.py` no longer f-strings the `year`
  widget into SQL; periods are validated (`int(year)`) and passed via bound
  `spark.sql(args=…)` parameters (finding 5.2).

### Actuarial realism
- **Life BE discounting is now the EIOPA risk-free term structure** (was a flat
  2.5%/2.7%). `register_reserving_models.py` discounts each cashflow at `r(t)` off
  an illustrative upward-sloping EUR curve (`src/config/eiopa_rfr_curve.csv`,
  2.00%@1y → 3.00%@30y, flat-extrapolated); Champion/Challenger now differ by a
  parallel curve shift (0 vs +20bps) instead of two flat rates. Labelled
  "EIOPA risk-free term structure (illustrative calibration)". A 20y level annuity
  BE moves −2.28% vs the old flat rate. (Practitioner blocker 1.1.)

### On-screen honesty (illustrative labelling)
- **Prophet + Igloo surfaces now carry an "Illustrative" badge + note** stating the
  engines are pre-computed because we don't hold their licences for the demo — the
  point is that Databricks *integrates* peer engines under one governed interface
  (not all-or-nothing); in production each runs for real via its own API against the
  same governed Volume contract. New `IllustrativeBadge`/`IllustrativeEngineNote`
  components; applied on ActuarialLab, LifeUWRisk, LabModelDetail, CatAgentPanel.
  `ImpactDiagrams` market-stress € figures are labelled illustrative (from the
  ALM/market-risk model in production, not hardcoded). (Findings 7.2/7.3/7.8.)

### Docs
- **`docs/DEMO_QA.md` added** — 20 persona-labelled Q&As (tab 2), incl. straight
  sourced answers to all 8 incumbent-champion objections. (Finding 3.2 / §7.)

### Cut
- **`src/05_AI_Agents/` deleted** — stale duplicate agent-registration path,
  superseded by `07_AI_Agents/` and referenced nowhere (senior-dev 4.1).

---

## Gotchas

- **Serverless `/tmp` PermissionError on re-run.** A fixed `/tmp` module path
  collides with a leftover file owned by a different identity on shared serverless
  compute (`Errno 13`). Write per-run artefacts to `tempfile.mkdtemp()`; keep the
  basename stable so "models from code" logging still resolves. Used in
  `register_agents.py`.
- **`resources=[…]` is mandatory when logging an agent.** Without it the deployed
  endpoint has no credentials for the FM endpoint or the UC functions and every
  query returns `PERMISSION_DENIED` with no useful error.
- **Newer Claude endpoints reject the `temperature` param.** The in-app FM caller
  (`ai.py`) retries without it on that specific error; the agent uses
  `ChatDatabricks(temperature=0.1)` which the framework handles.
- **Serving readiness is two fields, not one.** Check `state.ready == READY` AND
  `state.config_update` settled (not `IN_PROGRESS`) before reporting success — a
  bare `ready==READY` can be true while a config update is still rolling out.
