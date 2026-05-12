/**
 * ArtefactImpactPanel — foldable "where this changes the conversation"
 * panel that sits at the bottom of every Pillar 1 artefact page.
 *
 * Renders three sections from the per-artefact config in
 * lib/artefact-impact.ts:
 *
 *   1. Pain table — five recurring Board/Audit asks; today's reality vs
 *      what this platform makes routine. Frames the integration tax,
 *      not gaps in the team.
 *   2. Lightbulb diagram — bespoke per artefact. Switches on `diagram`
 *      key to render one of five visualisations (Champion vs Challenger,
 *      market live, cat agent, stochastic transparency, continuous stress).
 *   3. Reassurance — three columns of "what stays exactly where it is."
 *
 * Folded by default (uses native <details>); summary bar shows the title
 * and a one-line teaser. Same UX as SCRImpactPanel.
 */
import { Link } from 'react-router-dom';
import { Sparkles, ScrollText, ArrowRight, ChevronDown, Database } from 'lucide-react';
import { getArtefactImpact, type ImpactPain, type ImpactReassurance, type ImpactDiagram } from '../lib/artefact-impact';
import {
  ChampionChallengerDiagram,
  MarketLiveDiagram,
  CatAgentDiagram,
  StochasticTransparencyDiagram,
  ContinuousStressDiagram,
} from './ImpactDiagrams';

export default function ArtefactImpactPanel({ qrtId }: { qrtId: string }) {
  const cfg = getArtefactImpact(qrtId);
  if (!cfg) return null;

  return (
    <details className="group bg-gradient-to-br from-slate-50 via-white to-blue-50/40 border-2 border-slate-200 rounded-xl overflow-hidden">
      <summary className="px-5 py-3 border-b border-transparent group-open:border-slate-200 bg-slate-50/80 cursor-pointer hover:bg-slate-100 transition-colors list-none">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-700 shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{cfg.title}</h3>
            <p className="text-[11px] text-slate-600 mt-0.5">{cfg.subtitle}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-open:rotate-180 shrink-0" />
        </div>
      </summary>

      <div className="p-5 space-y-6">
        <PainTable heading={cfg.table_heading} pains={cfg.pains} />
        <DiagramBlock heading={cfg.diagram_heading} caption={cfg.diagram_caption} diagram={cfg.diagram} />
        <Reassurance heading={cfg.stays_heading} items={cfg.reassurances} />
      </div>
    </details>
  );
}

/* ═══════ 1. Pain table ═══════ */

function PainTable({ heading, pains }: { heading: string; pains: ImpactPain[] }) {
  return (
    <div>
      <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
        <ScrollText className="w-4 h-4 text-slate-600" />
        {heading}
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
            {pains.map((r, i) => (
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
        These aren't gaps in your team — they're the integration tax every Solvency II function pays. The platform pays it for you.
      </p>
    </div>
  );
}

/* ═══════ 2. Diagram dispatcher ═══════ */

function DiagramBlock({ heading, caption, diagram }: { heading: string; caption: string; diagram: ImpactDiagram }) {
  return (
    <div>
      <h4 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
        <Sparkles className="w-4 h-4 text-indigo-700" />
        {heading}
      </h4>
      <p className="text-[11px] text-slate-600 italic mb-2">{caption}</p>
      <div className="bg-white border border-gray-200 rounded-xl p-4 overflow-x-auto">
        {diagram === 'champion_challenger'    && <ChampionChallengerDiagram />}
        {diagram === 'market_live'             && <MarketLiveDiagram />}
        {diagram === 'cat_agent'                && <CatAgentDiagram />}
        {diagram === 'stochastic_transparency'  && <StochasticTransparencyDiagram />}
        {diagram === 'continuous_stress'        && <ContinuousStressDiagram />}
      </div>
    </div>
  );
}

/* ═══════ 3. Reassurance row ═══════ */

function Reassurance({ heading, items }: { heading: string; items: ImpactReassurance[] }) {
  return (
    <div className="bg-white border border-emerald-200 rounded-lg p-4">
      <h4 className="text-sm font-bold text-emerald-900 mb-2 flex items-center gap-1.5">
        <Database className="w-4 h-4 text-emerald-700" />
        {heading}
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs leading-relaxed">
        {items.map((r) => (
          <div key={r.label}>
            <div className="font-semibold text-emerald-900">{r.label}</div>
            <p className="text-gray-700 mt-1">{r.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
