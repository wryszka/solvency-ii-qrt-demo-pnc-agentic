/**
 * Per-artefact "impact" registry — pain rows + reassurance + bespoke
 * lightbulb diagram key for each Pillar 1 artefact.
 *
 * Renders inside ArtefactImpactPanel as a foldable section at the bottom of
 * the artefact page. Three things every entry needs to deliver, in this
 * order:
 *
 *   1. Resolve the practitioner's gaps — frame as common Board/Audit asks,
 *      not as gaps in their team. The "today's reality" column shows the
 *      integration tax every Solvency II function pays; the "platform"
 *      column shows what becomes routine.
 *
 *   2. The lightbulb — a visionary moment they recognise as their own
 *      unsolved problem. One per artefact, picked from the diagram registry.
 *
 *   3. What stays exactly where it is — explicit reassurance so a head
 *      actuary doesn't feel rip-and-replace pressure. Specialist engines,
 *      sign-off chain, and actuarial judgement are amplified, not replaced.
 */

export type ImpactDiagram =
  | 'champion_challenger'
  | 'market_live'
  | 'cat_agent'
  | 'stochastic_transparency'
  | 'continuous_stress';

export interface ImpactPain {
  /** The question — italicised in the table. Frame as a real-world ask. */
  ask: string;
  /** Today's reality — concrete, time-stated, no condescension. */
  today: string;
  /** What this platform makes routine — concrete + linkable. */
  platform: string;
  /** Optional deep-link to the surface that delivers the resolution. */
  platformLink?: { to: string; label: string };
}

export interface ImpactReassurance {
  label: string;
  body: string;
}

export interface ImpactConfig {
  /** Section title in the fold summary. */
  title: string;
  /** Sub-headline below the title. */
  subtitle: string;
  /** Heading above the pain table. */
  table_heading: string;
  /** Heading above the lightbulb diagram. */
  diagram_heading: string;
  /** One-line caption above the diagram (italicised under the heading). */
  diagram_caption: string;
  /** Diagram key — dispatched in ArtefactImpactPanel. */
  diagram: ImpactDiagram;
  pains: ImpactPain[];
  /** Heading above the reassurance row. */
  stays_heading: string;
  reassurances: ImpactReassurance[];
}

