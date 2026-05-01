import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive as ArchiveIcon, Download, ExternalLink, CheckCircle2, XCircle, Clock,
  Search, Filter,
} from 'lucide-react';
import { fetchSubmissions, downloadFile, type SubmissionRow } from '../lib/api';
import { Skeleton, SkeletonTable } from '../components/Skeleton';

const STATUS_VARIANT: Record<string, { label: string; bg: string; text: string; Icon: React.ComponentType<{ className?: string }> }> = {
  approved: { label: 'Approved', bg: 'bg-green-100', text: 'text-green-800', Icon: CheckCircle2 },
  rejected: { label: 'Rejected', bg: 'bg-red-100', text: 'text-red-800', Icon: XCircle },
  pending:  { label: 'Pending',  bg: 'bg-amber-100', text: 'text-amber-800', Icon: Clock },
  draft:    { label: 'Draft',    bg: 'bg-gray-100', text: 'text-gray-700', Icon: Clock },
};

export default function Archive() {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [qrtFilter, setQrtFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchSubmissions()
      .then((r) => setRows(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const periods = useMemo(() => Array.from(new Set(rows.map((r) => r.reporting_period))).sort().reverse(), [rows]);
  const qrts = useMemo(() => Array.from(new Set(rows.map((r) => r.qrt_id))), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (periodFilter !== 'all' && r.reporting_period !== periodFilter) return false;
      if (qrtFilter !== 'all' && r.qrt_id !== qrtFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${r.qrt_name} ${r.qrt_title} ${r.submitted_by ?? ''} ${r.reviewed_by ?? ''} ${r.comments ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, periodFilter, qrtFilter, statusFilter, search]);

  function downloadPdf(qrt_id: string, period: string) {
    const filename = `${qrt_id}_${period}.pdf`;
    downloadFile(`/api/reports/${qrt_id}/template-pdf?period=${encodeURIComponent(period)}`, filename);
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-3 w-96" />
        <SkeletonTable rows={8} cols={7} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700">
          Failed to load submissions: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ArchiveIcon className="w-6 h-6 text-violet-600" />
          Submissions Archive
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Every QRT submission across reporting periods. Download the PDF for any past submission, drill into the
          underlying data, or filter by status / period / QRT.
        </p>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Filter className="w-3.5 h-3.5" />
          <span className="font-medium">Filter:</span>
        </div>
        <Select value={periodFilter} onChange={setPeriodFilter}
          options={[{ value: 'all', label: 'All periods' }, ...periods.map((p) => ({ value: p, label: p }))]} />
        <Select value={qrtFilter} onChange={setQrtFilter}
          options={[{ value: 'all', label: 'All QRTs' }, ...qrts.map((q) => ({ value: q, label: q.toUpperCase() }))]} />
        <Select value={statusFilter} onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'approved', label: 'Approved' },
            { value: 'pending', label: 'Pending' },
            { value: 'rejected', label: 'Rejected' },
          ]} />
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, comments…"
            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        </div>
        <div className="text-xs text-gray-500 ml-auto">
          {filtered.length} of {rows.length}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-600">
            <tr>
              <Th>Period</Th>
              <Th>QRT</Th>
              <Th>Status</Th>
              <Th>Submitted</Th>
              <Th>Reviewed</Th>
              <Th>Cycle</Th>
              <Th>DQ</Th>
              <Th>Feeds</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-gray-400 py-12 text-sm">
                  No submissions match the current filters.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const variant = STATUS_VARIANT[r.status] || STATUS_VARIANT.draft;
              return (
                <tr key={r.approval_id} className="border-b border-gray-100 hover:bg-violet-50/30 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-700">{r.reporting_period}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-gray-900">{r.qrt_name}</div>
                    <div className="text-[11px] text-gray-500">{r.qrt_title}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${variant.bg} ${variant.text}`}>
                      <variant.Icon className="w-3 h-3" /> {variant.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">
                    <div>{shortDate(r.submitted_at)}</div>
                    <div className="text-[10px] text-gray-400 truncate max-w-[140px]">{r.submitted_by}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-600">
                    <div>{shortDate(r.reviewed_at) || <span className="text-gray-300">—</span>}</div>
                    <div className="text-[10px] text-gray-400 truncate max-w-[140px]">{r.reviewed_by ?? ''}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">
                    {r.cycle_hours != null ? <span>{formatHours(r.cycle_hours)}</span> : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {r.dq_pass_rate_pct != null ? (
                      <span className={r.dq_pass_rate_pct >= 99 ? 'text-green-700' : r.dq_pass_rate_pct >= 95 ? 'text-amber-700' : 'text-red-700'}>
                        {r.dq_pass_rate_pct}%
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {(r.feeds_late + r.feeds_missing) === 0 ? (
                      <span className="text-green-700">all on-time</span>
                    ) : (
                      <span className="text-amber-700">
                        {r.feeds_late > 0 && `${r.feeds_late} late`}
                        {r.feeds_late > 0 && r.feeds_missing > 0 && ', '}
                        {r.feeds_missing > 0 && `${r.feeds_missing} missing`}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => downloadPdf(r.qrt_id, r.reporting_period)}
                        title="Download PDF"
                        className="p-1.5 rounded hover:bg-violet-100 text-violet-600 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => navigate(`/report/${r.qrt_id}?period=${encodeURIComponent(r.reporting_period)}`)}
                        title="Open report detail"
                        className="p-1.5 rounded hover:bg-violet-100 text-violet-600 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-gray-400 italic">
        PDFs are generated on demand from the canonical QRT tables — every download reflects what's currently in
        Unity Catalog for the chosen period.
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">{children}</th>;
}

function Select({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-gray-200 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-200 bg-white"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function shortDate(s: string | null): string {
  if (!s) return '';
  const cleaned = s.split('+')[0].split('.')[0].replace('T', ' ').trim();
  // Format yyyy-mm-dd hh:mm
  return cleaned.slice(0, 16);
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export { formatHours };
