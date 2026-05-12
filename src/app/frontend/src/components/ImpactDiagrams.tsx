/**
 * Bespoke lightbulb diagrams for each Pillar 1 artefact.
 *
 * Each exported component is a self-contained SVG (with optional rendered
 * commentary underneath). Dispatched from ArtefactImpactPanel via the
 * `diagram` key in the per-artefact ImpactConfig.
 *
 * Design notes: every diagram is meant to land *one* visionary moment, not
 * to be exhaustive. The header above each function spells out that moment
 * in one sentence — if the diagram drifts from that, redesign it.
 */
import {
  Trophy, FlaskConical, GitMerge, Activity, TrendingUp,
  AlertTriangle, Bot, Wind, Database, Workflow, ScrollText,
  BarChart3,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────
   1. Champion vs Challenger — continuous shadow run.
   Visionary moment: every quarter the two models run on the same data;
   diagnostics decide the flip; it's auditable. Every reserve actuary
   knows they should be doing this; almost none are.
   ───────────────────────────────────────────────────────────────────────── */

export function ChampionChallengerDiagram() {
  const W = 1100, H = 320;
  const quarters = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2'];
  const xOf = (i: number) => 130 + i * 160;

  // Synthetic but plausible IBNR estimates by method (in EUR M)
  const champion =  [142.1, 138.4, 145.0, 149.8, 151.3, 154.6]; // CL
  const challenger = [144.8, 140.2, 147.6, 151.2, 153.9, 156.0]; // BF
  const all = [...champion, ...challenger];
  const min = Math.min(...all) - 2, max = Math.max(...all) + 2;
  const yOf = (v: number) => 220 - ((v - min) / (max - min)) * 140;

  const flipQuarter = 4; // alias flip happens at 2026-Q1

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 720, maxHeight: 340 }}>
        <defs>
          <marker id="ccarrow" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#475569" />
          </marker>
        </defs>

        {/* y-axis label */}
        <text x={50} y={150} fontSize={10} fill="#64748b" transform="rotate(-90 50 150)" textAnchor="middle">
          IBNR estimate (EUR M)
        </text>

        {/* gridlines */}
        {[0, 1, 2, 3].map((i) => {
          const y = 80 + i * 50;
          return <line key={i} x1={80} y1={y} x2={W - 30} y2={y} stroke="#e2e8f0" strokeWidth={0.5} />;
        })}

        {/* x-axis (quarter labels) */}
        {quarters.map((q, i) => (
          <g key={q}>
            <line x1={xOf(i)} y1={220} x2={xOf(i)} y2={228} stroke="#94a3b8" strokeWidth={0.8} />
            <text x={xOf(i)} y={246} textAnchor="middle" fontSize={11} fill="#475569" fontFamily="monospace">{q}</text>
          </g>
        ))}

        {/* Champion line (Chain Ladder) */}
        <polyline points={champion.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ')}
          fill="none" stroke="#7c3aed" strokeWidth={2.5} />
        {champion.map((v, i) => (
          <circle key={`c-${i}`} cx={xOf(i)} cy={yOf(v)} r={5} fill="#fff" stroke="#7c3aed" strokeWidth={2.5} />
        ))}

        {/* Challenger line (BF) */}
        <polyline points={challenger.map((v, i) => `${xOf(i)},${yOf(v)}`).join(' ')}
          fill="none" stroke="#0369a1" strokeWidth={2.5} strokeDasharray="6 3" />
        {challenger.map((v, i) => (
          <circle key={`x-${i}`} cx={xOf(i)} cy={yOf(v)} r={5} fill="#fff" stroke="#0369a1" strokeWidth={2.5} />
        ))}

        {/* Alias flip annotation */}
        <line x1={xOf(flipQuarter)} y1={50} x2={xOf(flipQuarter)} y2={220} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="3 3" />
        <rect x={xOf(flipQuarter) - 70} y={28} width={140} height={26} rx={4} fill="#fee2e2" stroke="#dc2626" strokeWidth={1.2} />
        <text x={xOf(flipQuarter)} y={45} textAnchor="middle" fontSize={11} fontWeight={700} fill="#991b1b">
          alias flip — BF promoted
        </text>

        {/* Legend */}
        <g transform="translate(85, 270)">
          <line x1={0} y1={6} x2={26} y2={6} stroke="#7c3aed" strokeWidth={2.5} />
          <circle cx={13} cy={6} r={4} fill="#fff" stroke="#7c3aed" strokeWidth={2.5} />
          <text x={35} y={10} fontSize={11} fill="#475569" fontWeight={600}>Champion · Chain ladder</text>
        </g>
        <g transform="translate(370, 270)">
          <line x1={0} y1={6} x2={26} y2={6} stroke="#0369a1" strokeWidth={2.5} strokeDasharray="6 3" />
          <circle cx={13} cy={6} r={4} fill="#fff" stroke="#0369a1" strokeWidth={2.5} />
          <text x={35} y={10} fontSize={11} fill="#475569" fontWeight={600}>Challenger · Bornhuetter-Ferguson</text>
        </g>
        <g transform="translate(720, 270)">
          <text x={0} y={10} fontSize={11} fill="#475569" fontStyle="italic">Both run every Q · diagnostics decide the flip</text>
        </g>
      </svg>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        <DetailCard tone="violet" icon={Trophy} title="Champion runs in production">
          Chain ladder is the model of record; output flows to the SCR aggregator.
        </DetailCard>
        <DetailCard tone="blue" icon={FlaskConical} title="Challenger runs in shadow">
          BF runs on the same triangles, same parameters. Output sits in a separate gold slot.
        </DetailCard>
        <DetailCard tone="rose" icon={GitMerge} title="Alias flip is audited">
          When diagnostics consistently favour the challenger, the alias swap is one click + signed justification — every flip in 6_gov_promotions.
        </DetailCard>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   2. Live market SCR with pre-computed sensitivities.
   Visionary moment: today's portfolio + yesterday's market close = today's
   SCR_market. All major sensitivities pre-computed. The Board gets the
   directional answer in the meeting, not 2 days later.
   ───────────────────────────────────────────────────────────────────────── */

export function MarketLiveDiagram() {
  const W = 1100, H = 320;
  const portfolioBoxY = 130;

  const sensitivities = [
    { label: '-20% equity',  delta: '+EUR 92M',  tone: 'rose'   },
    { label: '+50bps IR',     delta: '-EUR 68M',  tone: 'emerald' },
    { label: '+100bps spread', delta: '+EUR 41M',  tone: 'rose'   },
    { label: 'EUR/GBP -10%',  delta: '+EUR 18M',  tone: 'rose'   },
    { label: '-10% property', delta: '+EUR 22M',  tone: 'rose'   },
  ];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 720, maxHeight: 340 }}>
        <defs>
          <marker id="mlarrow" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#64748b" />
          </marker>
          <linearGradient id="portfolioGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#dbeafe" />
            <stop offset="100%" stopColor="#e0f2fe" />
          </linearGradient>
        </defs>

        {/* Centre: Portfolio */}
        <rect x={W / 2 - 140} y={portfolioBoxY} width={280} height={70} rx={10} fill="url(#portfolioGrad)" stroke="#0369a1" strokeWidth={1.6} />
        <text x={W / 2} y={portfolioBoxY + 26} textAnchor="middle" fontWeight={700} fontSize={14} fill="#0c4a6e">
          Today's portfolio
        </text>
        <text x={W / 2} y={portfolioBoxY + 46} textAnchor="middle" fontSize={11} fill="#0c4a6e">
          EUR 6.4 B · CIC-classified · look-through done
        </text>
        <text x={W / 2} y={portfolioBoxY + 62} textAnchor="middle" fontSize={10} fontStyle="italic" fill="#0369a1">
          + yesterday's market close
        </text>

        {/* Output: Live SCR_market */}
        <g>
          <rect x={W - 240} y={portfolioBoxY - 50} width={210} height={70} rx={10} fill="#fef3c7" stroke="#b45309" strokeWidth={1.8} />
          <text x={W - 135} y={portfolioBoxY - 24} textAnchor="middle" fontWeight={700} fontSize={14} fill="#78350f">Live SCR_market</text>
          <text x={W - 135} y={portfolioBoxY - 8} textAnchor="middle" fontSize={11} fill="#78350f">EUR 218 M</text>
          <text x={W - 135} y={portfolioBoxY + 10} textAnchor="middle" fontSize={10} fontStyle="italic" fill="#92400e">refreshed nightly</text>
        </g>

        {/* Sensitivity rays out the left */}
        <text x={50} y={50} fontWeight={700} fontSize={11} fill="#475569" letterSpacing={1}>PRE-COMPUTED SENSITIVITIES</text>
        {sensitivities.map((s, i) => {
          const y = 75 + i * 38;
          const tone = s.tone === 'rose'
            ? { fill: '#fee2e2', stroke: '#b91c1c', text: '#991b1b' }
            : { fill: '#d1fae5', stroke: '#047857', text: '#065f46' };
          return (
            <g key={s.label}>
              <rect x={40} y={y} width={170} height={28} rx={6} fill={tone.fill} stroke={tone.stroke} strokeWidth={1} />
              <text x={50} y={y + 19} fontSize={11} fontWeight={600} fill={tone.text}>{s.label}</text>
              <text x={200} y={y + 19} textAnchor="end" fontSize={11} fontWeight={700} fontFamily="monospace" fill={tone.text}>{s.delta}</text>
              <line x1={210} y1={y + 14} x2={W / 2 - 140} y2={portfolioBoxY + 35} stroke="#cbd5e1" strokeWidth={0.8} strokeDasharray="2 2" />
            </g>
          );
        })}

        {/* Arrow portfolio → SCR */}
        <line x1={W / 2 + 140} y1={portfolioBoxY + 35} x2={W - 240} y2={portfolioBoxY - 15} stroke="#475569" strokeWidth={1.8} markerEnd="url(#mlarrow)" />

        {/* Caption */}
        <text x={W / 2} y={H - 30} textAnchor="middle" fontSize={12} fontStyle="italic" fill="#475569">
          Most firms know SCR_market once a quarter. This makes it a live number — with every plausible move pre-answered.
        </text>
      </svg>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        <DetailCard tone="blue" icon={Activity} title="Live, not point-in-time">
          Portfolio data refreshes from the custodian feed nightly; market data updates with it; SCR_market is a current number, not a quarter-end polaroid.
        </DetailCard>
        <DetailCard tone="amber" icon={TrendingUp} title="Sensitivities pre-answered">
          Equity, IR, spread, FX, property — each as a standing scenario. Marginal impact on the SCR is ready before the Board asks.
        </DetailCard>
        <DetailCard tone="rose" icon={AlertTriangle} title="Concentration drift visible">
          Single-issuer + asset-class concentration metrics tracked continuously; the CRO sees the drift before it becomes a limit breach.
        </DetailCard>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   3. Cat agent grounded in three sources.
   Visionary moment: the cat actuary's job is multiplied — the agent reads
   the same evidence (event log + Igloo + treaty) and surfaces the
   explanation with an audit link, in seconds.
   ───────────────────────────────────────────────────────────────────────── */

