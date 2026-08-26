/**
 * IllustrativeBadge / IllustrativeEngineNote — honest labelling for
 * pre-computed sample output.
 *
 * External engines (Prophet, Igloo) and a few Pillar-1 stress figures are
 * shown with illustrative, pre-computed data — this demo doesn't hold the
 * engine licences. The point isn't to reproduce those engines: it's that
 * Databricks governs peer engines under one interface, so the story is
 * "integrate the tools you already run", not "all-or-nothing". These
 * affordances say so plainly, in the amber (caution) tone, so nobody reads
 * the numbers as live output.
 */
import { FlaskConical, Info } from 'lucide-react';

export function IllustrativeBadge({ title, className = '' }: { title?: string; className?: string }) {
  return (
    <span
      title={title ?? 'Illustrative — pre-computed sample output, not a live engine run'}
      className={`inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}
    >
      <FlaskConical className="w-3 h-3" /> Illustrative
    </span>
  );
}

/**
 * IllustrativeEngineNote — the inline explainer for a page that surfaces
 * external-engine output. Pass the engine name(s); defaults to both.
 */
export function IllustrativeEngineNote({ engine, className = '' }: { engine?: string; className?: string }) {
  return (
    <div className={`bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3 text-sm ${className}`}>
      <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
      <span className="text-amber-900 leading-relaxed">
        <strong>Illustrative external-engine output.</strong> The {engine ?? 'Prophet and Igloo'} figures
        shown here are pre-computed sample data — we don't hold the engine licences for the demo. That's
        deliberate: the point isn't to reproduce these engines but to show that Databricks governs peer
        engines under one interface — <em>integrate the tools you already run</em>, not all-or-nothing.
        In a real deployment the engine runs for real via its own API against the same governed Volume
        data contract; the versions, aliases, diagnostics and lineage you see around it are all live.
      </span>
    </div>
  );
}
