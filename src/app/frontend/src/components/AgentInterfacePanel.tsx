/**
 * Agent Interface panel — the workbench's MCP tool surface, described and
 * surfaced live. Reads GET /api/mcp/manifest so it never drifts from what
 * /api/mcp serves. Same surface the app, notebooks and the Bricksurance control
 * tower all call — MCP-first: one governed surface, no logic built twice.
 */
import { useEffect, useState } from 'react';
import { Server, ShieldAlert, Zap } from 'lucide-react';

interface Tool { name: string; description: string; }
interface Manifest { server?: { name?: string; version?: string }; protocol_version?: string; tools?: Tool[]; }

const GROUPS: { prefixes: string[]; label: string; blurb: string }[] = [
  { prefixes: ['qrt_', 'approval', 'audit_'], label: 'QRT reports & sign-off', blurb: 'The full quantitative return — content, quality, comparison, lineage, versions, AI reviews, and the maker/checker approval + certificate flow.' },
  { prefixes: ['overlay'], label: 'Expert-judgement overlays', blurb: 'The overlays register — create (rationale + magnitude, role-routed), approve (maker/checker), retire, and QRT-cell lineage.' },
  { prefixes: ['gov_'], label: 'Internal-model governance', blurb: 'Model components, diagnostics, promotions, validation, and the role-gated promote action.' },
  { prefixes: ['mgov_', 'mdev_'], label: 'Model validation & development', blurb: 'The validation lab (registry, comparison, runs, approvals) and the native/worked-example/external-engine model surfaces.' },
  { prefixes: ['mon_'], label: 'Monitoring', blurb: 'SLA, data quality, reconciliation, Q4 pains, model versions and feed detail — plus grounded investigation actions.' },
  { prefixes: ['orsa_'], label: 'ORSA', blurb: 'Scenarios, business plan, runs and narratives — including running a stress and generating its narrative.' },
  { prefixes: ['sfcr_', 'rsr_', 'afr_'], label: 'Narrative reports (SFCR / RSR / AFR)', blurb: 'Sections, drafts, and the create → save → approve draft flow for each narrative report.' },
  { prefixes: ['controls_'], label: 'Internal controls', blurb: 'The controls matrix, audit log, blocked-action counter and architecture assertion.' },
  { prefixes: ['life_'], label: 'Life', blurb: 'Life reserves, underwriting risk and lapses.' },
  { prefixes: ['archive_', 'landing_'], label: 'Archive & landing', blurb: 'Archived submissions, process metrics and the close landing status.' },
  { prefixes: ['regulator_', 'agent_', 'supervisor_', 'genie_'], label: 'AI & regulator Q&A', blurb: 'The supervisor + specialists, the Senior Reserving Actuary review, grounded regulator Q&A, and AI/BI Genie.' },
  { prefixes: ['demo_'], label: 'Portfolio state', blurb: 'Daily solvency ratio, cyber book, and the current close period state.' },
];

function badge(desc: string): { text: string; cls: string } | null {
  if (/^\[gated\]/i.test(desc)) return { text: 'gated', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
  if (/^\[action\]/i.test(desc)) return { text: 'action', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  return null;
}

function Meta({ label, value }: { label: string; value?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="font-mono font-semibold text-gray-800 text-[13px]">{value || '—'}</div>
    </div>
  );
}

export default function AgentInterfacePanel() {
  const [m, setM] = useState<Manifest | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    fetch('/api/mcp/manifest').then((r) => r.json()).then(setM).catch((e) => setErr(String(e)));
  }, []);

  if (err) return <div className="text-[13px] text-red-700 bg-red-50 border border-red-200 rounded p-3">MCP manifest unavailable — {err}</div>;
  if (!m) return <div className="text-sm text-gray-500">Reading the MCP server manifest…</div>;

  const tools = m.tools || [];
  const rpcUrl = `${origin}/api/mcp`;
  const groupIndex = (n: string) => GROUPS.findIndex((g) => g.prefixes.some((p) => n.startsWith(p)));

  return (
    <div className="space-y-5">
      <div className="border border-violet-200 bg-violet-50/50 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-2xl">
            <div className="font-semibold text-gray-900 flex items-center gap-2"><Server className="w-4 h-4 text-violet-700" /> MCP server — live</div>
            <p className="text-[13px] text-gray-700 leading-relaxed mt-1">
              The Solvency II workbench publishes its <strong>whole surface</strong> as a <strong>Model Context Protocol</strong>
              server, so an outside agent — the Bricksurance <strong>control tower</strong> included — can operate the entire
              return using the <em>same</em> tools the app and notebooks use (MCP-first: one surface, no logic built twice).
              Every write action carries the <strong>same server-side gate</strong> as the UI (submit≠review, overlay
              propose≠approve, role-gated model promotion), so an agent can't bypass what the app enforces. Read live from the
              running server's manifest.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">running</span>
            <span className="text-[11px] text-gray-500">{tools.length} tools</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          <Meta label="Server" value={m.server?.name} />
          <Meta label="Version" value={m.server?.version} />
          <Meta label="MCP protocol" value={m.protocol_version} />
          <Meta label="Tools" value={String(tools.length)} />
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Endpoints</div>
          <div className="flex items-center gap-2 text-[12.5px] flex-wrap">
            <span className="font-mono bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">POST</span>
            <code className="font-mono text-gray-700 break-all">{rpcUrl}</code>
            <span className="text-gray-400">· JSON-RPC (initialize · tools/list · tools/call)</span>
          </div>
          <div className="flex items-center gap-2 text-[12.5px] flex-wrap">
            <span className="font-mono bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">GET</span>
            <code className="font-mono text-gray-700 break-all">{rpcUrl}/manifest</code>
            <span className="text-gray-400">· this manifest</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
          <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-rose-500" /> gated = re-checks RBAC/policy server-side</span>
          <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-amber-500" /> action = writes through a governed handler</span>
        </div>
      </div>

      {GROUPS.map((g, gi) => {
        const gt = tools.filter((t) => groupIndex(t.name) === gi);
        if (!gt.length) return null;
        return (
          <div key={g.label} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold text-gray-900">{g.label}</h3>
              <span className="text-[11px] text-gray-400 ml-auto">{gt.length}</span>
            </div>
            <p className="text-[12.5px] text-gray-500 mb-3">{g.blurb}</p>
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
              {gt.map((t) => {
                const b = badge(t.description);
                return (
                  <div key={t.name} className="px-3.5 py-2.5 flex items-start gap-3">
                    <code className="font-mono text-[11.5px] bg-gray-50 border border-gray-200 text-gray-800 px-1.5 py-0.5 rounded shrink-0">{t.name}</code>
                    {b && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${b.cls}`}>{b.text}</span>}
                    <span className="text-[13px] text-gray-700 leading-relaxed">{t.description.replace(/^\[(gated|action)\]\s*/i, '')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