export function CatAgentDiagram() {
  const W = 1100, H = 360;
  const cx = W / 2, cy = 170;

  const sources = [
    { x: 140,  y: 80,  label: 'External event log',   sub: 'Munich Re · EM-DAT · PERILS',    stroke: '#0369a1', fill: '#dbeafe' },
    { x: 140,  y: 200, label: 'Igloo runs',            sub: 'this quarter · prior quarters',  stroke: '#b45309', fill: '#fef3c7' },
    { x: 140,  y: 320, label: 'Reinsurance treaties',  sub: 'XOL · QS · stop-loss · per-event', stroke: '#047857', fill: '#d1fae5' },
  ];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 720, maxHeight: 380 }}>
        <defs>
          <marker id="ctagentarr" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#64748b" />
          </marker>
        </defs>

        {/* Sources column */}
        {sources.map((s) => (
          <g key={s.label}>
            <rect x={s.x - 100} y={s.y - 26} width={200} height={52} rx={8} fill={s.fill} stroke={s.stroke} strokeWidth={1.3} />
            <text x={s.x} y={s.y - 6} textAnchor="middle" fontWeight={700} fontSize={12} fill={s.stroke}>{s.label}</text>
            <text x={s.x} y={s.y + 13} textAnchor="middle" fontSize={10} fontStyle="italic" fill={s.stroke}>{s.sub}</text>
          </g>
        ))}

        {/* Agent in the middle */}
        <g>
          <circle cx={cx} cy={cy} r={70} fill="#ede9fe" stroke="#6d28d9" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={56} fill="#ddd6fe" stroke="none" />
          <text x={cx} y={cy - 4} textAnchor="middle" fontWeight={700} fontSize={14} fill="#4c1d95">Cat Modelling</text>
          <text x={cx} y={cy + 16} textAnchor="middle" fontWeight={700} fontSize={14} fill="#4c1d95">Agent</text>
          <text x={cx} y={cy + 36} textAnchor="middle" fontSize={10} fontStyle="italic" fill="#5b21b6">grounded in your data</text>
        </g>

        {/* Output box on the right */}
        <g>
          <rect x={cx + 200} y={120} width={290} height={100} rx={10} fill="#fef3c7" stroke="#b45309" strokeWidth={1.5} />
          <text x={cx + 215} y={142} fontWeight={700} fontSize={12} fill="#78350f">Anomaly surfaced</text>
          <text x={cx + 215} y={162} fontSize={11} fill="#78350f">"Property cat +12% Q-over-Q."</text>
          <text x={cx + 215} y={180} fontSize={11} fill="#78350f">"Single event explains it: storm Ylenia</text>
          <text x={cx + 215} y={196} fontSize={11} fill="#78350f">post-event reclassification, +EUR 8M."</text>
          <text x={cx + 215} y={213} fontSize={10} fontStyle="italic" fill="#92400e">+ overlay proposal + audit link</text>
        </g>

        {/* Arrows from sources to agent */}
        {sources.map((s) => (
          <line key={s.label + '-l'} x1={s.x + 100} y1={s.y} x2={cx - 70} y2={cy + (s.y - cy) * 0.3}
            stroke="#94a3b8" strokeWidth={1.4} markerEnd="url(#ctagentarr)" />
        ))}

        {/* Arrow agent → output */}
        <line x1={cx + 70} y1={cy} x2={cx + 200} y2={170} stroke="#475569" strokeWidth={1.8} markerEnd="url(#ctagentarr)" />

        {/* Caption */}
        <text x={W / 2} y={H - 12} textAnchor="middle" fontSize={12} fontStyle="italic" fill="#475569">
          The cat actuary still owns the decision. The agent just removes the 2 hours it would have taken to assemble the evidence.
        </text>
      </svg>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        <DetailCard tone="violet" icon={Bot} title="Grounded, not hallucinating">
          Reads from the audit-tracked tables only. Every claim cites the row it came from — clickable back to source.
        </DetailCard>
        <DetailCard tone="amber" icon={Wind} title="Event correlation in seconds">
          Industry event log + portfolio loss + treaty recoveries cross-referenced automatically; what used to be 2 hours of xlsx is 30 seconds.
        </DetailCard>
        <DetailCard tone="emerald" icon={ScrollText} title="Proposes overlays, doesn't apply them">
          Anomaly surface → overlay draft with rationale → cat actuary reviews → human approves. The audit trail is uninterrupted.
        </DetailCard>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   4. Stochastic transparency — the 5K scenarios behind the BE.
   Visionary moment: most life teams only see the mean. This makes the
   distribution queryable — including the 95th, 99th, the tail risk.
   ───────────────────────────────────────────────────────────────────────── */

