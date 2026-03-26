import { useEffect, useState } from 'react';
import { Loader2, ExternalLink, BarChart3, PieChart, TrendingUp, Shield, Maximize2, Minimize2 } from 'lucide-react';
import { fetchEmbeds } from '../lib/api';

const TABS = [
  { icon: TrendingUp, label: 'Overview', desc: 'Solvency ratio KPIs, SCR vs Own Funds trend, balance sheet' },
  { icon: PieChart, label: 'S.06.02 — Assets', desc: 'CIC allocation, credit quality heatmap, duration, country exposure' },
  { icon: BarChart3, label: 'S.05.01 — P&L', desc: 'Combined ratio heatmap, GWP by LoB, loss/expense ratios, RI cession' },
  { icon: Shield, label: 'S.25.01 — SCR', desc: 'Risk module breakdown, market & NL sub-modules, own funds by tier' },
];

export default function Dashboard() {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [embedError, setEmbedError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    fetchEmbeds()
      .then((e) => {
        const host = e.dashboard_url?.split('/embed/')[0] || '';
        const id = e.dashboard_id || '';
        // Published embed URL (for iframe — works cross-origin when published with credentials)
        setEmbedUrl(`${host}/embed/dashboardsv3/${id}?embed_credentials=true`);
        // Direct link to the published dashboard (for "Open in Databricks")
        setDirectUrl(`${host}/dashboardsv3/${id}/published`);
      })
      .catch(() => setEmbedError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className={`${fullscreen ? 'fixed inset-0 z-50 bg-white' : 'max-w-6xl mx-auto p-6 space-y-4'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between ${fullscreen ? 'px-4 py-2 border-b border-gray-200 bg-gray-50' : ''}`}>
        <div>
          <h2 className={`font-bold text-gray-900 ${fullscreen ? 'text-lg' : 'text-2xl'}`}>Visual Analytics</h2>
          {!fullscreen && (
            <p className="text-sm text-gray-500 mt-1">
              Quarterly comparison across Q1–Q3 2025
              <span className="ml-2 text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full uppercase tracking-wide">Powered by Databricks AI/BI Dashboards</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {directUrl && (
            <a href={directUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50">
              <ExternalLink className="w-3.5 h-3.5" /> Open in Databricks
            </a>
          )}
          <button onClick={() => setFullscreen(!fullscreen)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50">
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>

      {/* Embedded dashboard */}
      {embedUrl && !embedError ? (
        <div className={`${fullscreen ? 'h-[calc(100vh-52px)]' : 'rounded-lg border border-gray-200 overflow-hidden'}`}
          style={fullscreen ? {} : { height: '700px' }}>
          <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            title="Lakeview Dashboard"
            allow="fullscreen"
            onError={() => setEmbedError(true)}
          />
        </div>
      ) : (
        <>
          {/* Fallback: link + tab descriptions */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            The dashboard cannot be embedded from this domain. Use the "Open in Databricks" button above, or access it directly from the workspace.
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {TABS.map((t) => (
              <div key={t.label} className="bg-white rounded-lg border border-gray-200 p-5 flex items-start gap-4">
                <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                  <t.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{t.label}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
