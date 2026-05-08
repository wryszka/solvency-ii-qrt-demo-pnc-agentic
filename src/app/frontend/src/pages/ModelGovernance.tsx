/**
 * Model Governance — Pillar 2 page.
 *
 * Champion vs Challenger SCR side-by-side, registered model versions
 * with aliases, the audit trail of every model run with input/output
 * hashes, and a persistable approval-decision stub.
 */
import { useEffect, useState } from 'react';
import { Scale, Loader2, AlertTriangle, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import PillarChip from '../components/PillarChip';
import {
  fetchModelRegistry, fetchModelComparison, fetchModelRuns, fetchModelApprovals,
  recordModelApproval,
  type ModelComparisonRow,
} from '../lib/api';

export default function ModelGovernance() {
  const [registry, setRegistry] = useState<unknown[]>([]);
  const [comparison, setComparison] = useState<ModelComparisonRow[]>([]);
  const [runs, setRuns] = useState<unknown[]>([]);
  const [approvals, setApprovals] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<{ name: string; version: string } | null>(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [recording, setRecording] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [r, c, ru, a] = await Promise.all([
        fetchModelRegistry(),
        fetchModelComparison().catch((e) => ({ comparison: [], error: String(e) } as { comparison: ModelComparisonRow[]; error?: string })),
        fetchModelRuns(),
        fetchModelApprovals(),
      ]);
      setRegistry(r.models);
      setComparison((c as { comparison: ModelComparisonRow[] }).comparison ?? []);
      setRuns(ru.runs);
      setApprovals(a.approvals);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, []);

  async function decide(decision: 'approved' | 'rejected') {
    if (!decisionTarget) return;
    setRecording(true);
    try {
      await recordModelApproval(decisionTarget.name, decisionTarget.version, decision, decisionComment);
      setDecisionTarget(null);
      setDecisionComment('');
      loadAll();
    } finally { setRecording(false); }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Scale className="w-6 h-6 text-green-700" />
          Model Governance
          <PillarChip pillar={2} size="md" />
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Registered models, Champion vs Challenger comparison, run history with input/output hashes,
          and approval decisions.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> loading model state…
        </div>
      ) : (
        <>
          {/* Champion vs Challenger comparison */}
          <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-200 bg-green-50/40">
              <h3 className="text-sm font-bold text-green-900">Champion vs Challenger SCR</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Both models run against the latest risk factors. The Challenger encodes the 2026 calibration
                (NL UW correlation +1.5%, op risk → 4%, life lapse stress ×1.15) and lands ~+4% above Champion.
              </p>
            </header>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
                  <tr>
                    <Th>Component</Th>
                    <Th align="right">Champion</Th>
                    <Th align="right">Challenger</Th>
                    <Th align="right">Δ</Th>
                    <Th align="right">Δ %</Th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400 text-xs">no comparison data</td></tr>
                  )}
                  {comparison.map((r) => (
                    <tr key={r.component} className="border-b border-gray-100">
                      <td className="px-3 py-2 font-mono text-xs">{r.component}</td>
                      <td className="px-3 py-2 text-right">EUR {(r.champion_eur/1e6).toFixed(2)}M</td>
                      <td className="px-3 py-2 text-right">EUR {(r.challenger_eur/1e6).toFixed(2)}M</td>
                      <td className={`px-3 py-2 text-right ${r.delta_eur > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {r.delta_eur > 0 ? '+' : ''}EUR {(r.delta_eur/1e6).toFixed(2)}M
                      </td>
                      <td className={`px-3 py-2 text-right ${Math.abs(r.delta_pct) < 1 ? 'text-gray-500' : r.delta_pct > 0 ? 'text-amber-700 font-medium' : 'text-emerald-700 font-medium'}`}>
                        {r.delta_pct > 0 ? '+' : ''}{r.delta_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Registry */}
          <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-200 bg-green-50/40">
              <h3 className="text-sm font-bold text-green-900">Registered models</h3>
            </header>
            <div className="p-4 space-y-3">
              {(registry as { full_name?: string; aliases?: { alias_name: string; version_num: number }[]; versions?: { version: string; status?: string; created_at?: string; created_by?: string }[]; error?: string }[]).map((m, idx) => (
                <div key={idx} className="border border-gray-200 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-xs font-mono text-gray-700">{m.full_name}</code>
                    {(m.aliases ?? []).map((a, i) => (
                      <span key={i} className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border ${
                        a.alias_name.toLowerCase() === 'champion'
                          ? 'border-green-300 bg-green-50 text-green-700'
                          : 'border-amber-300 bg-amber-50 text-amber-700'
                      }`}>
                        {a.alias_name} → v{a.version_num}
                      </span>
                    ))}
                    {m.error && <span className="text-[10px] text-red-600">{m.error}</span>}
                  </div>
                  <table className="min-w-full text-xs">
                    <thead className="text-gray-500">
                      <tr><Th>Version</Th><Th>Status</Th><Th>Created</Th><Th>By</Th><Th>Decision</Th></tr>
                    </thead>
                    <tbody>
                      {(m.versions ?? []).map((v) => (
                        <tr key={v.version} className="border-t border-gray-100">
                          <td className="px-3 py-1.5 font-mono">v{v.version}</td>
                          <td className="px-3 py-1.5 text-gray-500">{v.status ?? '—'}</td>
                          <td className="px-3 py-1.5 text-gray-500">{v.created_at?.split('T')[0] ?? '—'}</td>
                          <td className="px-3 py-1.5 text-gray-500">{v.created_by ?? '—'}</td>
                          <td className="px-3 py-1.5">
                            <button
                              onClick={() => setDecisionTarget({ name: m.full_name ?? '', version: v.version })}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
                            >
                              Record decision <ArrowRight className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </section>

          {/* Decision modal */}
          {decisionTarget && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDecisionTarget(null)}>
              <div className="bg-white rounded-lg p-5 w-[480px] max-w-full" onClick={(e) => e.stopPropagation()}>
                <h4 className="text-sm font-bold text-gray-800 mb-2">Record approval decision</h4>
                <p className="text-xs text-gray-500 mb-3">
                  <span className="font-mono">{decisionTarget.name}</span> · v{decisionTarget.version}
                </p>
                <textarea
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  placeholder="Comments (rationale, conditions, follow-up)…"
                  className="w-full h-24 border border-gray-200 rounded-md px-3 py-2 text-sm"
                />
                <p className="text-[10px] text-gray-500 mt-2 italic">
                  Decision is recorded only — production alias (@Champion) is not flipped.
                </p>
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => setDecisionTarget(null)}
                    className="px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 rounded">Cancel</button>
                  <button onClick={() => decide('rejected')} disabled={recording}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50 disabled:opacity-50">
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button onClick={() => decide('approved')} disabled={recording}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-700 text-white rounded hover:bg-green-800 disabled:opacity-50">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Run history */}
          <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-200 bg-green-50/40">
              <h3 className="text-sm font-bold text-green-900">Run audit trail</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Each model run captures input + output hashes for forensic comparison. Hashing was
                added in Phase 1.0 going forward; older runs do not have hashes.
              </p>
            </header>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <tr><Th>Run</Th><Th>Model</Th><Th>Period</Th><Th>Input hash</Th><Th>Output hash</Th><Th>By</Th></tr>
                </thead>
                <tbody>
                  {runs.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-400">No runs recorded yet.</td></tr>
                  )}
                  {(runs as { run_id?: string; model_name?: string; model_version?: string; input_period?: string; input_hash?: string; output_hash?: string; ran_by?: string }[]).map((r, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-3 py-1.5 font-mono">{(r.run_id ?? '').slice(0, 8)}</td>
                      <td className="px-3 py-1.5">{r.model_name} v{r.model_version}</td>
                      <td className="px-3 py-1.5">{r.input_period ?? '—'}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-500">{(r.input_hash ?? '—').slice(0, 12)}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-500">{(r.output_hash ?? '—').slice(0, 12)}</td>
                      <td className="px-3 py-1.5 text-gray-500">{r.ran_by ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Approvals */}
          <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <header className="px-4 py-3 border-b border-gray-200 bg-green-50/40">
              <h3 className="text-sm font-bold text-green-900">Approval decisions</h3>
            </header>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
                  <tr><Th>When</Th><Th>Decided by</Th><Th>Model</Th><Th>Decision</Th><Th>Comments</Th></tr>
                </thead>
                <tbody>
                  {approvals.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400">No decisions recorded.</td></tr>
                  )}
                  {(approvals as { decided_at?: string; decided_by?: string; model_name?: string; model_version?: string; decision?: string; comments?: string }[]).map((a, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-3 py-1.5">{a.decided_at?.replace('T', ' ').split('.')[0] ?? '—'}</td>
                      <td className="px-3 py-1.5">{a.decided_by ?? '—'}</td>
                      <td className="px-3 py-1.5 font-mono">{a.model_name} v{a.model_version}</td>
                      <td className={`px-3 py-1.5 font-semibold ${a.decision === 'approved' ? 'text-green-700' : 'text-red-700'}`}>
                        {a.decision}
                      </td>
                      <td className="px-3 py-1.5 text-gray-600 max-w-[320px] truncate" title={a.comments}>{a.comments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`px-3 py-2 text-${align ?? 'left'} text-xs font-semibold whitespace-nowrap`}>{children}</th>;
}
