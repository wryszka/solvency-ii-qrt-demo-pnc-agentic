/**
 * WhatAmISeeing — collapsible plain-language "what does this screen show?" explainer.
 *
 * The reader-facing companion to UnderTheHood (which is the platform/how-it's-built
 * disclosure). This one is jargon-free: it orients a non-expert to what the screen
 * is telling them, in the practitioner's own terms. One sits near the top of every
 * data screen (Scorecard F).
 *
 * Usage:
 *   <WhatAmISeeing body="Plain-language sentence(s) about this screen." />
 *   <WhatAmISeeing>rich <strong>content</strong></WhatAmISeeing>
 */
import { useState, type ReactNode } from 'react';
import { ChevronRight, Eye } from 'lucide-react';

export default function WhatAmISeeing({
  body,
  children,
  defaultOpen = false,
}: {
  body?: string;
  children?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border border-slate-200 bg-blue-50/40 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-50/70 transition-colors"
      >
        <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span className="text-[11px] uppercase tracking-widest font-bold text-slate-600">
          What am I seeing?
        </span>
        <ChevronRight
          className={`w-3.5 h-3.5 ml-auto text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-slate-200 px-3 py-2.5 text-sm text-slate-600 leading-relaxed max-w-[74ch]">
          {children ?? body}
        </div>
      )}
    </section>
  );
}
