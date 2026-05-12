/**
 * SCR Impact panel — the "why this changes the conversation" view for S.25.01.
 *
 * Three sections, written for an actuarial practitioner who already knows the
 * regime. The aim is to make a head actuary or consultant recognise their own
 * pain points (without making them feel weak about today's process), then
 * deliver a lightbulb moment.
 *
 *   1. Pain → today → platform — a 5-row table framed as Board/Audit asks.
 *      Common questions every Solvency II actuary fields, with today's
 *      reality next to what this platform makes routine.
 *
 *   2. The lightbulb — "SCR as a function, not a snapshot." Three uses of
 *      the same gold layer: As-of (replay), Live (continuous), Stress
 *      (what-if). Most firms ship one SCR per quarter; this gives them three.
 *
 *   3. What stays the same — explicit reassurance: vendor engines, sign-off
 *      chain, actuarial judgement all stay where they are. The platform
 *      replaces the integration tax, not the actuarial science.
 */
import { Link } from 'react-router-dom';
import {
  Sparkles, History, Activity, Wind, ArrowRight,
  ScrollText, Database, ChevronDown,
} from 'lucide-react';

export default function SCRImpactPanel() {
  return (
    <details className="group bg-gradient-to-br from-slate-50 via-white to-blue-50/40 border-2 border-slate-200 rounded-xl overflow-hidden">
      <summary className="px-5 py-3 border-b border-transparent group-open:border-slate-200 bg-slate-50/80 cursor-pointer hover:bg-slate-100 transition-colors list-none">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-700 shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Where this changes the conversation</h3>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Five Board/Audit asks · the lightbulb diagram · what stays the same — click to expand.
            </p>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-open:rotate-180 shrink-0" />
        </div>
      </summary>

      <div className="p-5 space-y-6">
        <PainTable />
        <FunctionDiagram />
        <StaysTheSame />
      </div>
    </details>
  );
}

/* ═══════ 1. Pain → today → platform ═══════ */

interface PainRow {
  ask: string;
  today: string;
  platform: string;
  platformLink?: { to: string; label: string };
}

const PAIN_ROWS: PainRow[] = [
  {
    ask: '"Show me the SCR exactly as submitted in Q1."',
    today: 'Reconstruction from notebooks, emails, version-controlled spreadsheets. Typically 1–2 days, sometimes longer if a key person has left.',
    platform: 'One-click replay from the audit snapshot — same models, same data, same overlays as what the supervisor received.',
    platformLink: { to: '/archive', label: 'Submissions Archive' },
  },
  {
    ask: '"Why did the SCR move +EUR 46M between quarters?"',
    today: 'A senior actuary builds a variance walk by hand. Lives in a single xlsx; one person knows the assumptions; it never gets re-used.',
    platform: 'Auto-decomposition: sub-module deltas, model-version diffs, approved-overlay impacts — side by side, audit-traceable.',
    platformLink: { to: '/internal-controls', label: 'Internal Controls audit log' },
  },
  {
    ask: '"Who approved the +10% loading on motor — and why?"',
    today: 'Word doc, email thread, or whoever was in the room. Hard to defend on demand; harder to defend a year later.',
    platform: 'Every overlay carries author + approver + hash + rationale + the QRT cells it touches. Two clicks from any number to the justification.',
    platformLink: { to: '/overlays', label: 'Overlays Register' },
  },
  {
    ask: '"What if interest rates drop -50bps next week?"',
    today: 'Engine re-run, scenario rebuild — 2–3 days, freezes the BAU work, by the time it lands the question has changed.',
    platform: 'Continuous ORSA draft + What-If — same gold layer, scenarios re-run in minutes, the Board gets the answer in the meeting.',
    platformLink: { to: '/orsa/draft', label: 'ORSA continuous draft' },
  },
  {
    ask: '"Is the cat number consistent with the reserving model\'s view?"',
    today: 'Periodic reconciliation in xlsx, sometimes a footnote in the SFCR. Inconsistencies surface late — usually at year-end sign-off.',
    platform: 'UC Volume exchange + cross-QRT reconciliation checks run as a hard gate on every Q-close. Inconsistencies surface in the cycle, not at sign-off.',
    platformLink: { to: '/today', label: 'Cross-QRT recon (Control Tower)' },
  },
];

