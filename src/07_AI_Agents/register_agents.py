# Databricks notebook source
# MAGIC %md
# MAGIC # Register the Workbench agent on the Mosaic AI Agent Framework
# MAGIC
# MAGIC Authors a single **`ResponsesAgent`** (MLflow 3) — a LangGraph tool-calling
# MAGIC agent whose tools are the governed `{catalog}.{schema}.fn_*` Unity Catalog
# MAGIC functions applied by `apply_uc_functions.py`. The LLM decides which
# MAGIC function(s) to call for each question (this replaces the old hand-rolled
# MAGIC classifier + per-specialist Python glue), and every call is grounded in a
# MAGIC real UC function so the answer is traceable.
# MAGIC
# MAGIC Why the framework (not a bespoke `mlflow.pyfunc.PythonModel`):
# MAGIC - Tools are governed UC functions — the same surface a notebook or another
# MAGIC   agent can call. Nothing is built twice.
# MAGIC - Logged with `resources=[...]` so `agents.deploy()` provisions **scoped,
# MAGIC   automatic auth** for the FM endpoint + each UC function — no baked
# MAGIC   `DATABRICKS_TOKEN` in the serving container.
# MAGIC - MLflow tracing + eval hooks are automatic.
# MAGIC
# MAGIC Output: one registered UC model `{catalog}.{schema}.agent_workbench_supervisor`
# MAGIC (kept name for continuity), aliased `@Production`. `deploy_supervisor_endpoint.py`
# MAGIC then serves it via `databricks.agents.deploy()`.

# COMMAND ----------

dbutils.widgets.text("catalog_name", "lr_dev_aws_us_catalog", "Catalog")
dbutils.widgets.text("schema_name",  "solvency2_workbench",   "Schema")
dbutils.widgets.text("fm_endpoint",  "databricks-claude-sonnet-5", "FM endpoint")
dbutils.widgets.text("model_name",   "agent_workbench_supervisor", "Registered model name")
catalog    = dbutils.widgets.get("catalog_name")
schema     = dbutils.widgets.get("schema_name")
fm_endpoint = dbutils.widgets.get("fm_endpoint")
model_name = dbutils.widgets.get("model_name")
full_model = f"{catalog}.{schema}.{model_name}"
print(f"Catalog/schema: {catalog}.{schema}")
print(f"FM endpoint:    {fm_endpoint}")
print(f"Model:          {full_model}")

# COMMAND ----------

# MAGIC %pip install -q -U mlflow>=3.1 databricks-langchain langgraph databricks-agents unitycatalog-ai[databricks] pydantic>=2
# dbutils.library.restartPython()

# COMMAND ----------

# The governed UC functions that become the agent's tools. These are created by
# apply_uc_functions.py (run as the prior task in ai_agents_job.yml). We expose
# the read/query functions only — the cache_* functions are app-internal
# plumbing, not agent tools.
TOOL_FUNCTIONS = [
    "fn_close_status",
    "fn_model_status",
    "fn_overlays_recent",
    "fn_reserving_anomalies",
    "fn_event_log_lookup",
    "fn_feed_status",
    "fn_recon_status",
    "fn_dq_status",
    "fn_orsa_stress_state",
    "fn_solvency_history",
    "fn_qrt_audit_snapshot",
    "fn_approvals_pending",
    "fn_archive_lookup",
]
UC_FUNCTION_FQNS = [f"{catalog}.{schema}.{fn}" for fn in TOOL_FUNCTIONS]
DEFAULT_PERIOD = "2025-Q4"

# COMMAND ----------

# MAGIC %md ## Author the ResponsesAgent (written to a temp file, logged via "models from code")

# COMMAND ----------

# Write the agent to a UNIQUE per-run temp path. A fixed /tmp path collides with a
# leftover file owned by a different identity on shared serverless compute →
# PermissionError [Errno 13] on the second run. mkdtemp() gives a fresh writable
# dir every run; the basename (agent.py) stays stable so "models from code" logging
# resolves. (Same hard-won pattern as the previous build.)
import tempfile as _tempfile, os as _os
AGENT_DIR = _tempfile.mkdtemp(prefix="wb_agent_")
AGENT_PYFILE = _os.path.join(AGENT_DIR, "agent.py")

