# Databricks notebook source
# MAGIC %md
# MAGIC # Deploy the Workbench agent via the Mosaic AI Agent Framework
# MAGIC
# MAGIC Serves `{catalog}.{schema}.agent_workbench_supervisor@Production` on a
# MAGIC serving endpoint using **`databricks.agents.deploy()`** — the framework
# MAGIC deploy path. This is deliberately NOT a hand-built
# MAGIC `serving_endpoints.create(...)`:
# MAGIC
# MAGIC - `agents.deploy()` provisions **automatic, scoped authentication** for the
# MAGIC   resources the agent was logged with (the FM endpoint + every `fn_*` UC
# MAGIC   function). There is **no `DATABRICKS_TOKEN` baked into the container** —
# MAGIC   the previous build injected the notebook's PAT into `environment_vars`,
# MAGIC   which was the security finding this replaces.
# MAGIC - It wires MLflow tracing + inference tables + the review app.
# MAGIC - Re-running with a new model version updates the endpoint in place.
# MAGIC
# MAGIC Idempotent — serves the current `@Production` version, scale-to-zero.

# COMMAND ----------

dbutils.widgets.text("catalog_name",  "lr_dev_aws_us_catalog", "Catalog")
dbutils.widgets.text("schema_name",   "solvency2_workbench",   "Schema")
dbutils.widgets.text("endpoint_name", "workbench-supervisor",  "Endpoint name")
dbutils.widgets.text("model_name",    "agent_workbench_supervisor", "Registered model name")

catalog    = dbutils.widgets.get("catalog_name")
schema     = dbutils.widgets.get("schema_name")
endpoint   = dbutils.widgets.get("endpoint_name")
model_name = dbutils.widgets.get("model_name")
full_model = f"{catalog}.{schema}.{model_name}"
print(f"Deploying {endpoint} from {full_model}@Production")

# COMMAND ----------

# MAGIC %pip install -q -U databricks-agents mlflow>=3.1
# dbutils.library.restartPython()

# COMMAND ----------

import time
from databricks import agents
from databricks.sdk import WorkspaceClient
from mlflow.tracking import MlflowClient

w = WorkspaceClient()
mc = MlflowClient(registry_uri="databricks-uc")

# Resolve the @Production version (fall back to the latest registered version).
try:
    mv = mc.get_model_version_by_alias(full_model, "Production")
    version = mv.version
except Exception:
    versions = mc.search_model_versions(f"name='{full_model}'")
    if not versions:
        raise RuntimeError(f"No registered versions for {full_model}. Run register_agents first.")
    version = max(versions, key=lambda v: int(v.version)).version
print(f"Serving {full_model} v{version}")

# COMMAND ----------

# Migration guard. agents.deploy() refuses to attach a framework agent to an
# endpoint that already serves an INCOMPATIBLE (non-agent) model — which is
# exactly the state left by the previous bespoke-pyfunc deploy of this same
# endpoint name ("all served models are required to be agents ... with the same
# signature"). If an endpoint by this name already exists, delete it so
# agents.deploy() recreates it cleanly as an agent endpoint. Idempotent: a later
# agent-to-agent redeploy just recreates the (scale-to-zero) endpoint.
try:
    _existing = w.serving_endpoints.get(endpoint)
except Exception:
    _existing = None
if _existing is not None:
    print(f"Endpoint {endpoint} already exists — deleting so agents.deploy() can recreate it "
          f"as a framework agent endpoint (migration from the old pyfunc endpoint).")
    w.serving_endpoints.delete(endpoint)
    # Wait until it's actually gone before recreating (delete is async).
    for _ in range(30):
        try:
            w.serving_endpoints.get(endpoint)
            time.sleep(10)
        except Exception:
            break
    print(f"Endpoint {endpoint} deleted.")

# Deploy on the framework. endpoint_name is passed explicitly — the auto-derived
# name (agents_<catalog>-<schema>-<model>) is unpredictable and the app expects
# a stable SUPERVISOR_ENDPOINT_NAME. scale_to_zero is the framework default.
deployment = agents.deploy(
    full_model,
    version,
    endpoint_name=endpoint,
    tags={"demo": "solvency2-workbench", "framework": "mosaic-ai-agent"},
)
print(f"agents.deploy() submitted: endpoint={deployment.endpoint_name}")
print(f"  query_endpoint={getattr(deployment, 'query_endpoint', '')}")

# COMMAND ----------

# MAGIC %md ## Wait for the endpoint to be READY (framework builds take 5–20 min)

# COMMAND ----------

# Block on the real terminal state so the job doesn't go green while the build is
# still failing asynchronously. Same two-field readiness check as before: READY
# AND the config update settled (not IN_PROGRESS).
DEADLINE_MIN = 30
POLL_SECS = 20
elapsed = 0
final_ready = None
final_cfg = None
while elapsed < DEADLINE_MIN * 60:
    ep = w.serving_endpoints.get(endpoint)
    st = ep.state
    final_ready = str(st.ready) if st and st.ready is not None else None
    final_cfg = str(st.config_update) if st and st.config_update is not None else None
    print(f"  [{elapsed//60}m{elapsed%60:02d}s] ready={final_ready} config_update={final_cfg}")
    cfg_settled = (final_cfg is None) or ("IN_PROGRESS" not in (final_cfg or ""))
    if final_ready in ("READY", "EndpointStateReady.READY") and cfg_settled:
        break
    if final_cfg and "FAILED" in final_cfg:
        raise RuntimeError(
            f"Endpoint {endpoint} config update FAILED (config_update={final_cfg}). "
            f"Check the serving endpoint build logs in the workspace UI."
        )
    time.sleep(POLL_SECS)
    elapsed += POLL_SECS

if not (final_ready in ("READY", "EndpointStateReady.READY")
        and ((final_cfg is None) or ("IN_PROGRESS" not in (final_cfg or "")))):
    raise RuntimeError(
        f"Endpoint {endpoint} did not become READY within {DEADLINE_MIN} min "
        f"(last ready={final_ready}, config_update={final_cfg}). Failing the job "
        f"so this isn't silently reported as success."
    )

print(f"\n✓ Endpoint {endpoint} is READY and serving {full_model} v{version}.")
print(f"  SUPERVISOR_ENDPOINT_NAME={endpoint} is already wired in databricks.yml.")
