# DEMO_QA.md — Solvency II at the Speed of Lakehouse

**Tab 2 of the run material.** Tab 1 is the live demo (`DEMO_RUNBOOK.md`). This tab is where every "yes, but…" that *cannot be shown on screen* gets a straight, sourced answer. Read it before the room; the skeptic's questions here are the ones that decide the deal.

Each entry is persona-labelled — **practitioner** (actuary / capital modeller), **platform** (SA / data lead), **executive** (CFO / CRO) — with the demo beat it attaches to and the code/schema source of the answer. Tone is honest and understated: concede what the incumbents own, and be precise about what the platform is and isn't.

**The one-line positioning, for any of these:** this is not a Solvency II *engine* — it is the **governed data, orchestration and disclosure layer** for Solvency II work. We don't out-model ResQ, Igloo or Prophet; we make whatever they produce reproducible, traceable, cross-linked and cheap to extend. Breadth, openness and cost — not out-featuring a specialist.

---

## A · The skeptic's corner — objections we can't show live

These are the incumbent-champion objections from the demo review. None can be *demonstrated* on screen; each has a straight answer here.

### 1. "Your reserving is a toy chain-ladder. Where are the tail-factor diagnostics — bootstrap CIs, Mack, curve-fitting, method selection?"
**Persona:** practitioner · **Beat:** Scene 2 (Reserving Lab, `/lab/reserving_pnc`) · **Source:** `src/02_Reserving_Model/register_reserving_models.py`, worked example `src/examples/reserving_chain_ladder.py`

**A:** Correct — and deliberately so. The reserving methodology here is an **illustrative chain-ladder**; there are no tail-factor confidence intervals, no bootstrap, no Mack diagnostics, no 15-method selection. That is an *accepted cut corner*: reserving methodology is not what this demo claims to own. The point is the **governance track** around whatever method you use — versioned model, production/candidate aliases, diagnostics tab, approval, lineage into the QRT cells. Bring your ResQ output, your consultancy's IP, or a UC function you've built; register it as a peer model and the entire audit/overlay/lineage story works unchanged. We are not asking you to replace ResQ's actuarial science — we are giving it a governed home. *(If pushed for depth: the worked example in `src/examples/` shows dynamic factor derivation; a production build would register that as the model behind the alias.)*

### 2. "You claim Prophet runs 5,000 scenarios. Show me the convergence plot and the sub-module variance."
**Persona:** practitioner · **Beat:** Actuarial Lab peer rows / Life UW Risk · **Source:** `src/04b_QRT_Life_UW_Risk/run_prophet_model.py` (loads pre-baked `4_eng_prophet_results`)

**A:** Prophet is **not executing** in this demo — the workflow stages input/output on a UC Volume and then reads pre-computed illustrative results from `4_eng_prophet_results`. We don't hold a Prophet licence, and standing one up isn't the point. What *is* real is the **integration and governance track**: the Volume data contract, the ingest, the union with the native models, the reconciliation into the Life UW SCR, and the audit trail. In a real deployment you point Prophet Server at that Volume and poll for the output — the surrounding workflow doesn't change. This is deliberately labelled "illustrative" on the Actuarial Lab surface so nobody mistakes the cached numbers for a live run. The message is *we integrate your engine*, not *it's all or nothing*.

### 3. "Your Standard Formula op-risk is 3% of BSCR. Which EIOPA calibration is that?"
**Persona:** practitioner · **Beat:** Scene 4 pre-work / SF model · **Source:** `src/03_QRT_S2501_SCR/register_standard_formula_model.py` (`op_risk_factor`), correlation matrices at lines ~56–60

**A:** The 3% flat factor is a **simplification** for demo brevity — EIOPA doesn't publish a single op-risk factor; it's computed per undertaking from earned premiums and expenses (Delegated Regulation, Art. 204–205). The BSCR/market/NL correlation matrices follow the EIOPA Annex structure, but the op-risk step is illustrative. In your close you'd compute it from your actual premium and expense base. The demonstrable point is *versioning + audit*: the Challenger variant lifts the factor and you watch the change flow through BSCR aggregation, get diagnosed, and require sign-off before promotion — that beat is real regardless of the specific factor.