# Config the agent needs at import time is injected via sentinel replacement
# (str.replace, not .format — the agent body is full of braces).
_AGENT_SRC = '''"""Bricksurance Solvency II Workbench agent — Mosaic AI Agent Framework.

A LangGraph tool-calling ResponsesAgent. Tools are governed Unity Catalog
functions (fn_*); the LLM chooses which to call. Advises, never decides:
it proposes overlays but never writes or approves them.
"""
import mlflow
from mlflow.pyfunc import ResponsesAgent
from mlflow.types.responses import (
    ResponsesAgentRequest, ResponsesAgentResponse, ResponsesAgentStreamEvent,
    output_to_responses_items_stream, to_chat_completions_input,
)
from databricks_langchain import ChatDatabricks, UCFunctionToolkit
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableLambda
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt.tool_node import ToolNode
from typing import Annotated, Generator, Sequence, TypedDict

LLM_ENDPOINT = "@@FM_ENDPOINT@@"
UC_FUNCTIONS = @@UC_FUNCTIONS@@
DEFAULT_PERIOD = "@@DEFAULT_PERIOD@@"

SYSTEM_PROMPT = (
    "You are the Bricksurance Solvency II Workbench agent, assisting the "
    "actuarial and capital team through the quarterly close. Bricksurance SE is a "
    "synthetic European composite insurer; all data is synthetic.\\n\\n"
    "You have governed Unity Catalog function tools. GROUND EVERY ANSWER in data "
    "you fetch with them — never invent numbers. Cite the function or table you "
    "used for each fact. If a tool returns no rows, say so plainly.\\n\\n"
    "The reporting period under review is " + DEFAULT_PERIOD + " unless the user "
    "names another. Quarters look like '2025-Q4'; the prior quarter of 2025-Q4 is "
    "2025-Q3.\\n\\n"
    "Tool guidance:\\n"
    "- Cat / storm / Igloo / S.26.06 losses -> fn_event_log_lookup (date range) to "
    "cross-reference the external event log; name the events and dates.\\n"
    "- Reserving / triangle / IBNR / LoB movement -> fn_reserving_anomalies(prior, "
    "current) and fn_overlays_recent(quarter). Surface the 1-3 most material "
    "movements with numbers, then propose a candidate overlay (model, LoB, "
    "magnitude EUR, direction, category, rationale).\\n"
    "- ORSA / stress / scenario / capital path -> fn_orsa_stress_state(period).\\n"
    "- Reconciliation / cross-QRT mismatch -> fn_recon_status(period); for each "
    "break give cells, magnitude, likely cause, resolution step.\\n"
    "- Data quality / late feed / quarantine / expectation -> fn_dq_status(period) "
    "and fn_feed_status(period).\\n"
    "- Model promotion / champion-challenger -> fn_model_status(model_name).\\n"
    "- Audit / who signed off / overlays applied -> fn_qrt_audit_snapshot(qrt, "
    "period).\\n"
    "- Solvency trend -> fn_solvency_history(days).\\n"
    "- 'Where are we / what's outstanding' -> fn_close_status(period) and "
    "fn_approvals_pending(period).\\n\\n"
    "GOVERNANCE (hard rules): You ADVISE; humans decide. You never create, edit, "
    "or approve an overlay or a model promotion — the Overlays Register UI and a "
    "human sign-off do that. When you propose a reserving overlay, end with "
    "exactly: 'This decision is yours.' Do not claim to have filed, submitted, or "
    "approved anything with a regulator."
)


class State(TypedDict):
    messages: Annotated[Sequence, add_messages]


class WorkbenchAgent(ResponsesAgent):
    def __init__(self):
        self.llm = ChatDatabricks(endpoint=LLM_ENDPOINT, temperature=0.1)
        self.tools = list(UCFunctionToolkit(function_names=UC_FUNCTIONS).tools)
        self.llm_with_tools = self.llm.bind_tools(self.tools)

    def _graph(self):
        def call_model(state):
            msgs = [{"role": "system", "content": SYSTEM_PROMPT}] + list(state["messages"])
            return {"messages": [self.llm_with_tools.invoke(msgs)]}

        def should_continue(state):
            last = state["messages"][-1]
            return "tools" if isinstance(last, AIMessage) and last.tool_calls else "end"

        g = StateGraph(State)
        g.add_node("agent", RunnableLambda(call_model))
        g.add_node("tools", ToolNode(self.tools))
        g.set_entry_point("agent")
        g.add_conditional_edges("agent", should_continue, {"tools": "tools", "end": END})
        g.add_edge("tools", "agent")
        return g.compile()

    def predict_stream(
        self, req: ResponsesAgentRequest
    ) -> Generator[ResponsesAgentStreamEvent, None, None]:
        msgs = to_chat_completions_input([m.model_dump() for m in req.input])
        for kind, payload in self._graph().stream({"messages": msgs}, stream_mode=["updates"]):
            if kind != "updates":
                continue
            for node in payload.values():
                if node.get("messages"):
                    yield from output_to_responses_items_stream(node["messages"])

    def predict(self, req: ResponsesAgentRequest) -> ResponsesAgentResponse:
        items = [
            ev.item for ev in self.predict_stream(req)
            if ev.type == "response.output_item.done"
        ]
        return ResponsesAgentResponse(output=items)


mlflow.langchain.autolog()
mlflow.models.set_model(WorkbenchAgent())
'''

