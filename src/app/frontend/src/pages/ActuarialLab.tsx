/**
 * Actuarial Lab — peer-row table of all models.
 *
 * Native MLflow models (reserving_pnc, reserving_life, standard_formula) and
 * external engines (Igloo, Prophet) appear as peers. Same row treatment, same
 * action set, only the engine tag distinguishes them.
 *
 * The symmetry is deliberate: whether a model lives in UC or runs in Igloo,
 * the governance interface is identical.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Beaker, Loader2, AlertTriangle, CheckCircle2, Clock,
  Code2, Cpu, ChevronRight, BookOpen,
} from 'lucide-react';
import PillarChip from '../components/PillarChip';
import { fetchLabModels, fetchGovernanceSummary, type LabModelRow } from '../lib/api';

function engineBadge(engine: string, tag: 'native' | 'external') {
  const cls = tag === 'native'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : 'bg-purple-50 text-purple-700 border-purple-200';
  const Icon = tag === 'native' ? Code2 : Cpu;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border ${cls}`}>
      <Icon className="w-3 h-3" /> {engine}
    </span>
  );
}

function statusPill(status: string | null | undefined) {
  if (!status) return <span className="text-xs text-gray-400">—</span>;
  const cls = status === 'approved' ? 'bg-green-100 text-green-700'
    : status === 'pending' ? 'bg-amber-100 text-amber-800'
    : 'bg-gray-100 text-gray-600';
  return <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold ${cls}`}>{status}</span>;
}

export default function ActuarialLab() {
  const [rows, setRows] = useState<LabModelRow[]>([]);
  const [summary, setSummary] = useState<{ pending_promotions: number; approved_promotions: number; models_with_failed_diagnostics: { model_name: string; n: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchLabModels(), fetchGovernanceSummary('2025-Q4')])
      .then(([m, s]) => { setRows(m.models); setSummary(s); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-5">
      <div className="flex items-start gap-3">
        <Beaker className="w-6 h-6 text-violet-700 mt-0.5" />
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            Actuarial Lab
            <PillarChip pillar="cross" size="md" />
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            All actuarial models — peer rows. Whether the model lives in Unity Catalog or
            runs in an external engine, the governance interface is identical:
            versions, aliases, diagnostics, lineage, promotion.
          </p>
        </div>
      </div>

      <div className="bg-violet-50 border border-violet-200 rounded-lg px-4 py-3 flex items-center gap-3 text-sm">
        <BookOpen className="w-4 h-4 text-violet-700 shrink-0" />
        <span className="text-violet-900">
          <strong>Worked examples</strong> for chain-ladder, BF, SF walkthrough and ORSA
          stress templates live in <code className="bg-white border border-violet-200 px-1 rounded text-xs">src/examples/</code>.
          Run them as-is or adapt to your validated methodology.
        </span>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard
            label="Production models" value={rows.filter((r) => r.production_version).length}
            sub="active in close" icon={CheckCircle2} colour="green"
          />
          <SummaryCard
            label="Pending promotions" value={summary.pending_promotions}
            sub="awaiting approval" icon={Clock} colour="amber"
          />
          <SummaryCard
            label="Diagnostics flagged" value={summary.models_with_failed_diagnostics.length}
            sub="models with failed checks" icon={AlertTriangle}
            colour={summary.models_with_failed_diagnostics.length > 0 ? 'red' : 'gray'}
          />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> loading models…
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-[11px] uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2">Model</th>
                <th className="text-left px-3 py-2">Engine</th>
                <th className="text-left px-3 py-2">Production</th>
                <th className="text-left px-3 py-2">Candidate</th>
                <th className="text-left px-3 py-2">Last promotion</th>
                <th className="text-left px-3 py-2">Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.model_id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <Link to={`/lab/${r.model_id}`} className="font-semibold text-gray-900 hover:text-violet-700">
                      {r.label}
                    </Link>
                    <div className="text-[11px] text-gray-500 font-mono">{r.model_id}</div>
                  </td>
                  <td className="px-3 py-2.5">{engineBadge(r.engine, r.engine_tag)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {r.production_version ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs">
                    {r.candidate_version ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">
                    {r.last_promotion_quarter ?? '—'}
                    {r.last_promotion_approver && (
                      <div className="text-[11px] text-gray-500 truncate max-w-[160px]" title={r.last_promotion_approver}>
                        by {r.last_promotion_approver}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col items-start gap-1">
                      {statusPill(r.last_promotion_status)}
                      {(r.pending_promotions ?? 0) > 0 && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                          {r.pending_promotions} pending
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Link to={`/lab/${r.model_id}`}
                      className="inline-flex items-center gap-1 text-xs text-violet-700 hover:text-violet-900">
                      Detail <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, icon: Icon, colour }: {
  label: string; value: number; sub: string; icon: React.ComponentType<{ className?: string }>;
  colour: 'green' | 'amber' | 'red' | 'gray';
}) {
  const cls = {
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red:   'bg-red-50 border-red-200 text-red-700',
    gray:  'bg-gray-50 border-gray-200 text-gray-700',
  }[colour];
  return (
    <div className={`border rounded-lg p-3 ${cls}`}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 opacity-70" />
        <span className="text-[11px] uppercase tracking-wide font-semibold">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-70 mt-0.5">{sub}</div>
    </div>
  );
}