### 4. "AI writing my ORSA/SFCR is a hallucination risk. Your guardrails are regex — they don't catch a wrong number or a backwards risk narrative."
**Persona:** practitioner / executive · **Beat:** Scene 4 (ORSA narrative), SFCR/RSR drafting · **Source:** `src/app/server/guardrails.py` (`FORBIDDEN_PATTERNS`, lines ~34–40; `MAX_INPUT_CHARS`, `RATE_LIMIT_PER_USER`)

**A:** Fair — and we don't claim otherwise. The guardrails block **role-breaking** (the AI asserting "I hereby approve", impersonating the actuary, naming individuals) and enforce input limits and rate limits. They do **not** validate semantic truth — a plausible-but-wrong narrative can pass them. That is why the architecture is *agents advise, humans decide*: every AI draft lands in an `in_review` state, never auto-approved; a named actuary signs it. The real defence is three layers — **mandatory human sign-off**, a **complete audit trail** (model, prompt, response, who reviewed, when — every call logged), and **UC access control** (the agent reads summary tables only, no raw data, no write). Databricks governance makes AI output *auditable and controllable at regulated scale*, not error-proof. The quantitative claims in the drafts also carry inline citation chips back to the gold-table cell, so a number that doesn't trace is visibly broken.

### 5. "Your S.25.01 isn't a valid EIOPA template — no R/C cell codes, and that LEI is synthetic. A regulator's pre-validation rejects it on receipt."
**Persona:** practitioner / platform · **Beat:** Scene 3 (Audit panel on a QRT) · **Source:** gold QRT tables (`3_qrt_*`), `src/00_Generate_Data/generate_data.py`

**A:** Also correct — the QRTs are computed and cross-reconciled, but there is **no enforced EIOPA cell-code (R0010/C0010…) mapping** and the LEI is synthetic (this is a fictional entity). Structural template validation is an *accepted cut corner*: it's peripheral to the governance/lineage story and it's genuinely easy to add — a Lakeflow (DLT) expectation set enforcing mandatory cells plus a validator table checking row/column totals. We have that pattern ready for an implementation; it wasn't built for a forum talk. What the demo proves is the computational track (charges → aggregation → audit trail), which is the hard part.

### 6. "Your model governance shows Champion vs Challenger, but where's the board approval for the calibration change? Who authorised it?"
**Persona:** practitioner / executive · **Beat:** Scene 2 / Model Governance · **Source:** MLflow UC registry + aliases; `6_gov_*` governance tables

**A:** The **technical** history is fully in-platform — model version, calibration label, parameter deltas, and lineage are in the MLflow UC registry and the governance tables. What lives *outside* today is the **decision provenance**: the board pack, risk-committee minutes, actuarial-function recommendation. The audit trail shows *that* the model changed and *what* changed; it doesn't yet capture *by whose authority*. The fix is a governed approvals table with decision metadata (approver, date, linked evidence — a Confluence/Jira reference), which is the same append-only pattern the overlays register already uses. Roadmapped, not hand-waved.

### 7. "You put Igloo next to your chain-ladder as a 'peer row' — but Igloo is 10,000-scenario tail risk and yours is hardcoded factors. That's not 'peer'."
**Persona:** practitioner · **Beat:** Actuarial Lab (`/lab`), tangent Q "Are you replacing ResQ/Igloo/Prophet?" · **Source:** `pages/ActuarialLab.tsx`, `src/04_QRT_S2606_NL_Risk/run_igloo_model.py`

**A:** "Peer" refers to the **governance interface**, not the modelling depth. Igloo, Prophet and the native models are treated identically by the platform — same versioning, aliases, lineage, overlays, audit — so your governance team works with all of them one way. It is emphatically *not* a claim that our chain-ladder rivals Igloo's stochastic engine; it doesn't, and we don't try. The argument is **breadth**: one governed layer over every engine you already run. Igloo stays the best at being Igloo; we make its output reproducible and traceable alongside everything else.

### 8. "Guardrails that block 'I hereby approve' are lip service. An AI that says 'this QRT is sound and ready to file' passes them and still kills the company if it's wrong."
**Persona:** practitioner / executive · **Beat:** Scene 4, tangent Q "What if your AI hallucinates?" · **Source:** `src/app/server/guardrails.py`; audit logging in `src/app/server/lineage.py`