export const ARTEFACT_IMPACT: Record<string, ImpactConfig> = {
  /* ── S.05.01 — Reserving (P&C) ───────────────────────────────────────── */
  s0501: {
    title: 'Where this changes the reserving conversation',
    subtitle: 'Five Board/Audit asks · Champion vs Challenger as a continuous experiment · what stays the same.',
    table_heading: 'The five recurring asks',
    diagram_heading: 'The lightbulb — Champion vs Challenger, running in shadow',
    diagram_caption: 'Every reserve actuary knows they should be doing this. Almost none are. The audit trail is the reason.',
    diagram: 'champion_challenger',
    pains: [
      {
        ask: '"Why did motor IBNR move by EUR 12M between quarters?"',
        today: 'Senior reserving actuary builds the variance walk by hand in xlsx; assumptions live in their head; rarely re-used.',
        platform: 'Auto-decomposition — paid-loss vs case-reserve shifts, model-version diff, approved-overlay impacts side by side.',
        platformLink: { to: '/lab/reserving_pnc', label: 'Reserving model · Lab' },
      },
      {
        ask: '"Show me the chain ladder estimate exactly as submitted in Q1."',
        today: 'Re-run from a notebook + parameter file from an email thread. Usually 1–2 days; longer if a key person has left.',
        platform: 'Replay button from the audit snapshot — same triangle, same model version, same overlays as filed.',
        platformLink: { to: '/archive', label: 'Submissions Archive' },
      },
      {
        ask: '"Senior actuary applied a +5% loading on commercial — what\'s the rationale?"',
        today: 'Word doc, memo, or "ask Sarah." Hard to defend on demand; harder to defend a year later.',
        platform: 'Every overlay carries author + approver + hash + rationale + linked QRT cells.',
        platformLink: { to: '/overlays', label: 'Overlays Register' },
      },
      {
        ask: '"We chose BF over chain ladder on long-tail — is that still defensible?"',
        today: 'Annual methodology review, audit asks once a year; rarely revisited in between.',
        platform: 'Champion (CL) + Challenger (BF) run every quarter on the same data; diagnostics decide the flip and audit it.',
        platformLink: { to: '/lab', label: 'Actuarial Lab' },
      },
      {
        ask: '"Does our SII reserve match our IFRS 17 fulfilment cashflow?"',
        today: 'Quarterly manual cross-check by the IFRS team; small discrepancies fixed in xlsx; double-work between teams.',
        platform: 'Cross-pillar IFRS 17 best-estimate consistency check runs as a hard gate on every Q-close.',
        platformLink: { to: '/internal-controls', label: 'Internal Controls' },
      },
    ],
    stays_heading: 'What stays exactly where it is',
    reassurances: [
      {
        label: 'Your reserving methodology',
        body: 'Chain ladder, Bornhuetter-Ferguson, GLM, ML — whatever you use, your method stays yours. The platform tracks versions and runs diagnostics; it doesn\'t prescribe.',
      },
      {
        label: 'Your judgement on tail behaviour',
        body: 'IBNR shape, treaty mechanics, latent claim assumptions — this is where reserving actuaries earn their fees. The platform makes the judgement visible and defensible; it doesn\'t replace it.',
      },
      {
        label: 'Your team\'s portfolio view',
        body: 'Cohort selection, segmentation, business-mix calls. Your senior reserving actuary remains the source of truth — the agent reads from their overlays, never around them.',
      },
    ],
  },

  /* ── S.06.02 — Asset Register ─────────────────────────────────────────── */
  s0602: {
    title: 'Where this changes the market risk conversation',
    subtitle: 'Five Board/CRO asks · live market SCR · what stays the same.',
    table_heading: 'The five recurring asks',
    diagram_heading: 'The lightbulb — live market SCR with pre-computed sensitivities',
    diagram_caption: 'Most firms know their market SCR at quarter-end. This makes it available continuously, with every directional move pre-computed.',
    diagram: 'market_live',
    pains: [
      {
        ask: '"Why did SCR_market move by EUR 8M between quarters?"',
        today: 'Asset team rebuilds the variance — equity vs FX vs spread vs property vs IR — manually, in xlsx.',
        platform: 'Auto-decomposition by sub-module + look-through. Pinpoints exactly which holdings drove the move.',
        platformLink: { to: '/report/s2501', label: 'SCR market sub-module' },
      },
      {
        ask: '"Show me the look-through for our European Equity Fund at Q1 close."',
        today: 'Re-pull from custodian, re-classify holdings manually. Around a day; sometimes longer if classification rules changed.',
        platform: 'Look-through is materialised silver. Replay the period and the look-through follows — same classification, same valuations.',
        platformLink: { to: '/archive', label: 'Submissions Archive' },
      },
      {
        ask: '"We\'re approaching the single-issuer concentration limit — when?"',
        today: 'Quarterly monitoring through the asset accountant. Retrospective by 2–8 weeks; surprises possible.',
        platform: 'Continuous concentration metric on the gold layer. Live drift visible to CRO; alert when threshold crossed.',
        platformLink: { to: '/today', label: 'Control Tower' },
      },
      {
        ask: '"What if equities drop 20% next week?"',
        today: 'Spin up a market-stress run — about 2 days, freezes the team. By the time it lands, the market has moved on.',
        platform: 'Sensitivities pre-computed across equity / FX / IR / spread shocks. Instant directional answer in the Board meeting.',
        platformLink: { to: '/orsa/draft', label: 'ORSA continuous draft' },
      },
      {
        ask: '"Is the custodian valuation consistent with our SII valuation?"',
        today: 'Reconciliation in xlsx by the asset accountant; quarterly; usually catches drift after the fact.',
        platform: 'Variance check runs on every custodian feed. Flags any holding where SII valuation drifts above tolerance.',
        platformLink: { to: '/feeds/custodian_holdings_abn', label: 'Custodian feed status' },
      },
    ],
    stays_heading: 'What stays exactly where it is',
    reassurances: [
      {
        label: 'Your custodian relationships',
        body: 'HSBC, ABN AMRO, BNY Mellon, BNP — the feeds and the contracts are untouched. The platform reads where they already deliver; it doesn\'t re-shape upstream.',
      },
      {
        label: 'Your investment policy',
        body: 'The IPS, asset-allocation mandates, risk-budget limits — set by the Board, owned by Investments. The platform monitors compliance; it doesn\'t set policy.',
      },
      {
        label: 'Your asset manager judgement',
        body: 'Security selection, tactical allocation, treaty mandates — your investment team\'s decisions. The platform makes the consequence for SII visible in seconds, not weeks.',
      },
    ],
  },

  /* ── S.26.06 — Non-Life UW Risk (Cat) ─────────────────────────────────── */
  s2606: {
    title: 'Where this changes the cat conversation',
    subtitle: 'Five Board/Catastrophe-Committee asks · the cat agent at the table · what stays the same.',
    table_heading: 'The five recurring asks',
    diagram_heading: 'The lightbulb — the cat agent grounded in three sources',
    diagram_caption: 'External event log + Igloo output + treaty terms read in one pass. The cat actuary\'s eyes, multiplied.',
    diagram: 'cat_agent',
    pains: [
      {
        ask: '"Cat AAL went up 12% Q-over-Q — what event explains it?"',
        today: 'Cat actuary reads Igloo output, the external event log (Munich Re / EM-DAT), and reinsurance terms; builds the explanation manually.',
        platform: 'Cat Modelling Agent cross-references all three; surfaces the explanation with audit-linked rationale ("storm Ylenia post-event reclassification, +EUR 8M").',
        platformLink: { to: '/lab/igloo_cat', label: 'Cat Modelling Agent' },
      },
      {
        ask: '"Are our exposures correctly classified in Igloo?"',
        today: 'Quarterly classification review, line-by-line in xlsx; catches obvious errors but misses subtle ones.',
        platform: 'Exposure classification automated from bronze; agent flags anomalies (new postcode, sum-insured drift, coverage code change).',
        platformLink: { to: '/lab/igloo_cat', label: 'Igloo lane · Lab' },
      },
      {
        ask: '"What if we change our XOL retention from EUR 50M to EUR 100M?"',
        today: 'Re-run Igloo scenarios, re-compute net cat charge, model new reinsurance recoveries — days of broker + actuary collaboration.',
        platform: 'Same gold scenarios; treaty parameters change; net cat charge + marginal ROL in minutes. Take it to the broker meeting.',
        platformLink: { to: '/whatif', label: 'What-If scenarios' },
      },
      {
        ask: '"Is the cat charge consistent with our cat-LoB reserve outlook?"',
        today: 'Cross-check in xlsx; periodic; inconsistencies surface at year-end sign-off.',
        platform: 'Cross-QRT reconciliation (s2606 cat ↔ s0501 cat-LoB reserves) runs as a hard gate on every Q-close.',
        platformLink: { to: '/internal-controls', label: 'Internal Controls' },
      },
      {
        ask: '"Industry event log shows storm X — is our model picking it up?"',
        today: 'Manual cross-check with Munich Re reports + EM-DAT entries. Annual at best.',
        platform: 'External event log is a managed Delta table; agent does the cross-reference on every Igloo run; flags missing or unattributed events.',
        platformLink: { to: '/lab/igloo_cat', label: 'External event log' },
      },
    ],
    stays_heading: 'What stays exactly where it is',
    reassurances: [
      {
        label: 'Your cat engine',
        body: 'Igloo, RMS, AIR, Karen Clark — whichever vendor you use, the engine of record stays. The platform takes the integration tax (data prep, audit, reconciliation), not the science.',
      },
      {
        label: 'Your portfolio judgement',
        body: 'PML choices, frequency-severity calibrations, secondary uncertainty assumptions — your cat actuary\'s domain. The platform makes the inputs and outputs auditable; the judgement stays yours.',
      },
      {
        label: 'Your reinsurance relationships',
        body: 'Brokers, treaty terms, retention structures — owned by underwriting and procurement. The platform makes the marginal economics visible; it doesn\'t negotiate.',
      },
    ],
  },

  /* ── Life Reserving (S.12.01) ─────────────────────────────────────────── */
  reserving_life: {
    title: 'Where this changes the life TP conversation',
    subtitle: 'Five Board/Audit asks · stochastic transparency · what stays the same.',
    table_heading: 'The five recurring asks',
    diagram_heading: 'The lightbulb — stochastic transparency',
    diagram_caption: 'Most life teams only see the mean (the BE). This makes the full 5K-scenario distribution queryable — including the tail.',
    diagram: 'stochastic_transparency',
    pains: [
      {
        ask: '"Why did the unit-linked BE move by EUR 15M between quarters?"',
        today: 'Life actuary reconstructs via assumption changes + market data + lapse experience; manual, takes a day; lives in one xlsx.',
        platform: 'Auto-decomposition: assumption deltas, scenario-set deltas, market data, approved overlay impacts — side by side.',
        platformLink: { to: '/lab/reserving_life', label: 'Reserving (Life) · Lab' },
      },
      {
        ask: '"We changed the lapse assumption — what\'s the impact?"',
        today: 'Schedule a Prophet re-run; 1–3 days depending on book size; result lands in an email.',
        platform: 'Continuous BE — assumption change triggers a Prophet re-run; result lands in gold; audit log captures the change.',
        platformLink: { to: '/lab/prophet_life', label: 'Prophet engine · Lab' },
      },
      {
        ask: '"Show me the BE at Q1 close, exactly as submitted."',
        today: 'Re-extract from Prophet, re-import, hope the scenario file hasn\'t drifted; reconstruction risk is non-trivial.',
        platform: 'Replay button — same scenario set ID, same assumptions, same projections. Byte-for-byte match with the submission.',
        platformLink: { to: '/archive', label: 'Submissions Archive' },
      },
      {
        ask: '"What\'s the BE under -50bps yield shift?"',
        today: 'Schedule a Prophet stress; 2–3 days; freezes the rest of the work; sometimes incomplete by the Board meeting.',
        platform: 'Stress is one of the standing scenarios. Continuously refreshed; available in the same gold table; ready when asked.',
        platformLink: { to: '/orsa/draft', label: 'ORSA continuous draft' },
      },
      {
        ask: '"Is the BE consistent with the IFRS 17 fulfilment cashflow?"',
        today: 'Separate workflow run by the IFRS team; quarterly cross-check; small drifts persist between cycles.',
        platform: 'Cross-pillar IFRS 17 best-estimate consistency check runs as a hard gate on every Q-close.',
        platformLink: { to: '/internal-controls', label: 'Internal Controls' },
      },
    ],
    stays_heading: 'What stays exactly where it is',
    reassurances: [
      {
        label: 'Your Prophet (or AXIS, DCS, MGALFA)',
        body: 'The life engine stays where it is. The platform reads the scenario output via UC Volume; the actuarial code doesn\'t move.',
      },
      {
        label: 'Your assumption-setting process',
        body: 'Annual experience studies, lapse review committee, mortality-improvement framework — all unchanged. The platform versions the assumption files and tracks their lineage; the assumption-setting is yours.',
      },
      {
        label: 'Your methodology judgement',
        body: 'Risk margin approach, contract boundary calls, deterministic vs stochastic — your senior life actuary\'s domain. The platform makes the consequences traceable; it doesn\'t prescribe the method.',
      },
    ],
  },

  /* ── Life UW Risk ─────────────────────────────────────────────────────── */
  life_uw_risk: {
    title: 'Where this changes the life UW conversation',
    subtitle: 'Five Board/Audit asks · continuous stress (not annual) · what stays the same.',
    table_heading: 'The five recurring asks',
    diagram_heading: 'The lightbulb — continuous stress, not annual',
    diagram_caption: 'Lapse SCR drift is rarely a year-end surprise — but most teams only see it at year-end. This shifts the discovery into the cycle.',
    diagram: 'continuous_stress',
    pains: [
      {
        ask: '"Why is the lapse SCR drifting up?"',
        today: 'Lapse actuary reads the spreadsheet at year-end; spike has been building for two quarters; reaction is reactive.',
        platform: 'Continuous lapse-trend monitoring on the gold layer. Unit-linked spike (or pension drawdown shift) visible in-cycle.',
        platformLink: { to: '/today', label: 'Control Tower · Q4 pains' },
      },
      {
        ask: '"What\'s mortality SCR under +10% experience deterioration?"',
        today: 'Schedule a Prophet stress, manual aggregation across products and Annexes, 2–3 days.',
        platform: 'Standing stress scenario, refreshed every Q-close. Same gold; one-click to the breakdown.',
        platformLink: { to: '/orsa', label: 'ORSA scenarios' },
      },
      {
        ask: '"Is the life cat assumption consistent with our non-life cat model?"',
        today: 'Periodic xlsx cross-check by the cat actuary; sometimes a footnote in the SFCR; mostly siloed.',
        platform: 'Cross-engine reconciliation between Prophet life cat + Igloo non-life cat. Runs every Q-close as a hard control.',
        platformLink: { to: '/internal-controls', label: 'Internal Controls' },
      },
      {
        ask: '"Show me the longevity stress impact by product line."',
        today: 'Run Prophet per product, aggregate manually, format the table for the Board.',
        platform: 'Pre-aggregated in the gold layer. Click any cell for the sub-module breakdown; replay back to projections.',
        platformLink: { to: '/lab/prophet_life', label: 'Prophet engine · Lab' },
      },
      {
        ask: '"What if mortality improvements continue at 1% per year over 30 years?"',
        today: 'Speculative — needs a custom Prophet run; rarely answered in the same Board meeting.',
        platform: 'Long-term mortality-improvement scenario as a standing run; sensitivity to improvement rate pre-computed.',
        platformLink: { to: '/orsa', label: 'ORSA · long-horizon scenarios' },
      },
    ],
    stays_heading: 'What stays exactly where it is',
    reassurances: [
      {
        label: 'Your Prophet model',
        body: 'The model, the parameterisation, the runtime — unchanged. The platform reads the stress output; the engine of record is where it always was.',
      },
      {
        label: 'Your stress design',
        body: 'Board-approved stresses, scenario menus, governance over scenario changes — all unchanged. The platform refreshes them more often; it doesn\'t set them.',
      },
      {
        label: 'Your experience-study practice',
        body: 'Annual mortality study, lapse experience review, expense analysis — owned by your senior life team. The platform versions the inputs; the studies remain your work.',
      },
    ],
  },
};

export function getArtefactImpact(qrtId: string): ImpactConfig | undefined {
  return ARTEFACT_IMPACT[qrtId.toLowerCase()];
}
