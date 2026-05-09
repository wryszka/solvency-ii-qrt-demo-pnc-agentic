/**
 * Control Tower hero strip.
 *
 * Three blocks: period under report (current in-progress quarter, derived from
 * /api/demo/period-state — never says "submitted"), aggregate close health
 * traffic light, and three meaningful KPI tiles (days to deadline, pending
 * approvals, active overlays). Conference-room legible — KPI numbers 30px+
 * tabular, pillar colour discipline throughout.
 */
import { CheckCircle2, AlertTriangle, AlertCircle, CalendarDays, Clock, Layers, UserCheck } from 'lucide-react';

export type HealthLevel = 'green' | 'amber' | 'red';

export interface HeroProps {
  period: string;                           // "2026-Q2"
  deadline: string;                         // "2026-08-04"
  businessDaysToDeadline: number;
  health: HealthLevel;
  pendingApprovals: number;
  activeOverlays: number;
}

export default function ControlTowerHero(p: HeroProps) {
  const healthCfg = {
    green: { label: 'On track', cls: 'bg-emerald-50 border-emerald-200 text-emerald-800', dot: 'bg-emerald-500', Icon: CheckCircle2 },
    amber: { label: 'Attention', cls: 'bg-amber-50 border-amber-200 text-amber-800',     dot: 'bg-amber-500',   Icon: AlertTriangle },
    red:   { label: 'Blocked',   cls: 'bg-red-50 border-red-200 text-red-800',           dot: 'bg-red-500',     Icon: AlertCircle },
  }[p.health];
  const HealthIcon = healthCfg.Icon;

  return (
    <header className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl overflow-hidden shadow-lg">
      <div className="grid grid-cols-12 gap-0">
        {/* Block 1 — Period */}
        <div className="col-span-12 md:col-span-4 p-5 border-b md:border-b-0 md:border-r border-white/10">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-semibold text-slate-400">
            <CalendarDays className="w-3.5 h-3.5" />
            Quarter under report
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-5xl font-bold tracking-tight tabular-nums">{p.period}</span>
            <span className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/30">
              in progress
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-400 leading-relaxed">
            Submission deadline <span className="font-semibold text-slate-200">{p.deadline}</span>
            <span className="mx-1.5 text-slate-600">·</span>
            <span className="text-slate-200 font-semibold tabular-nums">{p.businessDaysToDeadline} business days remaining</span>
          </div>
        </div>

        {/* Block 2 — Health */}
        <div className="col-span-12 md:col-span-3 p-5 border-b md:border-b-0 md:border-r border-white/10">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-semibold text-slate-400">
            <HealthIcon className="w-3.5 h-3.5" />
            Aggregate close health
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="relative">
              <div className={`w-12 h-12 rounded-full ${healthCfg.dot} shadow-lg`} />
              <div className={`absolute inset-0 w-12 h-12 rounded-full ${healthCfg.dot} animate-ping opacity-30`} />
            </div>
            <div>
              <div className="text-3xl font-bold tracking-tight">{healthCfg.label}</div>
              <div className="text-xs text-slate-400">Feeds · models · recon · overlays</div>
            </div>
          </div>
        </div>

        {/* Block 3 — KPIs (the three meaningful ones) */}
        <div className="col-span-12 md:col-span-5 p-5 grid grid-cols-3 gap-2">
          <HeroKpi label="Days to deadline" icon={Clock}    value={String(p.businessDaysToDeadline)} sublabel="business days" severity={p.businessDaysToDeadline < 5 ? 'red' : p.businessDaysToDeadline < 15 ? 'amber' : 'green'} />
          <HeroKpi label="Pending approvals" icon={UserCheck} value={String(p.pendingApprovals)} sublabel={p.pendingApprovals === 1 ? 'item' : 'items'} severity={p.pendingApprovals === 0 ? 'green' : 'amber'} />
          <HeroKpi label="Active overlays"   icon={Layers}    value={String(p.activeOverlays)}    sublabel="this quarter" severity={p.activeOverlays > 0 ? 'amber' : 'green'} />
        </div>
      </div>
    </header>
  );
}

function HeroKpi({ label, icon: Icon, value, sublabel, severity }: {
  label: string; icon: React.ComponentType<{ className?: string }>;
  value: string; sublabel?: string; severity: 'green' | 'amber' | 'red';
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
