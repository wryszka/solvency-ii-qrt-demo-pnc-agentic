import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Clock, Activity, ShieldCheck, ArrowRight, Bot, Sparkles, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { fetchSlaStatus, fetchDqSummary, fetchReconciliation, generateCrossQrtReview, fetchFeedDetail, formatEur, type Row, type CrossQrtReviewResponse, type FeedDetail } from '../lib/api';
import { renderMarkdownSafe } from '../lib/markdown';

export default function Monitor() {
  const [sla, setSla] = useState<Row[]>([]);
  const [dq, setDq] = useState<{ data: Row[]; aggregate: Row | null }>({ data: [], aggregate: null });
  const [recon, setRecon] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      fetchSlaStatus().then((r) => setSla(r.data)),
      fetchDqSummary().then(setDq),
      fetchReconciliation().then((r) => setRecon(r.data)),
    ])
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700">
          Failed to load monitoring data: {error}
        </div>
      </div>
    );
  }

  const period = sla[0]?.reporting_period || 'Latest';
  const feedsReceived = sla.filter((f) => f.status === 'on_time').length;
  const feedsLate = sla.filter((f) => f.status === 'late').length;
  const feedsMissing = sla.filter((f) => f.status === 'missing').length;
  const totalFeeds = sla.length;
  const allGreen = feedsLate === 0 && feedsMissing === 0;

  const agg = dq.aggregate;
  const passRate = agg?.overall_pass_rate || '100.0';
  const totalFailing = parseInt(agg?.total_failing || '0');
  const reconMatches = recon.filter((r) => r.status === 'MATCH').length;
  const reconTotal = recon.length;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Control Tower</h2>
          <p className="text-sm text-gray-500 mt-1">
            {period} Reporting Cycle — Bricksurance SE
          </p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
          allGreen
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {allGreen ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {allGreen ? 'All Feeds Received' : `${feedsLate + feedsMissing} Issue${feedsLate + feedsMissing > 1 ? 's' : ''}`}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          icon={Activity}
          label="Feeds Received"
          value={`${feedsReceived}/${totalFeeds}`}
          color={allGreen ? 'green' : 'amber'}
        />
        <KpiCard
          icon={ShieldCheck}
          label="DQ Pass Rate"
          value={`${passRate}%`}
          color={parseFloat(String(passRate)) >= 99 ? 'green' : 'amber'}
          onClick={() => navigate('/data-quality')}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Reconciliation"
          value={`${reconMatches}/${reconTotal} Match`}
          color={reconMatches === reconTotal ? 'green' : 'amber'}
        />
        <KpiCard
          icon={Clock}
          label="Quarantined Rows"
          value={String(totalFailing)}
          color={totalFailing === 0 ? 'green' : totalFailing < 50 ? 'amber' : 'red'}
          onClick={() => navigate('/data-quality')}
        />
      </div>

      {/* Feed Status Cards */}
      <FeedStatusSection feeds={sla} />

      {/* Reconciliation Summary */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Cross-QRT Reconciliation</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {recon.map((check) => (
            <ReconCard key={check.check_name} check={check} />
          ))}
        </div>
      </div>

      {/* Cross-QRT AI Consistency Review */}
      <CrossQrtReviewSection />

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          View QRT Reports <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => navigate('/data-quality')}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
        >
          DQ Dashboard <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function CrossQrtReviewSection() {
  const [result, setResult] = useState<CrossQrtReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showGuardrails, setShowGuardrails] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [loading]);

  async function handleReview() {
    setLoading(true);
    setError(null);
    setElapsed(0);
    try {
      const r = await generateCrossQrtReview();
      setResult(r);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Bot className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">AI Cross-QRT Consistency Review</h3>
              <p className="text-xs text-gray-500">Validates all 4 QRTs together with actuarial reasoning</p>
            </div>
          </div>
          {result && (
            <span className="text-xs text-gray-400 bg-white/60 px-2 py-1 rounded">
              {result.model_used} | {result.input_tokens + result.output_tokens} tokens
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
        )}

        {!result && !loading && (
          <div className="text-center py-6">
            <p className="text-sm text-gray-600 mb-3">
              The agent reads all 4 QRT summaries and validates cross-template consistency with actuarial reasoning.
            </p>
            <button onClick={handleReview} className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">
              <Sparkles className="w-4 h-4" />
              Run Consistency Review
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <Loader2 className="w-7 h-7 animate-spin text-teal-600 mx-auto" />
            <p className="text-sm text-gray-600 mt-3">Analysing cross-QRT consistency...</p>
            <p className="text-xs text-gray-400 mt-1">{elapsed}s elapsed</p>
          </div>
        )}

        {result && (
          <div>
            {result.guardrails && (
              <div className={`mb-3 rounded-lg border px-3 py-2 ${result.guardrails.passed ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <button onClick={() => setShowGuardrails(!showGuardrails)} className="flex items-center gap-2 w-full text-left">
                  <Shield className={`w-3.5 h-3.5 ${result.guardrails.passed ? 'text-green-600' : 'text-amber-600'}`} />
                  <span className="text-xs font-medium text-gray-700">Guardrails: {result.guardrails.checks_passed}/{result.guardrails.checks_run} passed</span>
                  {showGuardrails ? <ChevronUp className="w-3 h-3 ml-auto text-gray-400" /> : <ChevronDown className="w-3 h-3 ml-auto text-gray-400" />}
                </button>
                {showGuardrails && result.guardrails.warnings.length === 0 && result.guardrails.failures.length === 0 && (
                  <div className="mt-2 text-xs text-green-700 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />All checks passed</div>
                )}
              </div>
            )}

            <div className="prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(result.review_text) }}
            />

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">Period: {result.reporting_period}</span>
              <button onClick={handleReview} className="text-xs text-teal-600 hover:text-teal-700 font-medium">Re-run</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: 'green' | 'amber' | 'red';
  onClick?: () => void;
}) {
  const colors = {
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-red-200 text-red-700',
  };
  const iconColors = {
    green: 'text-green-500',
    amber: 'text-amber-500',
    red: 'text-red-500',
  };

  return (
    <div
      className={`rounded-lg border p-4 ${colors[color]} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${iconColors[color]}`} />
        <span className="text-xs font-medium uppercase tracking-wide opacity-75">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function FeedStatusSection({ feeds }: { feeds: Row[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-3">Data Feed Status</h3>
      <div className="grid gap-2">
        {feeds.map((feed) => (
          <div key={feed.feed_name}>
            <FeedCard
              feed={feed}
              isExpanded={expanded === feed.feed_name}
              onClick={() => setExpanded(expanded === feed.feed_name ? null : feed.feed_name)}
            />
            {expanded === feed.feed_name && (
              <FeedDetailPanel feedName={feed.feed_name} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedCard({ feed, isExpanded, onClick }: { feed: Row; isExpanded: boolean; onClick: () => void }) {
  const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; badge: 'success' | 'warning' | 'error' }> = {
    on_time: { icon: CheckCircle2, color: 'text-green-500', badge: 'success' },
    late: { icon: AlertTriangle, color: 'text-amber-500', badge: 'warning' },
    missing: { icon: XCircle, color: 'text-red-500', badge: 'error' },
  };
  const cfg = statusConfig[feed.status] || statusConfig.missing;
  const Icon = cfg.icon;

  return (
    <button
      onClick={onClick}
      className={`w-full bg-white rounded-lg border p-4 flex items-center justify-between text-left transition-all hover:shadow-md ${
        isExpanded ? 'border-blue-300 shadow-sm' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-4">
        <Icon className={`w-5 h-5 ${cfg.color}`} />
        <div>
          <div className="font-semibold text-gray-900 capitalize">{String(feed.feed_name).replace(/^1_raw_/, '').replace(/_/g, ' ')}</div>
          <div className="text-xs text-gray-500">{feed.source_system}</div>
        </div>
      </div>
      <div className="flex items-center gap-6 text-sm">
        <div className="text-right">
          <div className="text-gray-500 text-xs">Rows</div>
          <div className="font-mono text-gray-800">{parseInt(feed.row_count || '0').toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div className="text-gray-500 text-xs">DQ Pass</div>
          <div className="font-mono text-gray-800">{(parseFloat(feed.dq_pass_rate || '1') * 100).toFixed(1)}%</div>
        </div>
        <div className="text-right min-w-[100px]">
          <div className="text-gray-500 text-xs">SLA</div>
          <StatusBadge
            label={feed.status === 'on_time' ? 'On Time' : feed.status === 'late' ? 'Late' : 'Missing'}
            variant={cfg.badge}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right text-xs text-gray-400 min-w-[100px]">{feed.notes}</div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>
    </button>
  );
}

function FeedDetailPanel({ feedName }: { feedName: string }) {
  const [detail, setDetail] = useState<FeedDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'freshness' | 'completeness' | 'dq' | 'data'>('freshness');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchFeedDetail(feedName)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [feedName]);

  if (loading) {
    return (
      <div className="bg-gray-50 rounded-b-lg border border-t-0 border-gray-200 p-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-b-lg border border-t-0 border-red-200 p-4 text-sm text-red-700">
        Failed to load feed detail: {error}
      </div>
    );
  }

  if (!detail) return null;

  const tabs = [
    { id: 'freshness' as const, label: 'Freshness', count: detail.freshness.length },
    { id: 'completeness' as const, label: 'Completeness', count: detail.completeness.length },
    { id: 'dq' as const, label: 'DQ Rules', count: detail.dq_rules.length },
    { id: 'data' as const, label: 'Data Preview', count: detail.sample.length },
  ];

  return (
    <div className="bg-white rounded-b-lg border border-t-0 border-gray-200 overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50 px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && <span className="ml-1 text-gray-400">({tab.count})</span>}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* Freshness tab */}
        {activeTab === 'freshness' && (
          <div>
            <p className="text-xs text-gray-500 mb-3">SLA compliance history across reporting periods</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="pb-2 font-medium">Period</th>
                  <th className="pb-2 font-medium">SLA Deadline</th>
                  <th className="pb-2 font-medium">Actual Arrival</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Rows</th>
                  <th className="pb-2 font-medium text-right">DQ Pass</th>
                </tr>
              </thead>
              <tbody>
                {detail.freshness.map((row) => {
                  const deadline = new Date(row.sla_deadline);
                  const arrival = new Date(row.actual_arrival);
                  const daysEarly = Math.round((deadline.getTime() - arrival.getTime()) / 86400000);
                  return (
                    <tr key={row.reporting_period} className="border-b border-gray-50">
                      <td className="py-2 font-medium text-gray-900">{row.reporting_period}</td>
                      <td className="py-2 text-gray-600">{deadline.toLocaleDateString()}</td>
                      <td className="py-2 text-gray-600">
                        {arrival.toLocaleDateString()}
                        <span className={`ml-2 text-xs ${daysEarly >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {daysEarly >= 0 ? `${daysEarly}d early` : `${Math.abs(daysEarly)}d late`}
                        </span>
                      </td>
                      <td className="py-2">
                        <StatusBadge
                          label={row.status === 'on_time' ? 'On Time' : row.status === 'late' ? 'Late' : 'Missing'}
                          variant={row.status === 'on_time' ? 'success' : row.status === 'late' ? 'warning' : 'error'}
                        />
                      </td>
                      <td className="py-2 text-right font-mono text-gray-800">{parseInt(row.row_count || '0').toLocaleString()}</td>
                      <td className="py-2 text-right font-mono text-gray-800">{(parseFloat(row.dq_pass_rate || '1') * 100).toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Completeness tab */}
        {activeTab === 'completeness' && (
          <div>
            <p className="text-xs text-gray-500 mb-3">Row count comparison across periods — flags unexpected changes</p>
            <div className="grid gap-3">
              {detail.completeness.map((row) => {
                const current = parseInt(row.row_count || '0');
                const change = row.change_pct ? parseFloat(row.change_pct) : null;
                return (
                  <div key={row.reporting_period} className="flex items-center gap-4 p-3 rounded-lg border border-gray-100">
                    <div className="font-medium text-gray-900 w-20">{row.reporting_period}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="h-2 bg-blue-100 rounded-full flex-1 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${Math.min(100, (current / Math.max(...detail.completeness.map(c => parseInt(c.row_count || '0')))) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-mono text-gray-800 w-20 text-right">{current.toLocaleString()}</span>
                      </div>
                    </div>
                    {change !== null && (
                      <div className={`text-xs font-medium px-2 py-0.5 rounded ${
                        Math.abs(change) < 5 ? 'bg-green-50 text-green-700' :
                        Math.abs(change) < 15 ? 'bg-amber-50 text-amber-700' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {change >= 0 ? '+' : ''}{change}% vs prior
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DQ Rules tab */}
        {activeTab === 'dq' && (
          <div>
            <p className="text-xs text-gray-500 mb-3">
              Data quality expectations applied via DLT pipeline: <span className="font-medium">{detail.pipeline || 'N/A'}</span>
            </p>
            {detail.dq_rules.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No DQ rules found for this feed's pipeline</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="pb-2 font-medium">Expectation</th>
                    <th className="pb-2 font-medium">Table</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                    <th className="pb-2 font-medium text-right">Passing</th>
                    <th className="pb-2 font-medium text-right">Failing</th>
                    <th className="pb-2 font-medium text-right">Pass Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.dq_rules.map((rule, i) => {
                    const failing = parseInt(rule.failing_records || '0');
                    return (
                      <tr key={i} className={`border-b border-gray-50 ${failing > 0 ? 'bg-amber-50/50' : ''}`}>
                        <td className="py-2">
                          <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{rule.expectation_name}</span>
                        </td>
                        <td className="py-2 text-gray-600 text-xs">{rule.table_name}</td>
                        <td className="py-2 text-right font-mono text-gray-800">{parseInt(rule.total_records || '0').toLocaleString()}</td>
                        <td className="py-2 text-right font-mono text-green-700">{parseInt(rule.passing_records || '0').toLocaleString()}</td>
                        <td className={`py-2 text-right font-mono ${failing > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                          {failing.toLocaleString()}
                        </td>
                        <td className="py-2 text-right">
                          <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                            parseFloat(rule.pass_rate_pct || '100') >= 99.5 ? 'bg-green-100 text-green-700' :
                            parseFloat(rule.pass_rate_pct || '100') >= 95 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {rule.pass_rate_pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Data Preview tab */}
        {activeTab === 'data' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500">
                First 20 rows from <span className="font-mono">{detail.table}</span>
                {detail.columns.length > 0 && ` (${detail.columns.length} columns)`}
              </p>
            </div>
            {detail.sample.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No data available</p>
            ) : (
              <div className="overflow-x-auto max-h-96 border border-gray-200 rounded-lg">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {Object.keys(detail.sample[0]).map((col) => (
                        <th key={col} className="px-3 py-2 text-left font-medium text-gray-600 border-b whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.sample.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-1.5 border-b border-gray-100 whitespace-nowrap text-gray-700 font-mono">
                            {val === null ? <span className="text-gray-300">null</span> : String(val).substring(0, 50)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReconCard({ check }: { check: Row }) {
  const isMatch = check.status === 'MATCH';
  return (
    <div className={`rounded-lg border p-4 ${isMatch ? 'bg-white border-gray-200' : 'bg-red-50 border-red-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-900">{check.source_qrt} vs {check.target_qrt}</span>
        <StatusBadge
          label={check.status}
          variant={isMatch ? 'success' : 'error'}
        />
      </div>
      <p className="text-xs text-gray-500 mb-2">{check.check_description}</p>
      <div className="flex items-center gap-4 text-xs font-mono">
        <span>Source: {formatEur(check.source_value)}</span>
        <span>Target: {formatEur(check.target_value)}</span>
        <span className={isMatch ? 'text-green-600' : 'text-red-600'}>
          Diff: {formatEur(check.difference)}
        </span>
      </div>
    </div>
  );
}
