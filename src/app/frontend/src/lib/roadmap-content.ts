/**
 * Roadmap stub content — one entry per roadmap tile.
 *
 * Adding a roadmap tile = (1) entry in workbench-tiles.ts, (2) entry here. No
 * per-tile component file needed.
 */
export interface RoadmapEntry {
  what: string;                                    // What this workflow covers (1 paragraph)
  workbench_capabilities: string[];                // Bullets — how it extends the workbench
  adjacent_links: { label: string; to: string }[]; // Live patterns to point at
}

export const ROADMAP_CONTENT: Record<string, RoadmapEntry> = {
  pricing: {
    what: "Rate-making for non-life lines: GLM/GBM models, market-rate alignment, " +
      "underwriting-control checks, bias monitoring across protected attributes. " +
      "The same exposure + claims data that feeds reserving and SF.",
    workbench_capabilities: [
      "GLM / GBM models registered in Unity Catalog as MLflow pyfuncs — same governance interface as the SF + reserving models in the Lab.",
      "Mosaic AI for serving real-time quote requests; production / candidate aliases for safe rollout of new rate plans.",
      "Bias monitoring as a Lab diagnostic: protected-attribute parity checks alongside the existing variance-vs-prior + reasonableness checks.",
      "Same Overlays Register pattern for underwriter overrides — magnitude, rationale, approver, audit-trailed.",
      "Same audit panel: every premium quote carries its source data, the model version that priced it, and the underwriter overlay (if any).",
    ],
    adjacent_links: [
      { label: 'See the model registry pattern (Standard Formula)', to: '/lab/standard_formula' },
      { label: 'See the overlay pattern (Overlays Register)', to: '/overlays' },
    ],
  },

  'ifrs-17': {
    what: "IFRS 17 financial reporting for insurance contracts: contract groups, " +
      "Contractual Service Margin (CSM), risk adjustment, fulfilment cashflows. Heavy " +
      "data overlap with Solvency II technical provisions.",
    workbench_capabilities: [
      "CSM + fulfilment-cashflow tables as a peer gold layer alongside the SII gold layer — same Delta + UC governance.",
      "Reuses the cashflow projection engine that drives life TPs (Prophet) — the IFRS 17 measurement model adds the CSM mechanics on top.",
      "Same audit panel: every CSM movement carries its lineage to the underlying contract group + assumption set.",
      "Same overlay register for unlocking adjustments and CSM smoothing decisions.",
      "Reverse path to SII: the CSM run can flag inconsistencies between IFRS 17 best-estimate and SII best-estimate.",
    ],
    adjacent_links: [
      { label: 'See the life technical provisions surface (S.12.01)', to: '/reserving-life' },
      { label: 'See the Audit panel pattern', to: '/report/s0501' },
    ],
  },

  reinsurance: {
    what: "Reinsurance program performance: treaty-level analytics, retrocession " +
      "optimisation, capital-relief modelling. Same exposures that feed Igloo's cat " +
      "model are the inputs an RI optimisation already needs.",
    workbench_capabilities: [
      "Treaty performance: per-treaty cession, recoveries, and net retention as a peer gold table.",
      "Retrocession optimisation: linear / convex programming models in UC reading the same exposure layers Igloo reads.",
      "Capital-relief calculator that ties RI structure changes back to the SF + Igloo SCR components — what-if for RI design.",
      "Same Lab interface — RI optimisation models are peer rows alongside reserving + SF + cat.",
      "Same audit + lineage: every RI decision carries its rationale, modelled benefit, and downstream SCR impact.",
    ],
    adjacent_links: [
      { label: 'See the cat engine (Igloo) in the Lab', to: '/lab/igloo_cat' },
      { label: 'See the Adjacencies overview', to: '/adjacencies' },
    ],
  },

  'claims-analytics': {
    what: "Claim-level analytics: fraud signals, severity prediction, experience " +
      "monitoring, reserving feedback. Same claim transactions feeding S.05.01 and the " +
      "reserving model already feed these.",
    workbench_capabilities: [
      "Fraud / anomaly models registered alongside reserving and SF — uniform governance.",
      "Severity prediction at first notification of loss — informs case-reserve recommendations.",
      "Experience-monitoring dashboards drawn from the same gold tables, surfacing emerging trends to the reserving committee.",
      "Audit panel surfaces the model that flagged each claim, plus any analyst overrides as overlays.",
      "Closes the loop: insights from claims feed the next reserving + pricing cycle.",
    ],
    adjacent_links: [
      { label: 'See claim data in S.05.01', to: '/report/s0501' },
      { label: 'See the Senior Reserving Actuary agent', to: '/lab/reserving_pnc' },
    ],
  },

  'reserving-deep-dive': {
    what: "Deeper reserving capability beyond the chain-ladder + BF examples in the " +
      "Lab: methodology library, model validation framework, expert-judgement repository, " +
      "actual-vs-expected feedback loop.",
    workbench_capabilities: [
      "Methodology library: chain-ladder, Bornhuetter-Ferguson, Mack, GLM-based, peer-comparison — each registered in UC, governed identically.",
      "Validation framework: actual-vs-expected on a rolling cohort, automated tail-fit assessment, residual diagnostics — surfaces in the Lab Diagnostics tab.",
      "Expert-judgement repository builds on the Overlays Register — every judgement audit-trailed with rationale + magnitude.",
      "Quarter-over-quarter reserving committee dashboard with the Senior Reserving Actuary agent surfacing emerging trends.",
      "Direct lineage from each reserve estimate to the QRT cells it produces, surfaced in the audit panel.",
    ],
    adjacent_links: [
      { label: 'See the worked-example notebooks (chain-ladder, BF)', to: '/lab' },
      { label: 'See the Senior Reserving Actuary agent', to: '/lab/reserving_pnc' },
    ],
  },
};