export function StochasticTransparencyDiagram() {
  const W = 1100, H = 320;
  const baseY = 230, baseX = 80, plotW = W - 130;

  // Synthetic distribution — bell-shaped, slight right skew (long tail)
  // Generates a smooth path to simulate a histogram envelope.
  const points: [number, number][] = [];
  const N = 60;
  for (let i = 0; i < N; i++) {
    const x = baseX + (i / (N - 1)) * plotW;
    const xn = (i / (N - 1)) * 2 - 1; // -1..1
    // bell + small tail
    const h = Math.exp(-3 * xn * xn) * 120 + Math.max(0, (xn - 0.4)) * 18;
    points.push([x, baseY - h]);
  }
  const pathD = points.reduce((acc, [x, y], i) => acc + (i === 0 ? `M ${x} ${baseY} L ${x} ${y}` : ` L ${x} ${y}`), '')
                  + ` L ${baseX + plotW} ${baseY} Z`;

  const meanX = baseX + plotW * 0.5;       // BE = mean
  const p95X  = baseX + plotW * 0.78;
  const p99X  = baseX + plotW * 0.9;
  const meanY = points[Math.floor(N * 0.5)][1];
  const p95Y  = points[Math.floor(N * 0.78)][1];
  const p99Y  = points[Math.floor(N * 0.9)][1];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 720, maxHeight: 340 }}>
        <defs>
          <linearGradient id="stochGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.08} />
          </linearGradient>
        </defs>

        {/* y-axis label */}
        <text x={36} y={150} fontSize={10} fill="#64748b" transform="rotate(-90 36 150)" textAnchor="middle">
          Density across 5,000 scenarios
        </text>

        {/* Distribution */}
        <path d={pathD} fill="url(#stochGrad)" stroke="#7c3aed" strokeWidth={1.5} />

        {/* Mean line (BE) */}
        <line x1={meanX} y1={meanY} x2={meanX} y2={baseY} stroke="#7c3aed" strokeWidth={2} />
        <rect x={meanX - 60} y={meanY - 32} width={120} height={26} rx={4} fill="#ede9fe" stroke="#7c3aed" strokeWidth={1} />
        <text x={meanX} y={meanY - 14} textAnchor="middle" fontSize={11} fontWeight={700} fill="#4c1d95">Mean = BE</text>

        {/* 95th and 99th percentile lines */}
        {[
          { x: p95X, y: p95Y, label: '95th pctile',  colour: '#ea580c' },
          { x: p99X, y: p99Y, label: '99th pctile',  colour: '#dc2626' },
        ].map((m) => (
          <g key={m.label}>
            <line x1={m.x} y1={m.y} x2={m.x} y2={baseY} stroke={m.colour} strokeWidth={1.5} strokeDasharray="4 3" />
            <text x={m.x} y={baseY + 16} textAnchor="middle" fontSize={10} fontWeight={600} fill={m.colour}>{m.label}</text>
          </g>
        ))}

        {/* Tail box */}
        <rect x={p99X + 4} y={baseY - 100} width={W - p99X - 40} height={86} rx={6} fill="#fef2f2" stroke="#dc2626" strokeWidth={1.2} strokeDasharray="3 3" />
        <text x={p99X + 14} y={baseY - 82} fontSize={11} fontWeight={700} fill="#991b1b">The 1% tail — queryable</text>
        <text x={p99X + 14} y={baseY - 65} fontSize={10} fill="#7f1d1d">scenarios that drive the risk margin</text>
        <text x={p99X + 14} y={baseY - 50} fontSize={10} fill="#7f1d1d">cluster on lapse + rate moves</text>
        <text x={p99X + 14} y={baseY - 32} fontSize={10} fill="#7f1d1d" fontStyle="italic">drill into any of the 50</text>

        {/* baseline */}
        <line x1={baseX} y1={baseY} x2={baseX + plotW} y2={baseY} stroke="#94a3b8" strokeWidth={0.8} />

        {/* Caption */}
        <text x={W / 2} y={H - 22} textAnchor="middle" fontSize={12} fontStyle="italic" fill="#475569">
          What used to be five rows of a Prophet summary table is now the whole distribution — addressable.
        </text>
      </svg>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        <DetailCard tone="violet" icon={BarChart3} title="Distribution, not just mean">
          The BE is the average; the platform makes the spread, the tail, and the scenario-level detail queryable from the same gold layer.
        </DetailCard>
        <DetailCard tone="amber" icon={TrendingUp} title="Risk margin grounded">
          The 1% tail drives the risk margin. With the scenarios visible, the RM number stops being a black box for the Board.
        </DetailCard>
        <DetailCard tone="rose" icon={AlertTriangle} title="Stress = filter on the existing run">
          Want -50bps? Filter the existing 5K scenarios on the rate path. No re-run; just a slice. Continuous stress without Prophet re-runs.
        </DetailCard>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   5. Continuous stress — quarterly refresh, not annual.
   Visionary moment: life UW stress is typically annual; this shifts the
   discovery into the cycle, so a sustained lapse pattern is caught two
   quarters earlier.
   ───────────────────────────────────────────────────────────────────────── */