function PainTable() {
  return (
    <div>
      <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
        <ScrollText className="w-4 h-4 text-slate-600" />
        The five recurring asks
      </h4>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-600">
            <tr>
              <th className="text-left px-3 py-2.5 w-[28%]">Common ask</th>
              <th className="text-left px-3 py-2.5 w-[36%]">Today's reality</th>
              <th className="text-left px-3 py-2.5">With this platform</th>
            </tr>
          </thead>
          <tbody>
            {PAIN_ROWS.map((r, i) => (
              <tr key={i} className="border-t border-gray-100 align-top">
                <td className="px-3 py-2.5 text-xs text-slate-800 leading-relaxed italic">{r.ask}</td>
                <td className="px-3 py-2.5 text-xs text-gray-600 leading-relaxed">{r.today}</td>
                <td className="px-3 py-2.5 text-xs text-blue-900 leading-relaxed">
                  {r.platform}
                  {r.platformLink && (
                    <>
                      {' '}
                      <Link to={r.platformLink.to}
                        className="inline-flex items-center gap-0.5 text-blue-700 font-semibold hover:underline whitespace-nowrap">
                        {r.platformLink.label} <ArrowRight className="w-3 h-3" />
                      </Link>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500 italic mt-2">
        These aren't gaps in your team — they're the integration tax that every Solvency II function pays. The platform pays it for you.
      </p>
    </div>
  );
}

/* ═══════ 2. SCR as a function — three uses, one gold layer ═══════ */

function FunctionDiagram() {
  const W = 1100, H = 360;
  const goldY = 270;
  const goldX = 100, goldW = 900, goldH = 60;

  const uses = [
    {
      x: 200, label: 'As-of SCR', when: 'the past',
      blurb: 'Replay 2025-Q1 byte-for-byte for the supervisor — audit snapshot drives the rebuild.',
      stroke: '#7c3aed', fill: '#f5f3ff', icon: History,
    },
    {
      x: 530, label: 'Live SCR', when: 'now',
      blurb: 'SCR as of yesterday\'s market close. Continuous draft, not a quarterly polaroid.',
      stroke: '#0369a1', fill: '#eff6ff', icon: Activity,
    },
    {
      x: 860, label: 'Stress SCR', when: 'the future',
      blurb: 'What would it be at -50bps · what if the cat aggregate moves · what if a model is challenged.',
      stroke: '#b45309', fill: '#fffbeb', icon: Wind,
    },
  ];

  return (
    <div>
      <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 text-indigo-700" />
        The lightbulb — SCR as a function, not a snapshot
      </h4>

      <div className="bg-white border border-gray-200 rounded-xl p-4 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 760, maxHeight: 380 }}>
          <defs>
            <marker id="scrarrow" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
              <path d="M 0 0 L 8 4 L 0 8 z" fill="#64748b" />
            </marker>
          </defs>

          {/* Section caption */}
          <text x={550} y={28} textAnchor="middle" fontWeight={700} fontSize={13} fill="#1e293b">
            Three SCRs from one gold layer.
          </text>
          <text x={550} y={48} textAnchor="middle" fontSize={11} fill="#64748b" fontStyle="italic">
            Most firms ship one — what they sent the supervisor. This makes it three.
          </text>

          {/* Three use-boxes */}
          {uses.map((u) => (
            <UseBox key={u.label} x={u.x} y={75} label={u.label} when={u.when} blurb={u.blurb} stroke={u.stroke} fill={u.fill} />
          ))}

          {/* Arrows down to the gold layer */}
          {uses.map((u) => (
            <line key={u.label + '-line'} x1={u.x} y1={210} x2={u.x} y2={goldY} stroke="#94a3b8" strokeWidth={1.2} markerEnd="url(#scrarrow)" />
          ))}

          {/* Gold layer */}
          <rect x={goldX} y={goldY} width={goldW} height={goldH} rx={10} fill="#fef9c3" stroke="#a16207" strokeWidth={1.5} />
          <text x={goldX + 16} y={goldY + 22} fontWeight={700} fontSize={12} fill="#713f12">
            Gold layer — one source of truth
          </text>
          <text x={goldX + 16} y={goldY + 42} fontSize={10} fill="#854d0e">
            s2501 sub-modules · approved overlays · model versions (champion + challenger) · ORSA stresses · audit log
          </text>

          {/* Storage icon decoration */}
          <g transform={`translate(${goldX + goldW - 40}, ${goldY + 18})`}>
            <rect x={0} y={0} width={20} height={6} rx={2} fill="#a16207" />
            <rect x={0} y={9} width={20} height={6} rx={2} fill="#a16207" opacity={0.7} />
            <rect x={0} y={18} width={20} height={6} rx={2} fill="#a16207" opacity={0.4} />
          </g>
        </svg>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <UseDetail tone="violet" icon={History} label="As-of"
            line1="Audit defence in one click"
            line2="When BaFin asks for Q1 2025: every input, every model version, every overlay frozen at the moment of submission. No reconstruction." />
          <UseDetail tone="blue" icon={Activity} label="Live"
            line1="Continuous solvency, not point-in-time"
            line2="Yesterday's market data + today's exposure = today's SCR. Tell the Board what the position is, not what it was at Dec 31." />
          <UseDetail tone="amber" icon={Wind} label="Stress"
            line1="The answer arrives in the meeting"
            line2="Same gold, scenario overlay, re-run in minutes. The question that used to wait 3 days is answered while you're being asked." />
        </div>
      </div>
    </div>
  );
}

function UseBox({ x, y, label, when, blurb, stroke, fill }: {
  x: number; y: number; label: string; when: string; blurb: string; stroke: string; fill: string;
}) {
  const w = 240, h = 130;
  const left = x - w / 2;
  return (
    <g>
      <rect x={left} y={y} width={w} height={h} rx={12} fill={fill} stroke={stroke} strokeWidth={1.5} />
      <text x={x} y={y + 28} textAnchor="middle" fontWeight={700} fontSize={15} fill={stroke}>{label}</text>
      <text x={x} y={y + 46} textAnchor="middle" fontSize={10} fill={stroke} fontStyle="italic">{when}</text>
      {/* Wrap blurb across two lines */}
      <foreignObject x={left + 14} y={y + 56} width={w - 28} height={h - 60}>
        <div style={{ fontSize: 11, lineHeight: 1.35, color: '#374151' }}>{blurb}</div>
      </foreignObject>
    </g>
  );
}

function UseDetail({ tone, icon: Icon, label, line1, line2 }: {
  tone: 'violet' | 'blue' | 'amber';
  icon: React.ComponentType<{ className?: string }>;
  label: string; line1: string; line2: string;
}) {
  const cls = {
    violet: { border: 'border-violet-200', bg: 'bg-violet-50/40', text: 'text-violet-900', icon: 'text-violet-700' },
    blue:   { border: 'border-blue-200',   bg: 'bg-blue-50/40',   text: 'text-blue-900',   icon: 'text-blue-700' },
    amber:  { border: 'border-amber-200',  bg: 'bg-amber-50/40',  text: 'text-amber-900',  icon: 'text-amber-700' },
  }[tone];
  return (
    <div className={`rounded-lg border ${cls.border} ${cls.bg} p-3`}>
      <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold ${cls.text}`}>
        <Icon className={`w-3.5 h-3.5 ${cls.icon}`} />
        {label}
      </div>
      <div className={`text-sm font-bold mt-1 ${cls.text}`}>{line1}</div>
      <div className="text-[11px] text-gray-700 mt-1 leading-relaxed">{line2}</div>
    </div>
  );
}

/* ═══════ 3. What stays the same ═══════ */

function StaysTheSame() {
  return (
    <div className="bg-white border border-emerald-200 rounded-lg p-4">
      <h4 className="text-sm font-bold text-emerald-900 mb-2 flex items-center gap-1.5">
        <Database className="w-4 h-4 text-emerald-700" />
        What stays exactly where it is
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs leading-relaxed">
        <div>
          <div className="font-semibold text-emerald-900">Your specialist engines</div>
          <p className="text-gray-700 mt-1">
            Igloo, Prophet, AXIS, ResQ — they keep doing the heavy actuarial science on their native runtimes. The platform takes the integration tax (data prep + audit + reconciliation), not the engine.
          </p>
        </div>
        <div>
          <div className="font-semibold text-emerald-900">Your sign-off chain</div>
          <p className="text-gray-700 mt-1">
            Five-role governance — Preparer · Senior Actuary · CRO · Board Risk · CFO. Same scope, same accountability. The platform just makes every signature and refusal an auditable event.
          </p>
        </div>
        <div>
          <div className="font-semibold text-emerald-900">Your judgement</div>
          <p className="text-gray-700 mt-1">
            Overlays, assumption choices, methodology calls — this is where actuarial fees are earned and the platform makes it more visible, not less. Every overlay carries the rationale; the agent reads from it, never replaces it.
          </p>
        </div>
      </div>
    </div>
  );
}
