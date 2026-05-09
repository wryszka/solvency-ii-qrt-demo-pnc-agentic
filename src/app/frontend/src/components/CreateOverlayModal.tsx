/**
 * CreateOverlayModal — reusable modal form for creating an overlay.
 *
 * Used from:
 *   - OverlaysRegister (manual create)
 *   - SeniorReservingPanel ("Create overlay from this suggestion" — pre-filled)
 *
 * The form is the only path to an INSERT against `6_gov_overlays`. The agent
 * proposes; the actuary edits, justifies, and submits via this modal.
 */
import { useState } from 'react';
import { Plus, Loader2, XCircle, Sparkles } from 'lucide-react';
import { createOverlay, asArray, type OverlayCreate } from '../lib/api';

const QUARTERS = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1'];
const CATEGORIES = ['one_off_event', 'methodology_judgement', 'data_correction', 'tail_extension', 'expert_judgement_other'];
const LOBS = ['property', 'motor_liability', 'general_liability', 'credit_suretyship', 'life_unit_linked', 'life_with_profits', 'life_protection'];
const MODELS = ['reserving_pnc', 'reserving_life', 'standard_formula'];

interface Props {
  initial?: Partial<OverlayCreate>;
  /** Set when the form is opened from the agent's "Create overlay from this suggestion" flow.
   *  Adds a subtle banner reminding the actuary the proposal is editable, not authoritative. */
  fromAgentSuggestion?: boolean;
  onClose: () => void;
  onCreated: (overlayId: string) => void;
}

export default function CreateOverlayModal({ initial, fromAgentSuggestion, onClose, onCreated }: Props) {
  const [model, setModel] = useState(initial?.model_name ?? 'reserving_pnc');
  const [quarter, setQuarter] = useState(initial?.quarter ?? '2025-Q4');
  const [lob, setLob] = useState(initial?.line_of_business ?? 'property');
  const [accidentYear, setAccidentYear] = useState<string>(initial?.accident_year != null ? String(initial.accident_year) : '');
  const [magnitude, setMagnitude] = useState<string>(initial?.magnitude_eur != null ? String(initial.magnitude_eur) : '');
  const [direction, setDirection] = useState<'increase' | 'decrease'>(initial?.direction ?? 'increase');
  const [category, setCategory] = useState(initial?.category ?? 'one_off_event');
  const [rationale, setRationale] = useState(initial?.rationale ?? '');
  const [linkedCellsRaw, setLinkedCellsRaw] = useState(asArray<string>(initial?.linked_qrt_cells).join('\n'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    const mag = parseFloat(magnitude);
    if (isNaN(mag) || mag === 0) { setErr('Magnitude must be a non-zero number'); return; }
    if (rationale.trim().length < 20) { setErr('Rationale should be at least 20 characters — the audit trail needs the why'); return; }

    setBusy(true);
    try {
      const result = await createOverlay({
        model_name: model,
        quarter,
        line_of_business: lob,
        accident_year: accidentYear ? parseInt(accidentYear, 10) : undefined,
        magnitude_eur: direction === 'decrease' ? -Math.abs(mag) : Math.abs(mag),
        direction,
        category,
        rationale: rationale.trim(),
        linked_qrt_cells: linkedCellsRaw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
        lifecycle_action: 'new',
        submit_for_approval: true,
      });
      onCreated(result.overlay_id);
    } catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-4 border-b border-gray-200 flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
            <Plus className="w-4 h-4 text-violet-700" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">New overlay</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              The rationale is the audit. Be specific — what changed, why now, what data backs the call.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><XCircle className="w-5 h-5" /></button>
        </header>

        {fromAgentSuggestion && (
          <div className="mx-5 mt-4 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 text-xs text-violet-900 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <strong>Pre-filled from a Senior Reserving Actuary suggestion.</strong> Edit anything — the
              proposal is starting state, not authoritative. Submitting routes for approval.
            </div>
          </div>
        )}

        <div className="p-5 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Model">
              <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
                {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Quarter">
              <select value={quarter} onChange={(e) => setQuarter(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
                {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </Field>
            <Field label="Line of business">
              <input value={lob} onChange={(e) => setLob(e.target.value)} list="lob-options"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              <datalist id="lob-options">{LOBS.map((l) => <option key={l} value={l} />)}</datalist>
            </Field>
            <Field label="Accident year (optional)">
              <input value={accidentYear} onChange={(e) => setAccidentYear(e.target.value)}
                placeholder="e.g. 2023" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </Field>
            <Field label="Direction">
              <div className="flex gap-2">
                {(['increase', 'decrease'] as const).map((d) => (
                  <button key={d} type="button" onClick={() => setDirection(d)}
                    className={`flex-1 px-3 py-1.5 rounded border text-xs font-semibold ${
                      direction === d ? 'bg-violet-700 text-white border-violet-700' : 'bg-white text-gray-700 border-gray-300'
                    }`}>{d}</button>
                ))}
              </div>
            </Field>
            <Field label="Magnitude (EUR, absolute)">
              <input value={magnitude} onChange={(e) => setMagnitude(e.target.value)}
                placeholder="e.g. 18500000"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm font-mono" />
            </Field>
            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white col-span-2">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
          </div>

          <Field label={`Rationale${rationale.length > 0 ? ` · ${rationale.length} chars` : ' (audit trail — at least 20 chars)'}`}>
            <textarea value={rationale} onChange={(e) => setRationale(e.target.value)}
              rows={5}
              placeholder="What changed, why now, what data backs the call."
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm leading-relaxed" />
          </Field>

          <Field label="Linked QRT cells (one per line or comma-separated)">
            <textarea value={linkedCellsRaw} onChange={(e) => setLinkedCellsRaw(e.target.value)}
              rows={2}
              placeholder="e.g. s0501.R0210.gross_premiums_written:property"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs font-mono" />
          </Field>
        </div>

        {err && (
          <div className="mx-5 mb-3 bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">{err}</div>
        )}

        <footer className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800">Cancel</button>
          <button onClick={submit} disabled={busy}
            className="ml-auto inline-flex items-center gap-1.5 px-4 py-1.5 bg-violet-700 text-white rounded-md hover:bg-violet-800 disabled:opacity-50 text-xs font-semibold">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Submit for approval
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-gray-600 font-semibold block mb-1">{label}</span>
      {children}
    </label>
  );
}
