/**
 * Senior Reserving Actuary panel — Scene 2 of the forum talk.
 *
 * The agent surfaces anomalies in Q4 reserving vs Q3 and proposes overlays.
 * The actuary reviews and approves via the Overlays Register UI; the agent
 * cannot create overlays itself. "This decision is yours" is the line that
 * lands the architecture.
 *
 * Polish:
 *  - Output streams in token-by-token (pseudo-stream via useStreamedText)
 *  - Suggested overlays render as distinct cards (vs already-confirmed)
 *  - "Create overlay" opens the new-overlay form via deep link, prefilled
 *  - Proposal cards visually paired with the anomaly section above them
 */
import { useEffect, useState } from 'react';
import {
  Sparkles, Loader2, AlertTriangle, RefreshCw, Plus,
  TrendingUp, TrendingDown, ArrowRight, CheckCircle2, Clock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { renderMarkdownSafe } from '../lib/markdown';
import { useStreamedText } from '../lib/hooks/useStreamedText';
import CreateOverlayModal from './CreateOverlayModal';
import { fetchOverlays, approveOverlay, formatEur, type Overlay, type OverlayCreate } from '../lib/api';

interface OverlayProposal {
  model_name: string;
  quarter: string;
  line_of_business: string;
  magnitude_eur: number;
  direction: 'increase' | 'decrease';
  category: string;
  rationale: string;
  accident_year?: number;
}

interface ReviewResponse {
  review: string;
  model_used: string;
  proposals: OverlayProposal[];
}

export default function SeniorReservingPanel({ modelId }: { modelId?: string }) {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRunOnce, setHasRunOnce] = useState(false);
  const [modalSeed, setModalSeed] = useState<Partial<OverlayCreate> | null>(null);
  const [recentOverlays, setRecentOverlays] = useState<Overlay[]>([]);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  const { text: streamedReview, done: streamDone } = useStreamedText(data?.review, {
    charsPerTick: 5, tickMs: 16,
  });

  async function refreshRecent() {
    try {
      const res = await fetchOverlays({
        quarter: '2025-Q4',
        ...(modelId ? { model_name: modelId } : {}),
      });
      setRecentOverlays(res.overlays.slice(0, 5));
    } catch { /* non-fatal */ }
  }

  useEffect(() => { refreshRecent(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [modelId]);

  async function load() {
    setLoading(true); setError(null); setData(null);
    try {
      const res = await fetch('/api/agents/reserving/review');
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      setData(json);
      setHasRunOnce(true);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  function openModalFromProposal(p: OverlayProposal) {
    setModalSeed({
      model_name: p.model_name,
      quarter: p.quarter,
      line_of_business: p.line_of_business,
      accident_year: p.accident_year,
      magnitude_eur: Math.abs(p.magnitude_eur),
      direction: p.direction,
      category: p.category,
      rationale: p.rationale,
      linked_qrt_cells: [],
    });
  }

  async function handleCreated(overlayId: string) {
    setModalSeed(null);
    setJustCreated(overlayId);
    await refreshRecent();
    window.setTimeout(() => setJustCreated(null), 6000);
  }

  async function handleApprove(overlayId: string) {
    try {
      await approveOverlay(overlayId);
      await refreshRecent();
    } catch (e) { setError(String(e)); }
  }

  return (
    <section className="bg-white border-2 border-violet-200 rounded-xl p-5 space-y-4 shadow-sm">
      <header className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-violet-700" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-gray-900 leading-tight">Senior Reserving Actuary</h4>
          <p className="text-[11px] text-gray-500">AI agent · proposes, actuary decides · cannot create overlays</p>
        </div>
        <button onClick={load} disabled={loading}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            data
              ? 'border border-violet-300 text-violet-700 hover:bg-violet-50'
              : 'bg-violet-700 text-white hover:bg-violet-800'
          } disabled:opacity-50`}>
          {loading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : data ? <RefreshCw className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? 'Reviewing…' : data ? 'Re-run review' : 'Run reserving review'}
        </button>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {!hasRunOnce && !loading && !error && (
        <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 text-sm text-violet-900 leading-relaxed">
          The agent reads the production reserving output for the current quarter, compares it
          to the prior quarter's production version, surfaces material movements and proposes
          overlays for human consideration. <strong>It cannot create overlays</strong> — only
          the actuary can. Click <em>Run reserving review</em> to see the analysis.
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          <ProgressLine label="Loading Q4 production reserves" delay={0} />
          <ProgressLine label="Comparing against Q3 production version" delay={300} />
          <ProgressLine label="Detecting material movements" delay={700} />
          <ProgressLine label="Drafting overlay proposals" delay={1200} />
        </div>
      )}

      {data && (
        <>
          <div className="prose prose-sm max-w-none text-sm leading-relaxed text-gray-800
                          bg-gradient-to-br from-violet-50/60 to-white border border-violet-100 rounded-lg p-4
                          relative">
            <div dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(streamedReview) }} />
            {!streamDone && (
              <span className="inline-block w-2 h-4 bg-violet-700 align-middle ml-0.5 animate-pulse" />
            )}
          </div>

          {data.proposals.length > 0 && streamDone && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <h5 className="text-xs uppercase tracking-wider font-bold text-violet-800">
                  Proposed overlays · {data.proposals.length}
                </h5>
                <span className="text-[10px] text-gray-500">— actuary creates, edits, approves</span>
              </div>
              {data.proposals.map((p, i) => (
                <ProposalCard key={i} proposal={p} onCreate={() => openModalFromProposal(p)} />
              ))}
            </div>
          )}

          {streamDone && (
            <div className="text-[10px] text-gray-400 italic flex items-center gap-1.5">
              <Sparkles className="w-2.5 h-2.5" />
              Generated by {data.model_used}. Review carefully before acting on suggestions.
            </div>
          )}
        </>
      )}

      {/* Recent overlays — visible side-panel showing the actuary's decisions land in the system */}
      {recentOverlays.length > 0 && (
        <div className="border-t border-gray-200 pt-4 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <h5 className="text-xs uppercase tracking-wider font-bold text-gray-600">
              Recent overlays · current quarter
            </h5>
            <Link to="/overlays" className="ml-auto text-[11px] text-violet-700 hover:text-violet-900 font-semibold">
              Open Register →
            </Link>
          </div>
          <ul className="space-y-1.5">
            {recentOverlays.map((o) => {
              const flashJustCreated = o.overlay_id === justCreated;
              const mag = parseFloat(String(o.magnitude_eur));
              return (
                <li key={o.overlay_id}
                  className={`flex items-center gap-2 text-xs px-2.5 py-2 rounded border transition-all ${
                    flashJustCreated ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200' :
                    o.status === 'approved' ? 'bg-white border-gray-200' :
                    'bg-amber-50/40 border-amber-200'
                  }`}>
                  {o.status === 'approved'
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    : <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />}
                  <span className="font-semibold text-gray-800">{o.line_of_business}</span>
                  <span className="text-gray-500 truncate">{o.category.replace(/_/g, ' ')}</span>
                  <span className={`ml-auto font-mono font-semibold ${mag >= 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {mag >= 0 ? '+' : ''}{formatEur(o.magnitude_eur)}
                  </span>
                  {o.status === 'pending_approval' && (
                    <button onClick={() => handleApprove(o.overlay_id)}
                      className="text-[10px] uppercase tracking-wide font-bold text-emerald-700 hover:text-emerald-900 ml-1">
                      approve
                    </button>
                  )}
                  {flashJustCreated && (
                    <span className="text-[10px] uppercase tracking-wide font-bold text-emerald-700">just created</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {modalSeed && (
        <CreateOverlayModal
          initial={modalSeed}
          fromAgentSuggestion
          onClose={() => setModalSeed(null)}
          onCreated={handleCreated}
        />
      )}
    </section>
  );
}

function ProgressLine({ label, delay }: { label: string; delay: number }) {
  const [stage, setStage] = useState<'pending' | 'active' | 'done'>('pending');
  useEffect(() => {
    const a = window.setTimeout(() => setStage('active'), delay);
    const b = window.setTimeout(() => setStage('done'), delay + 800);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  }, [delay]);
  return (
    <div className="flex items-center gap-2 text-xs">
      {stage === 'pending' && <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200" />}
      {stage === 'active' && <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-700" />}
      {stage === 'done' && (
        <div className="w-3.5 h-3.5 rounded-full bg-violet-700 flex items-center justify-center">
          <svg className="w-2 h-2 text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
      <span className={stage === 'pending' ? 'text-gray-400' : stage === 'active' ? 'text-violet-700 font-medium' : 'text-gray-700'}>
        {label}
      </span>
    </div>
  );
}

function ProposalCard({ proposal: p, onCreate }: { proposal: OverlayProposal; onCreate: () => void }) {
  const positive = p.magnitude_eur >= 0;
  return (
    <div className="border-2 border-violet-200 rounded-lg p-3.5 bg-white hover:bg-violet-50/40 transition-colors flex items-start gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
        positive ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
      }`}>
        {positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="font-semibold text-gray-900 text-sm">{p.line_of_business}</span>
          <span className="text-[10px] uppercase tracking-wide font-semibold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">
            {p.category.replace(/_/g, ' ')}
          </span>
          <span className={`ml-auto font-mono text-sm font-bold ${positive ? 'text-rose-700' : 'text-emerald-700'}`}>
            {positive ? '+' : ''}{Number(p.magnitude_eur).toLocaleString()} EUR
          </span>
        </div>
        <p className="text-xs text-gray-700 leading-relaxed mb-2">{p.rationale}</p>
        <button onClick={onCreate}
          className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900">
          <Plus className="w-3 h-3" /> Create overlay from this suggestion <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