_src = (
    _AGENT_SRC
    .replace("@@FM_ENDPOINT@@", fm_endpoint)
    .replace("@@UC_FUNCTIONS@@", repr(UC_FUNCTION_FQNS))
    .replace("@@DEFAULT_PERIOD@@", DEFAULT_PERIOD)
)
with open(AGENT_PYFILE, "w") as f:
    f.write(_src)
print(f"Wrote agent to {AGENT_PYFILE}")

# COMMAND ----------

# MAGIC %md ## Log with resources (auto-auth), register to UC, validate, alias

# COMMAND ----------

import mlflow
from mlflow.models.resources import DatabricksServingEndpoint, DatabricksFunction
from mlflow.tracking import MlflowClient

mlflow.set_registry_uri("databricks-uc")

# resources=[...] is what gives the deployed endpoint scoped credentials for the
# FM endpoint + each UC function. WITHOUT it, every query returns PERMISSION_DENIED
# with no useful error. This is also what removes the need to bake a token.
resources = [
    DatabricksServingEndpoint(endpoint_name=fm_endpoint),
    *[DatabricksFunction(function_name=fqn) for fqn in UC_FUNCTION_FQNS],
]

input_example = {"input": [{"role": "user", "content": "What is outstanding for the Q4 close?"}]}

PIP_REQS = [
    "mlflow>=3.1",
    "databricks-langchain",
    "langgraph",
    "databricks-agents",
    "unitycatalog-ai[databricks]",
    "pydantic>=2",
]

with mlflow.start_run(run_name="workbench_agent"):
    info = mlflow.pyfunc.log_model(
        name="agent",
        python_model=AGENT_PYFILE,           # models-from-code: file path, not an instance
        resources=resources,                  # auto-auth — DO NOT skip
        input_example=input_example,
        pip_requirements=PIP_REQS,
        registered_model_name=full_model,
    )
print(f"Logged + registered {full_model} ({info.model_uri})")

# COMMAND ----------

# Pre-deploy validation — rebuild the env and run one request so failures surface
# here (in the job) rather than at the serving endpoint 15 min later.
import mlflow
try:
    mlflow.models.predict(
        model_uri=info.model_uri,
        input_data={"input": [{"role": "user", "content": "ping"}]},
        env_manager="uv",
    )
    print("Pre-deploy validation OK")
except Exception as _e:
    print(f"(pre-deploy validation raised — inspect before deploy: {_e})")

# COMMAND ----------

# Alias the version we just registered @Production for governance visibility and
# to give deploy_supervisor_endpoint.py a deterministic version to serve.
client = MlflowClient(registry_uri="databricks-uc")
versions = client.search_model_versions(f"name='{full_model}'")
latest = max(versions, key=lambda v: int(v.version))
client.set_registered_model_alias(full_model, "Production", int(latest.version))
print(f"{full_model} v{latest.version} -> @Production")
dbutils.notebook.exit(f"{full_model}:{latest.version}")
