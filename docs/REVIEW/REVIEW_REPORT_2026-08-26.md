# Review report (re-review) — Solvency II at the Speed of Lakehouse

> Second 8-agent fan-out, run after the fix pass that followed the first review (`REVIEW_REPORT.md`). One section per agent; each persona verified whether the prior fixes actually hold. Fixes applied during this collation are listed at the end.

- **Demo:** Solvency II QRT (P&C + Life) workbench — `solvency-ii-qrt-demo-pnc-agentic` · branch `review-fixes-2026-08-26`
- **Reviewed:** 2026-08-26 (re-review) · agent endpoint runtime-verified live on dev
- **Against:** Bricksurance playbook standard **v2.2 — 2026-08-26**
- **Verdict:** **SHIP WITH ROADMAPPED GAPS** — every P0 now passes; the remaining items are P1s (labelled + roadmapped) and P2 polish.
- **Scorecard (§6):** P0 ≈ **40/40** pass · P1 ≈ **22/26** pass · open items below.

**Severity:** `blocker` (P0 fail / deal-breaker) · `major` · `minor` · `nit`. **Status:** `resolved` · `fixed-now` · `roadmapped` · `open`.

---

## Verdict rationale

The first review held the demo at NOT YET on four open P0s plus a P0-adjacent agent-architecture gap. This re-review confirms **all of them are cleared**, and the agent migration is not just coded but **runtime-verified on dev** (endpoint READY, live invocation calls governed `fn_*` UC functions and returns a grounded answer). The panel surfaced a short list of P1/P2 residuals; the quick ones were fixed during collation, the rest are labelled and roadmapped. That is the definition of SHIP WITH ROADMAPPED GAPS.

**Deal-breakers:** none. The practitioner (8/10, up from 6.5) and incumbent champion both conclude the demo survives because it concedes what it doesn't own and wins on breadth/openness/governance — "a different value play, not same-as-Igloo-but-worse."

---

## 1 · Practitioner (Chief Actuary) — confidence 6.5 → 8/10
*Real & right in my world? Enrich/wrap/replace?*

| # | Finding | Severity | Status |
|---|---|---|---|
| 1.1 | Life BE discount now on the **EIOPA risk-free term structure** (2.00%@1y→3.00%@30y), Challenger = +20bps parallel shift — verified in `register_reserving_models.py` + `src/config/eiopa_rfr_curve.csv` | blocker (prior) | ✅ resolved |
| 1.2 | Prophet/Igloo **illustrative-labelled on-screen** (`IllustrativeBadge`) | — | ✅ resolved |
| 1.3 | Standard-formula correlations verified EIOPA Annex IV-correct | — | ✅ pass |
| 1.4 | Chain-ladder / tail factors still illustrative (accepted cut corner, in DEMO_QA Q1/Q5; worked example in `src/examples/`, not the main flow) | minor | roadmapped |
| 1.5 | Own-funds per-instrument tiering depth — answered in DEMO_QA, no on-screen breakdown | minor | roadmapped |

**Deal-breakers:** none. **Value story:** strongest as enrich (govern native + external engines under one audit trail) + wrap (closed loop); correctly not out-featuring ResQ.

## 2 · Decision-maker (CFO/CRO)
*Money & story land? Risk of inaction?*

| # | Finding | Severity | Status |
|---|---|---|---|
| 2.1 | Control Tower **"why this matters" cascade + monetised time-to-value** now present (`Today.tsx`) — risk of inaction reads at board level | major (prior) | ✅ resolved |
| 2.2 | **Landing page still opens on capability, not the canonical pain** — an attendee arriving at `SolvencyLanding.tsx` first meets the platform pitch, not "who owns the whole process? nobody" | major | open (roadmapped; runbook verbatim opening mitigates) |
| 2.3 | Enrich/wrap/replace + understated tone + fork-not-product positioning | — | ✅ resolved |

**Biggest room-loser:** skipping the verbatim opening — the app doesn't force the pain-first framing that the runbook delivers.

## 3 · Databricks SA (demoability) — operability 7 → 9/10
| # | Finding | Severity | Status |
|---|---|---|---|
| 3.1 | Runsheet (GO·DO·SAY·IF-ASKED), DECISIONS, STANDARDS, Tier 2 all present; three-layer safety net (live w/ cold-start retry · yellow-button cache · static fallback); reset <30s; 38-probe preflight | P0 (prior) | ✅ resolved |
| 3.2 | Agent endpoint framework-deployed + runtime-verified; in-app fallback kept; scale-to-zero | P0 (prior) | ✅ resolved |
| 3.3 | **Per-beat timings are planning estimates, not measured over 3 runs** (flagged in the runbook, not executed) | major | open (needs 3 dry runs) |
| 3.4 | No explicit bullet "day-of pre-flight checklist" (inferable from README) | minor | roadmapped |

## 4 · Senior developer
| # | Finding | Severity | Status |
|---|---|---|---|
| 4.1 | Prior cut-list verified gone: `src/05_AI_Agents/` deleted, `create_dashboard.py` deleted, dead `call_with_tools` removed | — | ✅ resolved |
| 4.2 | ResponsesAgent rewrite correct + robust (tool wiring, extended-thinking text extraction, migration guard, cold-start retry, 503-not-silent fallback); **no load-bearing bugs** | — | ✅ pass |
| 4.3 | Unused imports `Awaitable, Callable` in `supervisor.py` | nit | ✅ fixed-now |
| 4.4 | `fn_cache_lookup`/`fn_cache_write` hardcode "2025-Q4" in the key (dead — never called) | minor | roadmapped (parameterise or delete) |
| 4.5 | Brittle readiness string compare + hardcoded `max_tokens`/`temperature` in `ai.py` | P2 | roadmapped |