**A:** Agreed on the premise — pattern guardrails are *one* layer, not the defence. The defence is structural: (1) **mandatory human sign-off** — no AI output becomes a decision without a named actuary approving it; (2) a **complete, queryable audit trail** — if an error slips through, forensics show exactly what was generated, from what inputs, and who reviewed it; (3) **UC access control** — the agent can't reach raw data or write anything. The honest framing for the room: Databricks doesn't promise the AI is *safe*; it promises the AI is *governed* — auditable, access-controlled, and human-gated — which is what a regulated buyer actually needs.

---

## B · Practitioner Q&A — the actuarial substance

### 9. "Your life technical provisions — are you discounting at a flat rate? That would overstate long-duration TP."
**Persona:** practitioner · **Beat:** Life reserving / S.12.01 · **Source:** `src/02_Reserving_Model/register_reserving_models.py` (life BE cashflow discounting)

**A:** No — the life best-estimate now discounts projected cashflows on an **EIOPA risk-free term-structure curve**, interpolated per duration, not a single flat rate. (An earlier build used a flat 2.5%, which overstated long-duration TP by roughly 3–8%; that was corrected in this cut.) The curve source is labelled on the calculation, and the Challenger calibration applies a parallel shift rather than a different flat number, so the term structure is preserved. If you want to drop in your own published RFR curve, it's a config input.

### 10. "How is own-funds tiering handled? Real SII tiering is per-instrument."
**Persona:** practitioner · **Beat:** Pillar 1 Overview / own funds · **Source:** `1_raw_own_funds`, S.23-style aggregation

**A:** Today it's a simplified three-bucket split with the standard eligibility limits (Tier 2 ≤ 50% SCR, Tier 3 ≤ 15%). Real tiering is per-instrument — subordination order, maturity, hybrid treatment, deferred tax. That's a labelled simplification; the honest answer is "expand `1_raw_own_funds` to carry instrument type and apply the tiering rules per instrument", which is data-model work, not platform work. On the roadmap, flagged in-app.

### 11. "Your non-life cat number comes from Igloo. How do I know the tail is calibrated and not a guess?"
**Persona:** practitioner · **Beat:** Control Tower (Pain relating to cat) / S.26.06 · **Source:** `4_eng_stochastic_results`, `src/04_QRT_S2606_NL_Risk/run_igloo_model.py`

**A:** In the demo the cat output is illustrative pre-computed data, so there's no live tail validation to show. In production the pattern is a **model-vs-experience reconciliation** — prior-quarter forecast against actual claims emergence, VaR/TVaR fit — surfaced as a governed page. It's a genuine gap in the current build (roadmapped), and worth conceding directly: validating a vendor's stochastic tail is the vendor's job plus your independent review; the platform's job is to make both reproducible and auditable.

### 12. "Is the MCR floor real, and when does it bind?"
**Persona:** practitioner · **Beat:** Pillar 1 Overview · **Source:** `src/03_QRT_S2501_SCR/gold_s2501_summary.sql`

**A:** The MCR floor is present but hardcoded for the fictional entity and labelled illustrative — it should be calibrated to your actual LoB mix and the 25%–45%-of-SCR corridor. It's not currently shown as "binding / not binding"; that's a small display addition on the roadmap.

---

## C · Platform / SA Q&A — demoability and architecture

### 13. "What happens if the Foundation Model API is slow or down mid-talk?"
**Persona:** platform · **Beat:** any AI beat (Scenes 2 and 4) · **Source:** sidebar Live|Cached toggle, `scripts/bake_cache.sh`, `6_ai_demo_cache`, `src/app/server/cache.py`

**A:** Every AI beat is cached behind the **yellow live/cached toggle** in the sidebar. `./scripts/bake_cache.sh` pre-bakes the AFR/SFCR/RSR/ORSA panels and warms the Senior Reserving Actuary and Workbench Assistant into `6_ai_demo_cache` before the talk. If the FM API misbehaves, flip to Cached and the beat is instant. Last-ditch fallback: `docs/demo_fallbacks/index.html`, a static single page covering all four scenes — open it before the talk so it's browser-cached.

### 14. "Is the reset deterministic? Will the same demo reproduce, and won't the data look stale?"
**Persona:** platform · **Beat:** pre-flight · **Source:** `src/00_Generate_Data/*`, `make preflight`

