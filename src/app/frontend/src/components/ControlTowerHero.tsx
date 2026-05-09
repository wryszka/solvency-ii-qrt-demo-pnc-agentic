/**
 * Control Tower hero strip — Scene 1's first impression.
 *
 * Lands the "Monday morning view nobody on my team has" thesis in 10 seconds.
 * Three blocks side-by-side:
 *   1. Period under report + days-to-deadline countdown
 *   2. Aggregate close health traffic light (green/amber/red)
 *   3. Headline KPI strip (feeds / DQ / recon / overlays)
 *
 * Designed to be readable from across a conference room — KPI numbers are 40px+,
 * labels are tight + uppercase. Pillar colour discipline throughout.
 */
import { CheckCircle2, AlertTriangle, AlertCircle, CalendarDays, Activity, ShieldCheck, GitCompare, Layers } from 'lucide-react';

export type HealthLevel = 'green' | 'amber' | 'red';

export interface HeroProps {
  period: string;                           // "2025-Q4"
  submissionDeadline: string;               // "2026-02-22"
  health: HealthLevel;
  feedsReceived: number;
  feedsTotal: number;
  feedsLate: number;
  dqPassRate: number;                       // %
  quarantinedRows: number;
  reconMismatches: number;
  reconTotal: number;
  pendingOverlays: number;
}

function businessDaysBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  let days = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) days++;
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

export default function ControlTowerHero(p: HeroProps) {
  const deadline = new Date(p.submissionDeadline + 'T17:00:00Z');
  const today = new Date();
  const daysLeft = businessDaysBetween(today, deadline);
  const past = deadline < today;

  const healthCfg = {
    green: { label: 'On track', cls: 'bg-emerald-50 border-emerald-200 text-emerald-800', dot: 'bg-emerald-500', Icon: CheckCircle2 },
    amber: { label: 'Attention',  cls: 'bg-amber-50 border-amber-200 text-amber-800',     dot: 'bg-amber-500',   Icon: AlertTriangle },
    red:   { label: 'Blocked',    cls: 'bg-red-50 border-red-200 text-red-800',           dot: 'bg-red-500',     Icon: AlertCircle },
  }[p.health];
  const HealthIcon = healthCfg.Icon;

  return (
    <header className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl overflow-hidden shadow-lg">
      <div className="grid grid-cols-12 gap-0">
        {/* Block 1 — Period + Deadline */}
        <div className="col-span-12 md:col-span-4 p-5 border-b md:border-b-0 md:border-r border-white/10">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-semibold text-slate-400">
            <CalendarDays className="w-3.5 h-3.5" />
            Quarter under report
          </div>
          <div className="mt-2 text-5xl font-bold tracking-tight tabular-nums">{p.period}</div>
          <div className="mt-3 text-xs text-slate-400 leading-relaxed">
            Submission deadline <span className="font-semibold text-slate-200">{p.submissionDeadline}</span>
            <span className="mx-1.5 text-slate-600">·</span>
            {past
              ? <span className="text-slate-300">submitted</span>
              : <span className="text-slate-200 font-semibold tabular-nums">{daysLeft} business days remaining</span>
            }
          </div>
        </div>

        {/* Block 2 — Aggregate Health Traffic Light */}
        <div className="col-span-12 md:col-span-3 p-5 border-b md:border-b-0 md:border-r border-white/10">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-semibold text-slate-400">
            <HealthIcon className="w-3.5 h-3.5" />
            Aggregate close health
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="relative">
              <div className={`w-12 h-12 rounded-full ${healthCfg.dot} shadow-lg shadow-${healthCfg.dot}/30`} />
              <div className={`absolute inset-0 w-12 h-12 rounded-full ${healthCfg.dot} animate-ping opacity-30`} />
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight">{healthCfg.label}</div>
              <div className="text-xs text-slate-400">Feeds · models · recon · overlays</div>
            </div>
          </div>
        </div>

        {/* Block 3 — Headline KPIs */}
        <div className="col-span-12 md:col-span-5 p-5 grid grid-cols-4 gap-2">
          <HeroKpi label="Feeds"       icon={Activity}     value={`${p.feedsReceived}/${p.feedsTotal}`} severity={p.feedsLate > 0 ? 'amber' : 'green'} />
          <HeroKpi label="DQ Pass"     icon={ShieldCheck}  value={`${p.dqPassRate.toFixed(1)}%`}       severity={p.quarantinedRows > 0 ? 'amber' : 'green'} />
          <HeroKpi label="Recon"       icon={GitCompare}   value={`${p.reconTotal - p.reconMismatches}/${p.reconTotal}`} severity={p.reconMismatches > 0 ? 'amber' : 'green'} />
          <HeroKpi label="Overlays"    icon={Layers}       value={String(p.pendingOverlays)}            severity={p.pendingOverlays > 0 ? 'amber' : 'green'} sublabel="pending" />
        </div>
      </div>
    </header>
  );
}

function HeroKpi({ label, icon: Icon, value, severity, sublabel }: {
  label: string; icon: React.ComponentType<{ className?: string }>;
  value: string; severity: 'green' | 'amber' | 'red'; sublabel?: string;
}) {
  const accent = {
    green: 'text-emerald-300',
    amber: 'text-amber-300',
    red:   'text-red-300',
  }[severity];
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 flex flex-col">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className={`text-3xl font-bold tracking-tight tabular-nums leading-tight ${accent}`}>{value}</div>
      {sublabel && <div className="text-[10px] text-slate-500 uppercase tracking-wide">{sublabel}</div>}
    </div>
  );
}
