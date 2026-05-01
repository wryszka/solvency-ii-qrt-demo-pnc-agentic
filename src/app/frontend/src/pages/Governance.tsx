import { useState } from 'react';
import {
  Scale, MessageCircleQuestion, Database, ShieldCheck, FileSearch,
  GitCompare, FlaskConical, Bot, Workflow, History, KeyRound, ScrollText,
  ChevronDown, ChevronRight,
} from 'lucide-react';

type TabId = 'qa' | 'inventory';

export default function Governance() {
  const [tab, setTab] = useState<TabId>('qa');

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Scale className="w-6 h-6 text-violet-600" />
          Governance
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          How the QRT process is governed, audited, and what data the platform records along the way
        </p>
      </div>

      {/* Tab strip */}
      <div className="flex gap-1 border-b border-gray-200">
        <TabButton
          active={tab === 'qa'}
          onClick={() => setTab('qa')}
          icon={MessageCircleQuestion}
          label="Governance Q&A"
          hint="Standard questions an actuary or manager would ask"
        />
        <TabButton
          active={tab === 'inventory'}
          onClick={() => setTab('inventory')}
          icon={Database}
          label="Data Collected & Uses"
          hint="What we record across the process — and how it can be used"
        />
      </div>

      {tab === 'qa' && <GovernanceQA />}
      {tab === 'inventory' && <DataInventory />}
    </div>
  );
}

