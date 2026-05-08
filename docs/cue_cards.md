# Cue cards — Solvency II at the Speed of Lakehouse

> Print this as a PDF (`make cue-cards.pdf` from the repo root with pandoc installed,
> or use any markdown-to-PDF tool). Each scene is a single page. Cards are designed to
> be glance-readable on stage from a folded A5 print.

---

## Card 0 — Pre-flight (60 seconds before walking on)

```
□ ./scripts/preflight_check.sh                         (must show 25/25 PASS)
□ Open https://solvency2-qrt-ai-dev-…/?mode=forum     (forum landing on projector)
□ Sidebar toggle is "Live" (green)                    (flip to Cached if FM API misbehaves)
□ Architecture tab open in second window
□ Cue cards visible (this doc, A5 folded)
□ Water within reach
```

---

## Card 1 — Opening (3:00)

**Click:** Architecture page on screen behind you.

**Phrases verbatim:**
- "Solvency II is the European prudential framework. Three pillars."
- "If you're an actuary in Europe, your year is structured by these pillars."
- "I have never seen this be calm."
- "Same engines. New surface area."

**Title beat:** *"Solvency II at the Speed of Lakehouse."*

**Q&A:**
- *Is this a Databricks product?* → No. A working demonstration. Source on GitHub.
- *Bricksurance?* → Synthetic. Mid-size European composite. Real EIOPA templates.
- *Which model are you using for AI?* → Foundation Model API. Claude Sonnet → Llama fallback.

---

## Card 2 — Scene 1: Control Tower (5:30)

**Click sequence:** Forum landing → Begin demo → Monitor → Overview tab.

**Phrases verbatim:**
- "Maria's view on Monday morning. Reporting deadline Friday."
- "Six attention items at the top — these are real, computed live."
- "Same data. Different surface."

**Pains 1-3 to call out (15-min cut):** A (RI late), C (storm), E (€2.3M gap).
**All six (25-min):** A → B → C → D → E → F.

**Q&A:**
- *Where do those numbers come from?* → Live SQL. `/api/monitoring/q4-pains`.
- *Are these real pains or scripted?* → Synthetic data, six engineered scenarios. The detection logic is real.
- *Could you tune the thresholds?* → Yes — `0_cfg_feed_sla` and the recon SQL.

---

## Card 3 — Scene 2: Pain B drill-in (7:00)

**Click sequence:** Pain B card → Data Quality page.

**Phrases verbatim:**
- "47 claims, all from `legacy_pre_migration`."
- "Every gross_paid is negative — subrogation reversal pattern."
- "DLT didn't ask for permission. It quarantined and continued."

**Q&A:**
- *Why don't they show up in S.05.01?* → DLT EXPECT constraint. Row dropped before gold.
- *Where's the recovery path?* → Manual reclassification → re-run pipeline. Not in this demo.

**[15-min: SKIP this card.]**

---

## Card 4 — Scene 3: SCR + Model Governance (9:00)

**Click sequence:** /scr → Model Governance.

**Phrases verbatim:**
- "Five risk modules. Correlated through Annex IV."
- "Real actuarial maths."
- "The model is registered in Unity Catalog."
- "Pillar 1 + Pillar 2, not stitched together."

**Numbers to point at:** Champion v2025 vs Challenger v2026 → ~+4% SCR.

**Q&A:**
- *Did you actually run both models?* → Yes, live. Both registered in UC.
- *What flips Champion?* → Out of scope today — but the decision is recorded here.

**[15-min: skip Model Governance side; stay on SCR breakdown.]**

---

## Card 5 — Scene 4: ORSA (13:00) — KEYNOTE

**Click sequence:** /orsa → pick "1-in-200 nat cat" → Run scenario → Generate narrative.

**Phrases verbatim:**
- "ORSA. Pillar 2. Forward-looking."
- "Same SCR engine, applying scenario shock."
- "ORSA isn't a separate document anymore. It's a button."

**Watch for:** Capital path bars rendering in red/amber/green. Narrative ~150 words.

**Q&A:**
- *Where do the projection assumptions come from?* → `0_cfg_business_plan` table. 3-year premium growth.
- *Is the maths real?* → Deterministic shock × correlation matrix. Same standard formula as Pillar 1.
- *AI just wrote the ORSA?* → AI drafted it. Board approves it. Hash-stamped.

**Recovery:** if narrative fails → flip sidebar to Cached → re-click Generate.

**[15-min: skip narrative; show chart only.]**

---

## Card 6 — Scene 5: SFCR (16:30)

**Click sequence:** /sfcr → Generate Section C (Risk Profile).

**Phrases verbatim:**
- "Pillar 3, public."
- "Every quantitative claim is anchored to the gold table and cell."
- "Disclosure an auditor can trust because they can verify it."

**Watch for:** Inline citation chips rendered after preview toggle. Each cites `3_qrt_…` cell.

**Q&A:**
- *Could the AI cite a fake cell?* → No. Server-side parser only accepts cells in the data block.
- *Is this Word-export-able?* → PDF today; Word as a follow-up.

**[15-min: skip preview/click-through; one paragraph + move on.]**

---

## Card 7 — Scene 6: Internal Controls (19:30)

**Click sequence:** /internal-controls.

**Phrases verbatim (the three invariants):**
1. "AI cannot approve."
2. "AI is read-only against regulatory tables."
3. "Every AI output is hashed."

**Phrases:** "Pillar 2 governance isn't a policy document. It's the architecture."

**Q&A:**
- *What stops the AI from making something up?* → Tool-only data access + content hashing + guardrails.
- *Can I see the audit log?* → Yes, scroll down. Every API call. SHA-256-stamped.

**[15-min: matrix + invariants only; skip audit log.]**

---

## Card 8 — Close (22:30 → 25:00)

**Click:** Architecture page (right-hand outputs visible).

**Phrases verbatim:**
- "Same engines. New surface area."
- "The integration tax is what gets removed."
- "Not a Databricks product — a working demonstration."

**Closing line, exact:** *"Solvency II at the speed of lakehouse — same regulation, less tax."*

---

## Card 99 — Recovery decisions on stage

```
                              ┌──────── Cached toggle ────────┐
   FM API slow / failing  →   │  Sidebar → flip to Cached     │
                              │  Re-click the AI button       │
                              └────────────────────────────────┘

                              ┌──────── Live data wrong ──────┐
   Q4 pains panel = 0 firing  │  STOP. Don't read off spec.    │
                              │  Open Lakeview tab, walk that. │
                              └────────────────────────────────┘

                              ┌──────── App is down ──────────┐
   Page never loads           │  Open docs/demo_fallbacks/    │
                              │   index.html in browser.       │
                              │  Read the SQL evidence aloud. │
                              └────────────────────────────────┘
```
