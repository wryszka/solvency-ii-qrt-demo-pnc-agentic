/**
 * PipelinePanel — six-stage horizontal flow for the reporting pipeline.
 *
 * Each stage is a node: status icon + one-line state. Curved connector arrows
 * between nodes. Click any node to drill into the relevant section.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database, BarChart3, Shield, Wind, Archive as ArchiveIcon, FileText,
  CheckCircle2, AlertTriangle, AlertCircle, Loader2,
} from 'lucide-react';
import {
  fetchSlaStatus, fetchLabModels, fetchSfChallenger, fetchOverlays,
  type Row, type LabModelRow, type DemoSfChallenger,
} from '../lib/api';

type Status = 'ok' | 'warn' | 'error' | 'pending';

interface Stage {
  id: string;
  label: string;
  state: string;
  status: Status;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
}

export default function PipelinePanel() {
  const [feeds, setFeeds] = useState<Row[]>([]);
  const [models, setModels] = useState<LabModelRow[]>([]);
  const [challenger, setChallenger] = useState<DemoSfChallenger | null>(null);
  const [pendingOverlays, setPendingOverlays] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      fetchSlaStatus().then((r) => r.data).catch(() => []),
      fetchLabModels().then((r) => r.models).catch(() => []),
      fetchSfChallenger().then((r) => r.challenger).catch(() => null),
      fetchOverlays({ status: 'pending_approval' }).then((r) => r.overlays.length).catch(() => 0),
    ]).then(([f, m, c, p]) => {
      setFeeds(f); setModels(m); setChallenger(c); setPendingOverlays(p);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-xs text-gray-500"><Loader2 className="w-3 h-3 inline animate-spin" /> loading pipeline state…</div>;
  }

  const lateFeedCount = feeds.filter((f) => f.status === 'late' || f.status === 'received_late').length;
  const reservingPending = models.find((m) => m.model_id.startsWith('reserving_') && (m.pending_promotions ?? 0) > 0);
  const sfPending = challenger?.current_state === 'pending_approval';

  const stages: Stage[] = [
    {
      id: 'data', label: 'Data ingestion',
      state: lateFeedCount > 0 ? `${lateFeedCount} feed late` : 'all feeds on time',
      status: lateFeedCount > 0 ? 'warn' : 'ok',
      icon: Database, to: '/ingestion',
    },
    {
      id: 'reserving', label: 'Reserving',
      state: reservingPending ? `${reservingPending.label} pending` : 'production · live',
      status: reservingPending ? 'warn' : 'ok',
      icon: BarChart3, to: '/lab/reserving_pnc',
    },
    {
      id: 'capital', label: 'Capital',
      state: sfPending ? 'SF Challenger pending' : 'standard formula on production',
      status: sfPending ? 'warn' : 'ok',
      icon: Shield, to: '/lab/standard_formula',
    },
    {
      id: 'stochastic', label: 'Stochastic',
      state: 'awaiting actuarial review',
      status: 'warn',
      icon: Wind, to: '/lab/igloo_cat',
    },
    {
      id: 'qrts', label: 'QRTs',
      state: (lateFeedCount > 0 || sfPending || pendingOverlays > 0) ? 'blocked upstream' : 'ready',
      status: (lateFeedCount > 0 ? 'error' : (sfPending || pendingOverlays > 0) ? 'warn' : 'ok'),
      icon: ArchiveIcon, to: '/reporting-cycle',
    },
    {
      id: 'disclosure', label: 'Disclosure',
      state: 'not started',
      status: 'pending',
      icon: FileText, to: '/sfcr',
    },
  ];

  return (
    <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <header className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-3">
        <h3 className="text-sm font-bold text-gray-800">Reporting pipeline — current period</h3>
        <span className="ml-auto text-[11px] text-gray-500">click a stage to drill in</span>
      </header>
      <div className="p-4 overflow-x-auto">
        <div className="flex items-stretch gap-1 min-w-max">
          {stages.map((s, i) => (
            <div key={s.id} className="flex items-stretch gap-1">
              <StageNode stage={s} onClick={() => navigate(s.to)} />
              {i < stages.length - 1 && <Arrow status={s.status} />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StageNode({ stage, onClick }: { stage: Stage; onClick: () => void }) {
  const palette = STATUS_PALETTE[stage.status];
  const Icon = stage.icon;
  const StatusIcon = palette.Icon;
  return (
    <button onClick={onClick}
      className={`text-left rounded-lg border-2 px-3 py-2.5 transition-colors min-w-[148px] ${palette.cls} hover:brightness-105`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`w-4 h-4 ${palette.iconCls}`} />
        <span className="text-[11px] uppercase tracking-wider font-bold text-gray-700">{stage.label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <StatusIcon className={`w-3.5 h-3.5 ${palette.statusCls}`} />
        <span className="text-xs text-gray-800 leading-tight">{stage.state}</span>
      </div>
    </button>
  );
}

function Arrow({ status }: { status: Status }) {
  const palette = STATUS_PALETTE[status];
  return (
    <div className="self-center">
      <svg width="22" height="20" viewBox="0 0 22 20" className={palette.arrowCls}>
        <path d="M 0 10 C 8 10, 12 10, 18 10 M 14 5 L 19 10 L 14 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

const STATUS_PALETTE: Record<Status, {
  cls: string; iconCls: string; statusCls: string; arrowCls: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  ok:      { cls: 'bg-emerald-50 border-emerald-200',  iconCls: 'text-emerald-700', statusCls: 'text-emerald-700', arrowCls: 'text-emerald-400', Icon: CheckCircle2 },
  warn:    { cls: 'bg-amber-50 border-amber-200',      iconCls: 'text-amber-700',   statusCls: 'text-amber-700',   arrowCls: 'text-amber-400',   Icon: AlertTriangle },
  error:   { cls: 'bg-red-50 border-red-200',          iconCls: 'text-red-700',     statusCls: 'text-red-700',     arrowCls: 'text-red-400',     Icon: AlertCircle },
  pending: { cls: 'bg-slate-50 border-slate-200',      iconCls: 'text-slate-600',   statusCls: 'text-slate-500',   arrowCls: 'text-slate-300',   Icon: () => <span className="text-slate-400 text-xs">·</span> },
};
