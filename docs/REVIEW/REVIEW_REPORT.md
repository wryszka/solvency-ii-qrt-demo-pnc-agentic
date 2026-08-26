# Review report — Solvency II at the Speed of Lakehouse

> Standardized output of the 8-agent review panel (BUILD_AND_REVIEW.md §7), run fan-out (all personas in parallel) and collated here — one section per agent. Any question that can't be answered live goes into the demo run's Q&A tab (`DEMO_QA.md`), not just here.

- **Demo:** Solvency II QRT (P&C + Life) workbench — `solvency-ii-qrt-demo-pnc-agentic` · repo `wryszka/solvency_workbench`
- **Reviewed:** 2026-08-26 · against the working tree (dev branch; 4 files uncommitted at review time)
- **Reviewed against:** Bricksurance playbook standard **v2.2 — 2026-08-26**
- **Verdict:** **NOT YET** — close, but several P0 items are open. Most are *labelling + documentation* fixes, not rebuilds; clearing the six-item critical path below flips this to **SHIP WITH ROADMAPPED GAPS**.
- **Scorecard (§6):** P0 ≈ **32/40** pass · P1 ≈ **18/26** pass · open items below.

**Severity:** `blocker` (a P0 fail or a deal-breaker) · `major` · `minor` · `nit`.
**Status:** `fixed` · `roadmapped` · `wontfix (reason)` · `open`.

---

## Verdict rationale — the P0 gate

The demo is **substantively strong**: real UC-governed data flow end to end, a working live/cached "yellow button", <30s date-rolling reset, an idempotent orchestrator, an excellent Learn panel, current Databricks primitives (Genie-via-API, Lakeflow pipelines, MLflow UC aliases, FMAPI Claude Sonnet 5), clean secrets/least-privilege posture, and a well-framed C-suite opening. That is most of the bar.

It is held at **NOT YET** by four open P0s — all fixable without a rebuild:

1. **Illustrative engines shown as production peers without on-screen labelling.** Prophet (`src/04b_QRT_Life_UW_Risk/run_prophet_model.py:103–137`) and Igloo (`src/04_QRT_S2606_NL_Risk/run_igloo_model.py:102–136`) print engine banners then load pre-baked seed tables — no real run. The README discloses this; **the Life UW / NL Risk pages do not.** Scorecard C P0 requires *anything illustrative is labelled illustrative* on screen. This is also the incumbent champion's #1 deal-breaker.
2. **No `DEMO_QA.md` (tab 2).** Scorecard J P0 requires every question that can't be answered live to be written and answered in the Q&A tab. The incumbent champion alone produced 8 such objections; none are currently documented.
3. **Load-bearing actuarial number is wrong under drill-down.** Life best-estimate discount is a flat 2.5% per period, not the EIOPA risk-free term structure — overstates technical provisions ~3–8% by duration (practitioner blocker). Fix or label + Q&A.
4. **Hardcoded EUR figures in the frontend** (`ImpactDiagrams.tsx:131–135`: +€92M / −€68M etc.) that "should be computed" (Scorecard C P0) — either compute from the market-risk model or clearly mark illustrative.

Secondary P0-adjacent: **agents are hand-rolled orchestration** (MLflow pyfunc + Model Serving + pure-Python dispatch), not Agent Bricks / Mosaic AI Agent Framework through the UC AI Gateway (Scorecard C/D). Functional and governed, but off the current recommended pattern — flag as P0-gap, roadmapped.

---

## 1 · Practitioner (Chief Actuary — reserving + capital)
*Real and right in my world? Value vs the proprietary tools I use — enrich / wrap / replace?*

| # | Finding | Severity | Answerable live? |
|---|---|---|---|
| 1.1 | Life best-estimate discount is a **constant 2.5%/period, not an EIOPA term-structure curve** — SII mandates curve discounting; flat rate overstates long-duration TP ~3–8%. | blocker | Fix, or Q&A + calibration card |
| 1.2 | P&C chain-ladder development factors are **hardcoded, not computed from the live triangle** (`register_reserving_models.py:135–149`); the dynamic worked example is buried in `src/examples/`. | major | Q&A — link factor-derivation + fit metric |
| 1.3 | Life TP (S.12.01) has **no validation** vs statutory BE ranges / per-cohort reasonableness (lapse, surrender, LAT). | major | demo — add validation tile |
| 1.4 | Own-funds tiering **oversimplified to a fixed 3-bucket split**; no per-instrument subordination/maturity/hybrid rules, no instrument_type visibility. | major | demo — expand `1_raw_own_funds` + tiering checklist |
| 1.5 | Non-life cat risk consumed from Igloo output with **no visible tail-validation** (VaR/TVaR fit, prior-forecast vs actual). | major | demo — stochastic-validation page |
| 1.6 | Life lapse-stress multiplier **+15% in the 2026 calibration** with no on-screen rationale (`register_standard_formula_model.py:330`). | major | Q&A — model-change tracker |
| 1.7 | MCR floor (€3.7M NL) **hardcoded in SQL** with no governance/illustrative note (`gold_s2501_summary.sql:69`). | major | demo — MCR-binding tile |
| 1.8 | Op-risk = **3% of BSCR** with no method rationale / next-review date. | minor | Q&A explainer |
| 1.9 | CIC-code validation injected as a demo gotcha only; **no permanent DQ check**. | minor | demo — DQ tile on Governance |
| 1.10 | Overlay governance stores lifecycle but **doesn't surface the supersede-chain**. | minor | demo — overlay breadcrumb |