export function ContinuousStressDiagram() {
  const W = 1100, H = 320;
  const quarters = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2'];
  const xOf = (i: number) => 130 + i * 160;

  // Two flavours of lapse-rate evolution (UL quarterly lapse %)
  // Synthetic but plausible — sustained climb in latter quarters
  const annual:     [number, number][] = [[0, 1.8], [5, 2.3]];   // only end-points visible
  const continuous: [number, number][] = [
    [0, 1.80], [1, 1.85], [2, 1.92], [3, 2.04], [4, 2.18], [5, 2.30],
  ];

  const yOf = (v: number) => 220 - ((v - 1.5) / 1.2) * 140;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 720, maxHeight: 340 }}>
        <defs>
          <marker id="csarrow" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="#475569" />
          </marker>
        </defs>

        {/* y-axis */}
        <text x={50} y={150} fontSize={10} fill="#64748b" transform="rotate(-90 50 150)" textAnchor="middle">
          UL quarterly lapse %
        </text>
        {[1.6, 1.9, 2.2, 2.5].map((v) => (
          <g key={v}>
            <line x1={80} y1={yOf(v)} x2={W - 30} y2={yOf(v)} stroke="#e2e8f0" strokeWidth={0.5} />
            <text x={70} y={yOf(v) + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{v.toFixed(1)}</text>
          </g>
        ))}

        {/* x-axis */}
        {quarters.map((q, i) => (
          <g key={q}>
            <line x1={xOf(i)} y1={220} x2={xOf(i)} y2={228} stroke="#94a3b8" strokeWidth={0.8} />
            <text x={xOf(i)} y={246} textAnchor="middle" fontSize={11} fill="#475569" fontFamily="monospace">{q}</text>
          </g>
        ))}

        {/* Annual line (only two points, dashed) */}
        <polyline points={annual.map(([i, v]) => `${xOf(i)},${yOf(v)}`).join(' ')}
          fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 3" />
        {annual.map(([i, v]) => (
          <circle key={`a-${i}`} cx={xOf(i)} cy={yOf(v)} r={6} fill="#fff" stroke="#94a3b8" strokeWidth={2} />
        ))}

        {/* Continuous line */}
        <polyline points={continuous.map(([i, v]) => `${xOf(i)},${yOf(v)}`).join(' ')}
          fill="none" stroke="#dc2626" strokeWidth={2.5} />
        {continuous.map(([i, v]) => (
          <circle key={`c-${i}`} cx={xOf(i)} cy={yOf(v)} r={5} fill="#fff" stroke="#dc2626" strokeWidth={2.5} />
        ))}

        {/* Discovery markers */}
        <g>
          <rect x={xOf(3) - 60} y={36} width={140} height={26} rx={4} fill="#fef2f2" stroke="#dc2626" strokeWidth={1.2} />
          <text x={xOf(3)} y={53} textAnchor="middle" fontSize={11} fontWeight={700} fill="#991b1b">discovered Q4</text>
          <line x1={xOf(3)} y1={62} x2={xOf(3)} y2={yOf(continuous[3][1]) - 8} stroke="#dc2626" strokeWidth={1} strokeDasharray="2 2" />
        </g>
        <g>
          <rect x={xOf(5) - 60} y={36} width={140} height={26} rx={4} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={1.2} />
          <text x={xOf(5)} y={53} textAnchor="middle" fontSize={11} fontWeight={700} fill="#475569">discovered Q-end +2yr</text>
          <line x1={xOf(5)} y1={62} x2={xOf(5)} y2={yOf(continuous[5][1]) - 8} stroke="#94a3b8" strokeWidth={1} strokeDasharray="2 2" />
        </g>

        {/* Legend */}
        <g transform="translate(85, 270)">
          <line x1={0} y1={6} x2={26} y2={6} stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 3" />
          <circle cx={13} cy={6} r={4} fill="#fff" stroke="#94a3b8" strokeWidth={2} />
          <text x={35} y={10} fontSize={11} fill="#475569" fontWeight={600}>Annual stress refresh — what most teams have</text>
        </g>
        <g transform="translate(500, 270)">
          <line x1={0} y1={6} x2={26} y2={6} stroke="#dc2626" strokeWidth={2.5} />
          <circle cx={13} cy={6} r={4} fill="#fff" stroke="#dc2626" strokeWidth={2.5} />
          <text x={35} y={10} fontSize={11} fill="#475569" fontWeight={600}>Quarterly stress refresh — the platform</text>
        </g>
      </svg>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        <DetailCard tone="rose" icon={AlertTriangle} title="Discovery shifts left">
          A sustained UL lapse climb shows up two quarters earlier. Time to act vs time to react — that's the difference.
        </DetailCard>
        <DetailCard tone="blue" icon={Workflow} title="Stress = standing scenarios">
          Mortality +10%, longevity -5%, lapse +10%, rate -50bps. All standing scenarios, refreshed nightly off the same Prophet runs.
        </DetailCard>
        <DetailCard tone="violet" icon={Database} title="Lineage stays clean">
          Each refresh writes a new run_id into the gold layer; the audit log shows what changed; replay is a click away.
        </DetailCard>
      </div>
    </div>
  );
}