## 5 · Security — **HEAD clean**
| # | Finding | Severity | Status |
|---|---|---|---|
| 5.1 | Baked `DATABRICKS_TOKEN` gone (agents.deploy scoped auth); dead token path gone; `bootstrap_governance.py` SQL parameterised — all 3 prior findings verified fixed; no secrets in history | major (prior) | ✅ resolved |
| 5.2 | `approvals.py` used f-string for `qrt_id` (mitigated: whitelist-validated) | minor | ✅ fixed-now (parameterised) |
| 5.3 | Least-privilege grants, OBO auth, XSS-safe markdown | — | ✅ pass |

## 6 · Current-Databricks expert — **all pass**
*Swept live docs 2026-08-26: Agent Framework, FMAPI, MLflow UC registry, Lakeflow serverless, Genie API, Statement Execution.*

| # | Finding | Severity | Status | Doc |
|---|---|---|---|---|
| 6.1 | ResponsesAgent + `agents.deploy()` + UCFunctionToolkit is **current framework-native best practice** — prior "bespoke glue" P0 cleared | P0 (prior) | ✅ resolved | agents/custom-agents |
| 6.2 | Dropping `temperature` correct for Claude Sonnet 5; deps sane (mlflow≥3.1, databricks-agents/langchain, langgraph, unitycatalog-ai) | — | ✅ pass | foundation-model-apis |
| 6.3 | Genie-via-API, Lakeflow serverless, MLflow UC aliases, FMAPI all current | — | ✅ pass | — |
| 6.4 | External **MCP server not shipped** (tool surface internal-only) | — | forward hook (evolving per §3.5) |

## 7 · Incumbent champion (veteran skeptic)
*7 of 8 prior objections resolved or honestly answered; pressure-test found 1 false-alarm + 1 real gap.*

| # | Objection | Severity | Answered? | Status |
|---|---|---|---|---|
| 7.1 | Prophet/Igloo mocks → now labelled; guardrails honestly framed; peer-row meaning clarified; EIOPA cell-mapping conceded; board-approval provenance conceded | major (prior) | Q&A + on-screen | ✅ resolved |
| 7.2 | **Hardcoded €92M/€68M "not labelled"** | major | — | ✅ resolved (false alarm — label IS present at `ImpactDiagrams.tsx:211–227`, co-located with the figures in `MarketLiveDiagram`; the reviewer searched the wrong spot) |
| 7.3 | **Overlay magnitude thresholds are advisory, not server-enforced, and not in the Q&A** | medium | — | ✅ fixed-now (DEMO_QA Q21 added; hard gate roadmapped) — note the QRT approval flow *does* enforce submitter≠reviewer |
| 7.4 | SCR = Standard Formula, no on-screen internal-model/stochastic comparison | major | Q&A (DEMO_QA Q2) | roadmapped |
| 7.5 | Reserving diagnostics; tail factors illustrative | major | Q&A | roadmapped (accepted cut corner) |

**Objections that can't be shown live:** all now in `DEMO_QA.md` with straight sourced answers (Q1–Q8 incumbent set + Q21 overlay segregation).

## 8 · UI/UX expert — **ready to demo**
| # | Finding | Severity | Status |
|---|---|---|---|
| 8.1 | `WhatAmISeeing` on data screens (was 26/31); sidebar 252px; IllustrativeBadge tasteful; named components reused; layout logic/loading/contrast sound | P0 (prior) | ✅ resolved |
| 8.2 | **`Whatif.tsx` (a live data screen) lacked the explainer** | medium (P0-F) | ✅ fixed-now |
| 8.3 | Tailwind + pillar-palette deviation is coherent + justified in DECISIONS; reads as one system | — | ✅ resolved |

---

## Applied fixes (this collation)
- **`Whatif.tsx`** — added the `WhatAmISeeing` explainer (UI 8.2 / Scorecard F P0). Build clean.
- **`approvals.py`** — parameterised the `qrt_id` query (security 5.2 defense-in-depth).
- **`DEMO_QA.md` Q21** — overlay segregation-of-duties objection now documented + roadmapped (incumbent 7.3).
- **`supervisor.py`** — removed unused `Awaitable, Callable` imports (senior-dev 4.3).
- Corrected an incumbent-champion false alarm: the €92M/€68M figures **are** labelled illustrative (7.2).

## Open / roadmapped (labelled — none block ship)
- **Measured per-beat timings** — run 3 dry runs, fold medians into `DEMO_RUNBOOK.md`. (SA 3.3)
- **Landing hero pain-first** — optionally lead `SolvencyLanding.tsx` with the canonical question before the platform pitch. (Decision-maker 2.2)
- **Overlay hard gate** — server-enforce magnitude thresholds via UC privileges (pattern already used by the QRT approval flow). (Incumbent 7.3)
- **On-screen internal-model vs Standard-Formula comparison**; chain-ladder/tail worked example promoted into the main flow. (Incumbent 7.4/7.5, practitioner 1.4)
- **P2 polish** — parameterise/delete dead cache fns; normalise readiness-string check; config `max_tokens`/`temperature`. (Senior-dev 4.4/4.5)
- **External MCP server** — forward hook, evolving per §3.5. (Current-DBX 6.4)