**Deal-breakers:** Flat 2.5% discount (1.1) is the one true blocker — any actuary spots overstated TP immediately. Own-funds tiering (1.4) is the second credibility gap ("this is just a shell"). Cat risk as a black box with no reconciliation (1.5) undermines the "as real as it needs to be" claim if drilled.
**Value story:** Strongest as **enrich** (govern native + external engines under one audit trail — a pattern ResQ doesn't offer) and **wrap** (closed feedback loop via `advance_period`). Correctly does **not** try to replace/out-actuarialize ResQ. Modularity is real (UC pyfuncs swappable, external engines as Volume data contracts, overlays append-only). Recommend an explicit "Incumbent Integration" page: ResQ/Prophet/Igloo/native side-by-side with a "keep / augment / replace?" column — honesty is what makes the breadth argument land.

## 2 · Decision-maker (CFO / CRO)
*Does the money and the story land? Business case, risk of inaction?*

| # | Finding | Severity | Status |
|---|---|---|---|
| 2.1 | Opening business pain nailed — "who owns the *whole* SII process? Nobody" (`DEMO_RUNBOOK.md:57–83`) is CFO/CRO language. | ✅ pass | — |
| 2.2 | **Risk of inaction is visibility of pains, not consequence.** Pain G (+€8.2M reserve-capital divergence) is shown but not its cascade (→ which QRTs, audit finding, capital add-on, re-close weeks). | major | open |
| 2.3 | Landing frames **operations, not board-level outcome risk**; the decision artifact's consequence is implicit. | major | open |
| 2.4 | **Time-to-value shown but not monetised** (6-week ORSA → 30s; no €-FTE freed / cycles avoided / weeks-faster-to-filing). | minor | open |
| 2.5 | Three-beat message present but understated for a C-suite skim; deal-breaker pre-mortems live in Q&A, not the narrative. | minor | open |
| 2.6 | Governance-as-artifact (maker/approver/lineage-to-QRT-cell on the Audit tab) lands strongly. | ✅ pass | — |

**Biggest room-loser:** skipping the locked verbatim opening — without it, the positioning collapses to "a prettier UI on our tools." The runbook mitigates this (verbatim, timed), so risk is low, but the demo's CFO credibility rests entirely on delivering it as written.

## 3 · Databricks SA (demoability)
*Easy and reliable to demo — timings, fallbacks, reset, the yellow-button cache, live-room survival?*

| # | Finding | Severity | Status |
|---|---|---|---|
| 3.1 | **No `DEMO_RUNSHEET.md`** in GO·DO·SAY·IF-ASKED format — the runbook is narrative, a non-author will get lost mid-beat. | blocker | open |
| 3.2 | **No `DEMO_QA.md`** persona Q&A library (see §7 — the incumbent objections have nowhere to live). | blocker | open |
| 3.3 | **No `DECISIONS.md`** (decision log + gotchas) — no way to tell a known issue from a real blocker mid-deploy. | blocker | open |
| 3.4 | **Per-beat timings not measured** — runbook gives cumulative marks (3:00, 6:30…) not per-beat ± over 3 runs; can't decide what to cut when behind. | major | open |
| 3.5 | **Cached-mode fallback underdocumented** — `DEMO_MODE=cached` mentioned but no operator checklist (bake first, when/why to flip, what to say). | major | open |
| 3.6 | **No compatibility tier declared** in README (Free / Serverless-only / Full). Reads as Tier 2 (serverless-only). | major | open |
| 3.7 | Fallback static page (`docs/demo_fallbacks/index.html`) is comprehensive but **unlinked** from README / preflight. | minor | open |
| 3.8 | Orchestrator (`deploy_demo.sh`), reset (<30s, rolls dates, rewinds aliases), yellow button + `bake_cache.sh`, scale-to-zero (serverless pipelines + endpoint `scale_to_zero_enabled`), 38-probe preflight — all real. | ✅ pass | — |

**Operability: 7/10** — strong bones, held back by the missing docs trio and per-beat timings. Clears to ~9 with the critical path.

## 4 · Senior developer (correctness & robustness)
*Correct? Robust? Anything unnecessary / fragile / not best practice to cut?*

| # | Finding | Severity | Status |
|---|---|---|---|
| 4.1 | **Duplicate agent-registration paths**: `src/05_AI_Agents/register_agents.py` (181 lines, old) vs `src/07_AI_Agents/register_agents.py` (572, new). Both look production; unclear which the DAB runs. Divergence/maintenance risk. | major | open |
| 4.2 | **Duplicate dashboard scripts**: `scripts/create_dashboard.py` (hardcoded IDs) vs `create_dashboard_v2.py` (env-driven). v2 is the keeper. | minor | open |
| 4.3 | `.venv` and `__pycache__` exist on disk but are **correctly gitignored — NOT committed** (verified: `git ls-files` = 0). Local clutter only. *(Corrects an over-flag: these are not in the repo.)* | nit | open |
| 4.4 | Guardrail thresholds hardcoded, not env-configurable (`guardrails.py:22–25` + magic numbers). | minor | open |
| 4.5 | `ai.py:67` endpoint state null-check is loose (`ep.state.ready` throws if `ep.state` is None); guard the chain. | minor | open |
| 4.6 | `ai.py:114` broad-Exception + string-match on `"temperature"` is fragile to message changes. | minor | open |
| 4.7 | `app.py:92–93` imports a router locally inside lifespan, breaking the module-level import convention. | nit | open |
| 4.8 | **4 uncommitted files at review** (`ai_agents_job.yml`, `deploy_supervisor_endpoint.py`, `register_agents.py`, `server/ai.py`) — commit before promotion. | info | open |
| 4.9 | Backend fundamentals sound: SQL param-binding correct throughout, cache TTL/eviction safe, defensive try/except with fallbacks, warehouse warmup present. | ✅ pass | — |

**Cut list:** confirm the active agent-registration path and delete/deprecate the other (4.1); drop `create_dashboard.py` in favour of v2 (4.2).

## 5 · Security
*Secrets · grant scope · input escaping/binding · data egress · auth.*

| # | Finding | Severity | Status |
|---|---|---|---|
| 5.1 | **`DATABRICKS_TOKEN` baked into the supervisor serving endpoint** `environment_vars` (`deploy_supervisor_endpoint.py:83`, from `ctx.apiToken().get()`) — a workspace token in an endpoint env, not OBO. Endpoint compromise = workspace access. | major | open (roadmap OBO) |
| 5.2 | **SQL injection via f-string** in `bootstrap_governance.py:452,459` — `year` widget interpolated into `WHERE quarter='{year}-Q4'`. Default safe; parameterise it. | major | open |
| 5.3 | `ai.py:224` extracts raw Bearer token from the SDK by string-replace — safe today, risky anti-pattern if logging changes. | minor | open |
| 5.4 | **No secrets in code or git history** (swept); `.env`/`.pem`/`credentials` gitignored. | ✅ pass | — |
| 5.5 | XSS: all `dangerouslySetInnerHTML` routed through `renderMarkdownSafe()` (escapes first). | ✅ pass | — |
| 5.6 | Least-privilege grants (USE CATALOG + schema privs + CAN_USE warehouse, not GRANT ALL); OBO auth via X-Forwarded headers; app reads summary tables only. | ✅ pass | — |

## 6 · Current-Databricks expert (up to date)
*Swept the live Databricks docs (2026-08-26). Services/APIs current? Deprecated? Better primitives?*

| # | Finding | Severity | Status | Doc checked |
|---|---|---|---|---|
| 6.1 | **Agents are hand-rolled orchestration** — supervisor + specialists are custom MLflow pyfuncs on Model Serving with pure-Python dispatch (`supervisor.py`), not Agent Bricks / Mosaic AI Agent Framework. Valid but off current best practice for governed agentic systems. | major | open | agents/custom-agents/author-agent |
| 6.2 | Supervisor endpoint **not routed through the AI Gateway** (placeholder `AI_GATEWAY_ENDPOINT` in `ai.py:79–85`). | minor | open | ai.py |
| 6.3 | `wait_timeout: 50s` hardcoded (`sql.py:30`) may be tight for serverless warehouse cold-start. | minor | open | serving gotchas |
| 6.4 | Genie space created via `POST /api/2.0/genie/spaces` (`deploy_genie_space.py:116–122`) — current, correct. | ✅ pass | resolved | genie conversation API |
| 6.5 | Lakeflow pipelines (`CREATE OR REFRESH MATERIALIZED VIEW`, `catalog/target/channel/serverless` YAML) — current, no deprecated fields. | ✅ pass | resolved | resources/*.yml |
| 6.6 | MLflow UC registry + `set_registered_model_alias` (Champion/Challenger) — current. | ✅ pass | resolved | manage-model-lifecycle |
| 6.7 | FMAPI `databricks-claude-sonnet-5` with fallback to Sonnet 4 / Llama 3.3 — current, robust probe-and-fallback. | ✅ pass | resolved | foundation-model-apis |
| 6.8 | `statement_execution.execute_statement` + `serving_endpoints.query()` + Apps camelCase env — all current. | ✅ pass | resolved | api/llms.txt |

**Docs swept:** Genie Agents API, Agent Framework (custom agents), Foundation Model APIs, Statement Execution API, Model Lifecycle/UC registry, Databricks Apps env syntax — **as of 2026-08-26.** Verdict: functionally current across the board; the only real gap is architectural (agents not on the framework).

## 7 · Incumbent champion (veteran skeptic — the "Radar/Earnix/ResQ club")
*Every gap / edge case / "you can't really do X" that justifies keeping the incumbent. Blunt by design.*

| # | Finding / objection | Severity | Answered live? | Status |
|---|---|---|---|---|
| 7.1 | **Reserving is a toy chain-ladder** — hardcoded factors, no curve-fit, no bootstrap CI, no Mack diagnostics, no method selection vs ResQ's 15+ options. | blocker | show code + concede | open |
| 7.2 | **Prophet is not running** — fake "v7.4.2" banner + pre-baked `4_eng_prophet_results`; no real 5,000-scenario run. Not disclosed on the Life UW page. | blocker | Q&A | open |
| 7.3 | **Igloo is not running** — same; fake banner + `4_eng_stochastic_results`. | blocker | Q&A | open |
| 7.4 | **SCR is Standard Formula with tuned parameters, not an internal model** — no simulation, copula aggregation, tail risk. | major | show matrices + concede | open |
| 7.5 | **Tail factors baked (1.02–1.04), not derived** — flunks "how did you get 1.04?" | major | Q&A | open |
| 7.6 | **Guardrails are pattern-matching, not semantic** — block "I hereby approve" but not hallucinated numbers / false risk narrative. | major | Q&A | open |
| 7.7 | **No EIOPA structural QRT validation** — no cell-code (R0010/C0010…) mapping enforced; synthetic LEI won't pass pre-validation. | major | Q&A | open |
| 7.8 | **Hardcoded demo € in `ImpactDiagrams.tsx:131–135`** (+92M/−68M…) — "where did +92M come from?" → "the code." Violates "never hardcode a computed number." | major | fix/label | open |
| 7.9 | Prophet/Igloo positioned as governance "peer rows" while both are mocks — governance interface real, the data isn't. | major | Q&A | open |
| 7.10 | No computational validation that an ORSA stress scenario is internally consistent with the risk model. | major | Q&A | open |
| 7.11 | S.12.01 lacks per-cohort/duration granularity a reinsurer needs. | medium | Q&A | open |
| 7.12 | S.06.02 asset validation minimal — no look-through, FX haircut, CIC enforcement. | medium | Q&A | open |
| 7.13 | Model governance records *that* the model changed, not *why / by whose authority* (decision provenance lives outside UC). | medium | Q&A | open |
| 7.14 | Overlay approval is soft (a click), not policy-enforced segregation of duties. | medium | Q&A | open |
| 7.15 | Baked AI cache: a hallucination baked at prep persists through the talk; no live regen, only toggle. | medium | note | open |

**Objections that can't be shown live → must land in `DEMO_QA.md` (tab 2), sourced:**
1. Reserving tail-factor CIs (accepted cut corner — "bring your ResQ/IP method; governance track works with any").
2. Prophet 5,000-scenario convergence (mocked — "governance track real, engine stubbed offline; production polls the Volume").
3. Op-risk 3% EIOPA reference (simplification — "compute per your premiums/expenses; the point is versioning + audit").
4. AI ORSA semantic hallucination (guardrails block role-breaks not truth — "agents advise, humans decide; audit trail records who saw it").
5. S.25.01 EIOPA cell-mapping validity (accepted cut corner — "validator is a DLT expectation, easy to add").
6. Challenger calibration board-approval provenance ("technical history in-app; link decision evidence via a governed approvals table").
7. Igloo "peer row" equivalence ("same lineage *interface*, not same depth — breadth story, not out-featuring Igloo").
8. Guardrails = lip service ("real defense = mandatory human sign-off + complete audit + UC access control; auditable, not error-proof").

## 8 · UI/UX expert (domain-fluent)
*Logical layout · looks good · familiar-in-seconds · anything out of place / mis-wired / ugly.*

| # | Finding | Severity | Status |
|---|---|---|---|
| 8.1 | **"What am I seeing?" explainers missing on most data screens** — present on only ~3 pages; Scorecard F P0 wants one on every data screen. | major (P0-gap) | open |
| 8.2 | **Design-token drift** — Tailwind hex utilities instead of the house CSS vars (`--ink/--brand/--card`); sidebar 268px vs the 252px standard; typography `text-3xl/2xl` vs the 24/17px scale; layout `max-w-7xl` vs 252px+1180px. | major | open |
| 8.3 | **Named components not used** — no `.chip/.flag/.act/.ghost/.banner/.hero/.strip/.spin` classes; all one-off Tailwind. *(Note: this is a React/Vite/Tailwind app; §3 describes vanilla self-contained HTML — the visual semantics match, but the literal named-component contract does not.)* | major | open |
| 8.4 | Per-datapoint "why" reasoning sparse — few inline `.flag`/reasoning callouts on numbers. | minor | open |
| 8.5 | Demo mode toggle (amber/emerald live/cached), disclaimer, Learn panel (6-band workflow + diagrams + deep links), skeleton loading, status semantics (emerald/amber/red), navigation — all working well. | ✅ pass | — |
| 8.6 | No shell pages — `PillarPagePlaceholder` defined but zero imports; all pages live. | ✅ pass | — |

**Page status:** Polished — SolvencyLanding, Learn. Partial (missing explainers) — most data screens. No dead shells.

---

## Applied fixes (summary)
- *(none yet — this is the review pass; fixes to follow on a branch.)*
- Corrected one over-flag during collation: `.venv`/`__pycache__` are **gitignored, not committed** (verified `git ls-files`), and the token-injection at `deploy_supervisor_endpoint.py:83` was **confirmed present** — both cross-checked directly.

## Open / roadmapped — the critical path to SHIP

**P0 — must clear before a room (mostly labelling + docs, not rebuilds):**
1. **Label the illustrative engines on-screen.** Add a visible "illustrative / pre-computed — here's how you'd run it live" note to the Life UW (Prophet) and NL Risk (Igloo) pages, and to the ImpactDiagrams € figures (7.2, 7.3, 7.8). — *owner: builder, before next promotion*
2. **Write `DEMO_QA.md` (tab 2)** with the 8 incumbent objections above + practitioner/executive Q&As, sourced from live schema, cross-linked to beats. (3.2, §7)
3. **Fix or label the flat 2.5% life discount** — source the EIOPA risk-free curve and discount by duration, or label illustrative + add a calibration card. (1.1)
4. **Write `DEMO_RUNSHEET.md`** in GO·DO·SAY·IF-ASKED with per-beat timings measured over 3 runs. (3.1, 3.4)
5. **Declare the compatibility tier** in README + DECISIONS (reads as Tier 2 — serverless-only). (3.6)
6. **Parameterise the `bootstrap_governance.py` SQL** and commit the 4 pending files. (5.2, 4.8)

**P1 — roadmap + label (visible in-app + run-sheet where user-facing):**
- Agents → migrate to Agent Bricks / Mosaic AI Agent Framework through the AI Gateway. (6.1)
- Move `DATABRICKS_TOKEN` off the endpoint env to an OBO pattern. (5.1)
- Add "What am I seeing?" explainers to every data screen; add per-datapoint "why". (8.1, 8.4)
- Quantify risk-of-inaction (Pain-G cascade) and monetise time-to-value on the Control Tower. (2.2, 2.4)
- Add `DECISIONS.md` + `STANDARDS.md` pointer (v2.2). (3.3, 4.x)
- De-duplicate agent-registration (05 vs 07) and dashboard scripts. (4.1, 4.2)
- Own-funds tiering depth; own-model / cat-risk validation tiles. (1.4, 1.5, 1.3)
- Design-token/named-component alignment pass (or a DECISIONS note justifying the Tailwind divergence). (8.2, 8.3)
- Link the fallback page from README/preflight; document cached-mode operator checklist. (3.5, 3.7)
