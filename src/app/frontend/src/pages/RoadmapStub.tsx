/**
 * RoadmapStub — single page used by all roadmap tiles.
 *
 * Each tile passes a slug. Content lives in roadmap-content.ts so adding a
 * new tile is one entry there, no per-tile file needed.
 */
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Compass, ExternalLink, ChevronRight } from 'lucide-react';
import { ROADMAP_CONTENT } from '../lib/roadmap-content';
import { TILES } from '../lib/workbench-tiles';

export default function RoadmapStub() {
  const { slug } = useParams<{ slug: string }>();
  const tile = TILES.find((t) => t.slug === slug);
  const content = slug ? ROADMAP_CONTENT[slug] : undefined;

  if (!tile || !content) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-sm text-gray-700">
        <Link to="/" className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Workbench
        </Link>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight mt-4">Roadmap entry not found</h2>
        <p className="mt-2 text-gray-600">No roadmap content for slug "{slug}".</p>
      </div>
    );
  }

  const Icon = tile.icon;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-5">
      <Link to="/" className="text-xs text-gray-500 hover:text-gray-800 inline-flex items-center gap-1">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Workbench
      </Link>

      <header className="flex items-start gap-4 border-b border-gray-200 pb-5">
        <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          <Icon className="w-7 h-7 text-slate-600" />
        </div>
        <div className="flex-1 pt-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{tile.label}</h1>
            <span className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 border border-slate-300">
              coming soon
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">Roadmap · same workbench, different workflow.</p>
        </div>
      </header>

      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-base font-bold text-gray-900 mb-2">What this workflow covers</h2>
        <p className="text-sm text-gray-700 leading-relaxed">{content.what}</p>
      </section>

      <section className="bg-gradient-to-br from-blue-50/50 to-white border border-blue-100 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-3">
          <Compass className="w-4 h-4 text-blue-700" />
          <h2 className="text-base font-bold text-gray-900">What this would look like in the workbench</h2>
        </div>
        <ul className="space-y-2">
          {content.workbench_capabilities.map((c, i) => (
            <li key={i} className="text-sm text-gray-700 leading-relaxed flex items-start gap-2">
              <span className="text-blue-600 font-mono mt-0.5">·</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </section>

      {content.adjacent_links.length > 0 && (
        <section className="bg-white border border-gray-200 rounded-lg p-5">
          <h2 className="text-base font-bold text-gray-900 mb-3">Adjacent capabilities already live</h2>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            Pieces of this workflow that already exist in the Solvency II surface — same model
            registry pattern, same overlay register, same audit panel.
          </p>
          <ul className="space-y-1.5">
            {content.adjacent_links.map((l, i) => (
              <li key={i}>
                <Link to={l.to} className="text-sm text-blue-700 hover:text-blue-900 inline-flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  {l.label} <ChevronRight className="w-3 h-3" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] text-gray-400 italic text-center pt-3">
        Have a workflow that should be a tile? <a href="#" className="text-blue-600 hover:text-blue-800">Talk to us</a>.
      </p>
    </div>
  );
}