**A:** Yes — reset is deterministic conditional on the as-of date: same seed + same as-of date reproduces identical heroes, and the as-of date rolls forward to today on reset, so the book always reads current (feed timestamps, "latest month") rather than months stale. Reset runs in well under a minute.

### 15. "What compute does this need? What's the cost story?"
**Persona:** platform / executive · **Beat:** landing / close · **Source:** `databricks.yml`, `resources/*.yml`, README

**A:** **Compatibility tier 2 — serverless-only.** All Lakeflow pipelines run serverless; the agent serving endpoint is scale-to-zero; there are no always-on clusters. Idle cost trends to zero. It reinstalls from the bundle (DAB) against your catalog with minimal config.

### 16. "How are the AI agents built and governed? Is this bespoke orchestration?"
**Persona:** platform · **Beat:** tangent Q "How do you govern AI agents?", `/agent-architecture` · **Source:** `src/07_AI_Agents/*`

**A:** The agents are built on the **Mosaic AI Agent Framework** — authored as framework agents, deployed with `databricks-agents` to a Model Serving endpoint fronted by the AI Gateway, with MLflow tracing on every call and UC Functions as the tool surface. The supervisor routes to specialists; each is a governed, versioned UC artefact. Routing decisions and tool calls are traced. (An earlier build hand-rolled the orchestration and baked a workspace token into the endpoint env — both were removed in this cut in favour of the framework and its managed auth.)

---

## D · Executive Q&A — the money and the story

### 17. "What's the business case? Why does this matter to me, not my actuaries?"
**Persona:** executive · **Beat:** Open (verbatim) / Close · **Source:** `DEMO_RUNBOOK.md` opening

**A:** Because today **nobody owns the whole Solvency II process** — a senior actuary holds it in their head, finance holds it in a spreadsheet, a Big4 build holds it in code nobody touches. Every tool is excellent at its slice; none owns the seam between them, and the seams are where the quarter goes late and fragile. This is the layer that owns the whole view — on data you already have, infrastructure you likely already have, AI and governance you've likely already paid for. The outcome is a *coherent* close, not just a faster one.

### 18. "What's the risk of doing nothing?"
**Persona:** executive · **Beat:** Scene 1 (Control Tower, Pain G) · **Source:** `DEMO_RUNBOOK.md` reference numbers (Pain G — reserve-capital divergence EUR 8.2 M understated SCR)

**A:** The Control Tower surfaces seven engineered pains Monday morning — including **Pain G, an EUR 8.2 M reserve-capital divergence** (a Q4 reserving overlay applied while the capital model still ran on the Q3 parameter). Undetected, that class of divergence propagates into the SCR and the disclosed ratio, and it's exactly what an audit committee flags as a control weakness — with capital add-ons or a re-close as the consequence. The risk of inaction isn't abstract: it's the number nobody was looking at until it was in the filing.

### 19. "Are you asking me to rip out ResQ, Igloo, Prophet and Tagetik?"
**Persona:** executive · **Beat:** tangent Q "Are you replacing…?", Actuarial Lab · **Source:** `pages/ActuarialLab.tsx`

**A:** No. This is **enrich / wrap / replace — your choice, and modular enough to do any of the three.** Keep the incumbents and let this govern and cross-link them (enrich). Put it around them as the data and disclosure layer (wrap). Or migrate specific pieces over time where it makes sense (replace) — never all-or-nothing. Igloo and Prophet sit in the Lab as peer rows precisely to make that point: the platform treats them like any native model. You buy breadth, openness and low cost — not a rip-and-replace.

### 20. "What did we actually get faster, in plain terms?"
**Persona:** executive · **Beat:** Scene 4 / Close · **Source:** ORSA narrative beat

**A:** The ORSA section that used to be six weeks of Excel and three days of drafting is a thirty-second scenario run and a board-grade paragraph grounded in your own numbers. But the honest headline isn't speed — it's **coherence and traceability**: the data lives in one place, governance is one motion, the AI is grounded in your figures, and the audit travels with the artefact. Faster is the by-product; owning the whole view is the point.

---

*This tab is the source of record for questions the live demo can't answer. Keep it in sync with `DEMO_RUNBOOK.md` beats and the schema/code it cites.*