function TabButton({
  active, onClick, icon: Icon, label, hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      title={hint}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? 'border-violet-600 text-violet-700 bg-violet-50/50'
          : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

/* ═══════════════════════ Tab 1: Governance Q&A ═══════════════════════ */

interface QA {
  q: string;
  a: string;
  category: 'roles' | 'audit' | 'controls' | 'ai' | 'data';
}

const QA_ITEMS: QA[] = [
  {
    category: 'roles',
    q: 'Who is responsible for approving each QRT?',
    a: `Each QRT carries a documented owner and an approver:
- **S.06.02 (Assets)** — prepared by Investments, approved by the CFO designate
- **S.05.01 (Premiums/Claims/Expenses)** — prepared by Finance, approved by the CFO
- **S.25.01 (SCR)** — prepared by Risk/Actuarial, approved by the appointed Actuary and CRO
- **S.26.06 (NL UW Risk)** — prepared by Actuarial, approved by the appointed Actuary

The approver of record is whoever clicks "Approve" in the app; their identity, comments, and timestamp are persisted to the \`6_ai_approvals\` table.`,
  },
  {
    category: 'audit',
    q: 'What is the audit trail when a QRT is approved or rejected?',
    a: `Every approval action writes a row to \`6_ai_approvals\` capturing: \`qrt_id\`, \`reporting_period\`, \`status\` (submitted / approved / rejected), \`submitted_by\`, \`submitted_at\`, \`reviewed_by\`, \`reviewed_at\`, \`comments\`. Rows are immutable from the app — corrections come through new submissions, leaving the original visible.

The Governance Log document (auto-generated per QRT) snapshots all of this plus the underlying data, DQ outcomes, lineage, and AI agent verdicts at the moment of approval. It's a single PDF you can hand to an auditor.`,
  },
  {
    category: 'controls',
    q: 'How do we ensure data quality before submission?',
    a: `Three layers of checks:
1. **DLT Expectations** — every staging/gold table has declarative constraints (e.g. \`assets_have_lei\`, \`premiums_non_negative\`, \`subrogation_within_threshold\`). Failures are recorded in \`5_mon_dq_expectation_results\` and visible on the Monitor page.
2. **Cross-QRT reconciliation** — \`5_mon_cross_qrt_reconciliation\` runs ~10 named checks (e.g. assets in S.06.02 must match market-risk inputs in S.25.01). Mismatches block approval.
3. **Pipeline SLA tracking** — \`5_mon_pipeline_sla_status\` tracks feed arrival vs deadline so a delayed feed doesn't get silently approved with stale data.

Approval is hard-gated on these — the supervisor agent surfaces any failure when asked "are we on track for Friday?".`,
  },
  {
    category: 'controls',
    q: 'What controls prevent unauthorized changes to QRT data?',
    a: `Data lives in Unity Catalog with table-level GRANTs. The app's service principal has \`SELECT\` on raw/staging/gold and \`INSERT/UPDATE\` only on \`6_ai_approvals\`. End users authenticate via SSO through the Databricks App, and their identity is propagated to the audit log.

The QRT outputs themselves are produced by versioned DLT pipelines — direct \`INSERT\` from the app is not possible. To re-state, you re-run the pipeline against corrected raw data.`,
  },
  {
    category: 'controls',
    q: 'How are model versions managed?',
    a: `Stochastic and standard-formula models are registered in Unity Catalog (Mosaic AI Model Registry). \`5_mon_model_registry_log\` captures every version transition (Champion → Challenger, deprecation, etc.) with the actor and timestamp. Each QRT row carries the \`model_version\` that produced it, so you can always answer "which model produced this number?".

Re-running a QRT with a new model creates a new period-aligned record; the previous version is preserved.`,
  },
  {
    category: 'audit',
    q: 'What is the segregation of duties between preparer and approver?',
    a: `The app enforces that \`submitted_by\` and \`reviewed_by\` cannot be the same identity for a given (\`qrt_id\`, \`reporting_period\`) pair. If you submitted, the Approve button is disabled for you; another authorised user must review.

For the demo, the same identity may appear on both sides because it's a single-user environment — in production this is enforced by the app's authorisation layer plus a SQL constraint on \`6_ai_approvals\`.`,
  },
  {
    category: 'audit',
    q: 'What happens if a regulator requests a re-submission?',
    a: `Re-submission is a fresh approval cycle, not an edit. The flow:
1. Investigate the issue with the supervisor agent / Monitor page.
2. Correct the upstream data (raw layer) — never the QRT layer directly.
3. Re-run the affected DLT pipeline; this writes a new period-aligned row.
4. The previous approval row stays in \`6_ai_approvals\` with status \`approved\`; a new submission row is appended.
5. Generate a fresh Governance Log explaining what changed and why.

The original submission and its supporting data remain queryable indefinitely — required by Article 35 retention rules.`,
  },
  {
    category: 'data',
    q: 'How long is data retained, and what is the chain of custody?',
    a: `All raw, staging, gold, monitoring, and approval tables are retained for the regulatory retention period (Solvency II Article 35: 5 years minimum; we apply 7 to align with internal policy).

Chain of custody from raw to submitted file:
- Raw feeds land in \`1_raw_*\` with source-system and ingest-timestamp
- Lineage is automatic in Unity Catalog — every downstream table tracks its inputs
- The submitted XBRL package references the exact \`reporting_period\` and \`model_version\` it was built from
- The Governance Log embeds row-level totals so the file shipped to EIOPA can always be reconstructed`,
  },
  {
    category: 'data',
    q: 'Who can access what data?',
    a: `Access is controlled through Unity Catalog GRANTs and Databricks Apps SSO. Typical assignment:
- **Reporting team** — \`SELECT\` on raw, staging, gold, monitoring; \`INSERT\` on approvals via the app
- **Audit / Compliance** — \`SELECT\` everywhere, including \`5_mon_*\` and \`6_ai_*\` (read-only)
- **External auditors** — temporary share via Delta Sharing scoped to one reporting period
- **Service principals** (e.g. the app, DLT pipelines) — minimum scope per task

PII (e.g. counterparty contact data, individual claim narratives) is masked or hashed in the curated layer and only available to roles with explicit \`UNMASK\` privilege.`,
  },
  {
    category: 'ai',
    q: 'Are AI / agent outputs reviewed before being used?',
    a: `AI outputs are advisory — they never write to the regulatory tables. The supervisor agent reads from gold and monitoring tables, summarises findings, and surfaces them in the chat. Approval still requires a human click in the Reports view.

For traceability, every LLM call is wrapped with MLflow tracing — system prompt, user prompt, model used, input/output tokens, and timestamp are persisted. The Governance Log includes the agent verdict and prompt for each QRT under review.`,
  },
  {
    category: 'ai',
    q: 'What stops the AI from hallucinating numbers?',
    a: `Three guardrails:
1. **Tool-only data access** — the supervisor cannot fetch numbers; it calls registered tools (\`pipeline_status\`, \`qrt_summary\`, \`cross_qrt_reconciliation\`, \`ask_genie\`) which run against governed tables. Anything quantitative in its answer comes from a tool result that's recorded in the trace.
2. **AI Gateway content filtering** — input and output go through configurable safety/PII filters with rate limits. Failures are logged.
3. **Output validation in the app** — guardrail checks (\`server/guardrails.py\`) verify length, PII leakage, and refusal patterns; truncation/flagging is auditable.

The reasoning trace shown in the chat lets a reviewer spot-check that the answer is grounded in tool output, not invented.`,
  },
  {
    category: 'ai',
    q: 'Which model produced which answer, and can we change it?',
    a: `The model used is shown at the bottom of every supervisor response (e.g. \`databricks-claude-sonnet-4\`). The app prefers Claude Sonnet, with Llama 3.3 70B as a fallback. To switch, set the \`AI_GATEWAY_ENDPOINT\` env var to a Gateway-routed endpoint and the call will go through that — gateway config governs which underlying model serves the request.

For long-term reproducibility, MLflow traces capture the resolved endpoint at call time.`,
  },
];

const CATEGORY_LABELS: Record<QA['category'], string> = {
  roles: 'Roles & responsibilities',
  audit: 'Audit trail',
  controls: 'Controls',
  data: 'Data access & retention',
  ai: 'AI / agent governance',
};

const CATEGORY_ICONS: Record<QA['category'], React.ComponentType<{ className?: string }>> = {
  roles: KeyRound,
  audit: ScrollText,
  controls: ShieldCheck,
  data: Database,
  ai: Bot,
};

function GovernanceQA() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const grouped: Record<QA['category'], QA[]> = { roles: [], audit: [], controls: [], data: [], ai: [] };
  QA_ITEMS.forEach((item) => grouped[item.category].push(item));

  let runningIdx = 0;
  return (
    <div className="space-y-6">
      <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 text-sm text-violet-900">
        <p>
          <strong>Use this page</strong> when an actuary, manager, or auditor asks how the process is controlled.
          Each answer reflects what's actually wired into the platform — file paths, table names, and SQL identifiers
          are real and you can verify them in the corresponding pages.
        </p>
      </div>

      {(Object.keys(grouped) as QA['category'][]).map((cat) => {
        const items = grouped[cat];
        if (items.length === 0) return null;
        const Icon = CATEGORY_ICONS[cat];
        return (
          <section key={cat} className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-700 uppercase tracking-wide">
              <Icon className="w-4 h-4 text-violet-600" />
              {CATEGORY_LABELS[cat]}
            </h3>
            <div className="space-y-1.5">
              {items.map((item) => {
                const myIdx = runningIdx++;
                const open = openIdx === myIdx;
                return (
                  <div key={item.q} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                    <button
                      onClick={() => setOpenIdx(open ? null : myIdx)}
                      className="w-full flex items-start gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      {open ? (
                        <ChevronDown className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      )}
                      <span className={`text-sm font-medium ${open ? 'text-violet-800' : 'text-gray-800'}`}>
                        {item.q}
                      </span>
                    </button>
                    {open && (
                      <div className="px-4 pb-4 pl-10 prose-sm max-w-none text-sm text-gray-700 leading-relaxed">
                        <Markdown text={item.a} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Lightweight markdown — bold via **x**, code via `x`, list via leading `- `. */
function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let listBuf: string[] = [];
  const flushList = () => {
    if (listBuf.length === 0) return;
    blocks.push(
      <ul key={blocks.length} className="list-disc pl-5 space-y-1 my-1.5">
        {listBuf.map((l, i) => (
          <li key={i}>{renderInline(l)}</li>
        ))}
      </ul>,
    );
    listBuf = [];
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('- ')) {
      listBuf.push(line.slice(2));
    } else if (line.match(/^\d+\.\s/)) {
      listBuf.push(line.replace(/^\d+\.\s/, ''));
    } else {
      flushList();
      if (line.trim() === '') {
        blocks.push(<div key={blocks.length} className="h-1.5" />);
      } else {
        blocks.push(<p key={blocks.length} className="my-1">{renderInline(line)}</p>);
      }
    }
  }
  flushList();
  return <>{blocks}</>;
}

function renderInline(text: string): React.ReactNode {
  // Split on `code` and **bold**
  const parts: React.ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIdx = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) {
      parts.push(<code key={key++} className="px-1 py-0.5 bg-gray-100 rounded text-[12px] font-mono text-violet-700">{tok.slice(1, -1)}</code>);
    } else {
      parts.push(<strong key={key++} className="font-semibold text-gray-900">{tok.slice(2, -2)}</strong>);
    }
    lastIdx = m.index + tok.length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}

/* ═══════════════════════ Tab 2: Data Collected & Uses ═══════════════════════ */

interface DataCategory {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  collected: { item: string; where: string }[];
  uses: string[];
}

const DATA_CATEGORIES: DataCategory[] = [
  {
    name: 'Raw regulatory data feeds',
    icon: Database,
    collected: [
      { item: 'Assets, premiums, claims, expenses, exposures, reinsurance, counterparties', where: '`1_raw_*` tables' },
      { item: 'Source system, ingest timestamp, file checksum', where: 'Per-row metadata in raw tables' },
      { item: 'Reporting period and entity LEI', where: 'Partition columns' },
    ],
    uses: [
      'Source-of-truth for all downstream QRT calculations',
      'Recoverability — every published number can be reconstructed from raw',
      'Regulatory inquiry response (EIOPA, NSAs)',
      'Internal investigations into specific portfolios or LoBs',
    ],
  },
  {
    name: 'Data quality outcomes',
    icon: ShieldCheck,
    collected: [
      { item: 'DLT expectation pass/fail counts per pipeline & table', where: '`5_mon_dq_expectation_results`' },
      { item: 'Constraint definitions and severity (warn / drop / fail)', where: 'DLT pipeline source' },
      { item: 'Failing-row samples and SQL', where: 'DQ investigation panel' },
    ],
    uses: [
      'Pre-submission gating — block approval when checks fail',
      'Trend analysis — DQ pass rate over time per feed',
      'Post-incident analysis — what failed, when, by how much',
      'Operational SLA reporting to the Risk Committee',
    ],
  },
  {
    name: 'Pipeline & SLA telemetry',
    icon: Workflow,
    collected: [
      { item: 'Feed arrival vs SLA deadline, status (on-time / late / missing)', where: '`5_mon_pipeline_sla_status`' },
      { item: 'Pipeline run duration and outcome', where: 'DLT system tables + monitoring layer' },
      { item: 'Free-text notes (e.g. "DQ rejected, awaiting resubmission Monday")', where: '`notes` column' },
    ],
    uses: [
      'Real-time deadline-risk view — "are we on track for Friday?"',
      'Cycle-time reduction — find the slowest steps and fix them',
      'Vendor / data-supplier SLA enforcement',
      'Capacity planning for warehouse and pipeline compute',
    ],
  },
  {
    name: 'Cross-QRT reconciliation',
    icon: GitCompare,
    collected: [
      { item: 'Named consistency checks across templates with source/target/diff/tolerance', where: '`5_mon_cross_qrt_reconciliation`' },
      { item: 'Pass/fail status with explanation', where: 'Same table' },
    ],
    uses: [
      'Block approval on material mismatches',
      'Identify methodology drift between teams',
      'Provide reviewer-ready evidence of internal consistency',
    ],
  },
  {
    name: 'Stochastic & SCR model runs',
    icon: FlaskConical,
    collected: [
      { item: 'Run ID, scenario count, calibration parameters, runtime', where: '`4_eng_stochastic_run_log`' },
      { item: 'Per-scenario distribution outputs (P-distribution, VaR, TVaR)', where: '`4_eng_stochastic_results`' },
      { item: 'Standard formula intermediate breakdowns', where: '`3_qrt_s2501_scr_breakdown`' },
      { item: 'Champion/Challenger model version per run', where: 'Bound to MLflow model version' },
    ],
    uses: [
      'Reproducibility — re-run any past period with the same inputs and get the same number',
      'Model validation / back-testing',
      'Sensitivity analysis for the Risk Committee',
      'Regulatory IMA inquiry response (if applicable)',
    ],
  },
  {
    name: 'Approval workflow & governance log',
    icon: ScrollText,
    collected: [
      { item: 'Submission and approval events with actor, timestamp, comments', where: '`6_ai_approvals`' },
      { item: 'Per-period Governance Log PDF (data + DQ + AI verdict snapshot)', where: 'Generated artefact' },
    ],
    uses: [
      'SOX-style audit trail',
      'External auditor evidence pack',
      'Regulator response — "show me the approval record for Q3 S.25.01"',
      'Internal post-mortem on rejected submissions',
    ],
  },
  {
    name: 'AI / agent telemetry',
    icon: Bot,
    collected: [
      { item: 'System prompt, user prompt, model used, input/output tokens', where: 'MLflow traces' },
      { item: 'Tool calls, arguments, durations, results', where: 'Supervisor reasoning trace' },
      { item: 'Guardrail outcomes (PII flags, length, refusal patterns)', where: '`server/guardrails.py` + log' },
      { item: 'AI Gateway events (rate limits, content filter hits)', where: 'Gateway logs' },
    ],
    uses: [
      'AI explainability for regulators and internal model risk teams',
      'Cost attribution per agent / per QRT',
      'Quality monitoring — flag outputs that drift from baseline',
      'Continuous improvement — what questions does the chat answer poorly?',
    ],
  },
  {
    name: 'Lineage & metadata',
    icon: History,
    collected: [
      { item: 'Column-level lineage from raw → staging → gold', where: 'Unity Catalog (automatic)' },
      { item: 'Table descriptions and column descriptions', where: 'UC `COMMENT` metadata' },
      { item: 'Permissions / GRANTs', where: 'Unity Catalog audit log' },
    ],
    uses: [
      'Impact analysis when a raw feed schema changes',
      'Compliance evidence for "where does this number come from?"',
      'Onboarding new analysts via auto-generated data dictionary',
      'Detection of unauthorized access attempts (audit log)',
    ],
  },
];

function DataInventory() {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <div className="flex items-start gap-2">
          <FileSearch className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">What is collected, and what it's good for</p>
            <p>
              The platform records data at every step of the QRT cycle — not just the regulatory outputs. This
              page lists every category of data the platform persists, where it lives, and the kinds of questions
              it lets you answer. None of these are speculative future capabilities; everything below is wired up today.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DATA_CATEGORIES.map((cat) => (
          <div key={cat.name} className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-gradient-to-r from-violet-50 to-blue-50 border-b border-gray-200 flex items-center gap-2">
              <cat.icon className="w-4 h-4 text-violet-600" />
              <h4 className="text-sm font-bold text-gray-800">{cat.name}</h4>
            </div>
            <div className="p-4 space-y-3 text-sm flex-1">
              <div>
                <div className="text-[11px] uppercase tracking-wide font-bold text-gray-500 mb-1">Collected</div>
                <ul className="space-y-1">
                  {cat.collected.map((c, i) => (
                    <li key={i} className="text-gray-700 leading-snug">
                      <span>{c.item}</span>
                      <span className="text-gray-400 text-xs ml-1.5">— <Markdown text={c.where} /></span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide font-bold text-gray-500 mb-1">How it can be used</div>
                <ul className="space-y-0.5">
                  {cat.uses.map((u, i) => (
                    <li key={i} className="text-gray-600 text-xs leading-snug flex gap-1.5">
                      <span className="text-violet-400">•</span>
                      <span>{u}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