/* ═══════ Shared detail-card primitive ═══════ */

function DetailCard({ tone, icon: Icon, title, children }: {
  tone: 'violet' | 'blue' | 'amber' | 'rose' | 'emerald';
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  const cls = {
    violet:  { border: 'border-violet-200',  bg: 'bg-violet-50/40',  text: 'text-violet-900',  icon: 'text-violet-700' },
    blue:    { border: 'border-blue-200',    bg: 'bg-blue-50/40',    text: 'text-blue-900',    icon: 'text-blue-700' },
    amber:   { border: 'border-amber-200',   bg: 'bg-amber-50/40',   text: 'text-amber-900',   icon: 'text-amber-700' },
    rose:    { border: 'border-rose-200',    bg: 'bg-rose-50/40',    text: 'text-rose-900',    icon: 'text-rose-700' },
    emerald: { border: 'border-emerald-200', bg: 'bg-emerald-50/40', text: 'text-emerald-900', icon: 'text-emerald-700' },
  }[tone];
  return (
    <div className={`rounded-lg border ${cls.border} ${cls.bg} p-3`}>
      <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold ${cls.text}`}>
        <Icon className={`w-3.5 h-3.5 ${cls.icon}`} />
        {title}
      </div>
      <div className="text-[11px] text-gray-700 mt-1 leading-relaxed">{children}</div>
    </div>
  );
}

