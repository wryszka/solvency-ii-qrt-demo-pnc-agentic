import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Send, Bot, User, ChevronDown, ChevronRight,
  Database, Zap, Search, GitCompare, FlaskConical, ShieldCheck,
  Wrench, Cloud, Anchor, Cog, FileSearch, Sparkles, ExternalLink,
} from 'lucide-react';
import {
  fetchRegulatorExamples, askSupervisorStream,
  type RegulatorExampleCategory,
} from '../lib/api';
import { renderMarkdownSafe } from '../lib/markdown';

interface ToolCall {
  tool_call_id: string;
  name: string;
  arguments: Record<string, unknown>;
  result_preview?: string;
  result_size?: number;
  duration_ms?: number;
  start_ms?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  trace?: ToolCall[];
  meta?: {
    model_used: string;
    tokens: number;
    iterations: number;
  };
  status?: string;  // e.g. "Thinking…" while streaming
  error?: string;
}

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pipeline_status: ShieldCheck,
  approval_status: FileSearch,
  qrt_summary: Search,
  cross_qrt_reconciliation: GitCompare,
  estimate_cycle_time: Zap,
  ask_genie: Database,
};

const TOOL_LABELS: Record<string, string> = {
  pipeline_status: 'Pipeline & DQ status',
  approval_status: 'Approval workflow',
  qrt_summary: 'QRT summary',
  cross_qrt_reconciliation: 'Cross-QRT reconciliation',
  estimate_cycle_time: 'Cycle time estimate',
  ask_genie: 'AI/BI Genie query',
};

export default function RegulatorQA() {
  const [examples, setExamples] = useState<RegulatorExampleCategory[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRegulatorExamples()
      .then((r: { examples: RegulatorExampleCategory[] }) => {
        setExamples(r.examples);
      })
      .catch((e) => console.error('Failed to fetch examples:', e));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [loading]);

  async function handleSend(question?: string) {
    const q = (question || input).trim();
    if (!q || loading) return;
    setInput('');
    setLoading(true);
    setElapsed(0);

    // Append user message + placeholder assistant message that we'll mutate
    const startTime = Date.now();
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: q },
      { role: 'assistant', content: '', trace: [], status: 'Thinking…' },
    ]);

    const updateAssistant = (mutator: (msg: ChatMessage) => ChatMessage) => {
      setMessages((prev) => {
        const out = [...prev];
        const lastIdx = out.length - 1;
        if (out[lastIdx]?.role === 'assistant') {
          out[lastIdx] = mutator(out[lastIdx]);
        }
        return out;
      });
    };

    try {
      await askSupervisorStream(q, (event) => {
        if (event.type === 'status') {
          updateAssistant((m) => ({ ...m, status: event.message }));
        } else if (event.type === 'tool_call') {
          updateAssistant((m) => ({
            ...m,
            trace: [...(m.trace || []), {
              tool_call_id: event.tool_call_id,
              name: event.name,
              arguments: event.arguments,
              start_ms: Date.now() - startTime,
            }],
          }));
        } else if (event.type === 'tool_result') {
          updateAssistant((m) => ({
            ...m,
            trace: (m.trace || []).map((t) =>
              t.tool_call_id === event.tool_call_id
                ? {
                    ...t,
                    result_preview: event.result_preview,
                    result_size: event.result_size,
                    duration_ms: Date.now() - startTime - (t.start_ms || 0),
                  }
                : t
            ),
          }));
        } else if (event.type === 'answer') {
          updateAssistant((m) => ({ ...m, content: event.text, status: undefined }));
        } else if (event.type === 'done') {
          updateAssistant((m) => ({
            ...m,
            status: undefined,
            meta: {
              model_used: event.model_used,
              tokens: event.input_tokens + event.output_tokens,
              iterations: event.iterations,
            },
          }));
        } else if (event.type === 'error') {
          updateAssistant((m) => ({ ...m, status: undefined, error: event.message }));
        }
      });
    } catch (e: unknown) {
      updateAssistant((m) => ({ ...m, status: undefined, error: (e as Error).message }));
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Regulatory AI</h2>
        <p className="text-sm text-gray-500 mt-1">
          Supervisor agent — orchestrates sub-agents and Genie to answer any regulatory or operational question
          <span className="ml-2 text-[10px] font-medium text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full uppercase tracking-wide">Powered by Databricks Foundation Model API + Mosaic AI</span>
        </p>
      </div>

      {/* Chat */}
      <div className="bg-white rounded-lg border-2 border-violet-200 overflow-hidden">
        <div className="px-4 py-3 bg-violet-50 border-b border-violet-200 flex items-center gap-2">
          <Bot className="w-5 h-5 text-violet-600" />
          <div>
            <span className="text-sm font-bold text-violet-900">Supervisor Agent</span>
            <span className="ml-2 text-[10px] text-violet-500">Reads pipelines, DQ, approvals, Genie — composes a single answer</span>
          </div>
          {loading && (
            <span className="ml-auto text-[10px] text-violet-500 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> {elapsed}s
            </span>
          )}
        </div>

        <div className="overflow-y-auto p-4 space-y-3" style={{ maxHeight: '500px' }}>
          {messages.length === 0 && !loading && (
            <div className="space-y-3">
              <div className="text-xs text-gray-500">Try one of these:</div>
              <div className="flex flex-wrap gap-1.5">
                {examples.flatMap((cat) => cat.questions).map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="px-2.5 py-1.5 rounded-full border border-violet-100 hover:border-violet-300 hover:bg-violet-50 text-xs text-gray-600 hover:text-violet-800 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-violet-200 p-3 bg-violet-50/30">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about the QRT cycle, pipelines, or data…"
              className="flex-1 border border-violet-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              disabled={loading}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="px-3 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Architecture diagram (below the chat) */}
      <AgentDiagram show={showDiagram} onToggle={() => setShowDiagram(!showDiagram)} />
    </div>
  );
}

/* ═══════ Message Bubble ═══════ */
function MessageBubble({ message }: { message: ChatMessage }) {
  const [showTrace, setShowTrace] = useState(false);
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex items-start gap-3 flex-row-reverse">
        <div className="p-1.5 rounded-full shrink-0 bg-blue-100">
          <User className="w-4 h-4 text-blue-600" />
        </div>
        <div className="max-w-[80%] text-right">
          <div className="rounded-lg px-4 py-3 text-sm bg-blue-600 text-white">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="p-1.5 rounded-full shrink-0 bg-violet-100">
        <Bot className="w-4 h-4 text-violet-600" />
      </div>
      <div className="flex-1 max-w-[85%]">
        {/* Reasoning trace */}
        {(message.trace && message.trace.length > 0) && (
          <div className="mb-2">
            <button
              onClick={() => setShowTrace(!showTrace)}
              className="flex items-center gap-1.5 text-[11px] text-violet-600 hover:text-violet-800 font-medium"
            >
              {showTrace ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <Sparkles className="w-3 h-3" />
              {showTrace ? 'Hide reasoning' : `Show reasoning (${message.trace.length} step${message.trace.length === 1 ? '' : 's'})`}
            </button>
            {showTrace && (
              <div className="mt-1.5 space-y-1.5 border-l-2 border-violet-200 pl-3">
                {message.trace.map((t, i) => {
                  const Icon = TOOL_ICONS[t.name] || Cog;
                  const label = TOOL_LABELS[t.name] || t.name;
                  return (
                    <div key={i} className="text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 text-violet-600" />
                        <span className="font-medium text-violet-800">{label}</span>
                        {t.duration_ms !== undefined && (
                          <span className="text-gray-400 font-mono">{t.duration_ms}ms</span>
                        )}
                        {t.duration_ms === undefined && (
                          <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
                        )}
                      </div>
                      {Object.keys(t.arguments).length > 0 && (
                        <div className="text-gray-500 ml-5 font-mono">
                          {JSON.stringify(t.arguments)}
                        </div>
                      )}
                      {t.result_preview && (
                        <details className="ml-5">
                          <summary className="text-gray-500 cursor-pointer hover:text-gray-700">
                            Result ({t.result_size?.toLocaleString()} chars)
                          </summary>
                          <pre className="mt-1 p-2 bg-gray-50 rounded text-[10px] text-gray-700 overflow-x-auto whitespace-pre-wrap max-h-32">{t.result_preview}</pre>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Status (while streaming) */}
        {message.status && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600 flex items-center gap-2 mb-2">
            <Loader2 className="w-3 h-3 animate-spin text-violet-600" />
            {message.status}
          </div>
        )}

        {/* Final answer */}
        {message.content && (
          <div className="rounded-lg px-4 py-3 text-sm bg-gray-50 text-gray-800">
            <div className="prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(message.content) }}
            />
          </div>
        )}

        {/* Error */}
        {message.error && (
          <div className="rounded-lg px-4 py-3 text-sm bg-red-50 border border-red-200 text-red-700">
            {message.error}
          </div>
        )}

        {/* Meta */}
        {message.meta && (
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
            <span>{message.meta.model_used}</span>
            <span>|</span>
            <span>{message.meta.tokens.toLocaleString()} tokens</span>
            <span>|</span>
            <span>{message.meta.iterations} reasoning step{message.meta.iterations === 1 ? '' : 's'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════ Architecture diagram ═══════ */
function AgentDiagram({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  const navigate = useNavigate();
  const liveAgents: Array<{ name: string; icon: React.ComponentType<{ className?: string }>; color: 'green' | 'blue'; href: string; hint: string }> = [
    { name: 'Pipeline & DQ', icon: ShieldCheck, color: 'green', href: '/monitor', hint: 'SLA + DQ status' },
    { name: 'Approvals', icon: FileSearch, color: 'green', href: '/reports', hint: 'Approval workflow' },
    { name: 'Cross-QRT', icon: GitCompare, color: 'green', href: '/monitor', hint: 'Reconciliation checks' },
    { name: 'Stochastic', icon: FlaskConical, color: 'green', href: '/report/s2606', hint: 'NL UW Risk model' },
    { name: 'AI/BI Genie', icon: Database, color: 'blue', href: '/genie', hint: 'Direct data Q&A' },
  ];
  const upcomingAgents = [
    { name: 'Reinsurance Audit', icon: Wrench },
    { name: 'ORSA Briefing', icon: FileSearch },
    { name: 'Capital Forecast', icon: Zap },
    { name: 'Sanctions Screening', icon: ShieldCheck },
    { name: 'Climate Risk', icon: Cloud },
    { name: 'Operational Resilience', icon: Anchor },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 bg-gradient-to-r from-violet-50 to-blue-50 border-b border-gray-200 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-bold text-gray-800">Supervisor agent architecture</span>
          <span className="text-[10px] text-gray-500">— how it brings everything together</span>
        </div>
        {show ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {show && (
        <div className="p-6">
          {/* Top: Supervisor */}
          <div className="flex justify-center mb-4">
            <div className="rounded-xl border-2 border-violet-400 bg-violet-50 px-5 py-3 text-center shadow-sm">
              <div className="flex items-center justify-center gap-2">
                <Bot className="w-5 h-5 text-violet-700" />
                <span className="text-sm font-bold text-violet-900">Regulatory AI Supervisor</span>
              </div>
              <div className="text-[10px] text-violet-600 mt-0.5">Decides which tools to call · synthesises the answer</div>
            </div>
          </div>

          {/* Connector */}
          <div className="flex justify-center mb-1">
            <div className="w-px h-6 bg-gradient-to-b from-violet-400 to-gray-200"></div>
          </div>

          {/* Live tier */}
          <div className="text-[10px] uppercase font-bold tracking-wide text-gray-500 text-center mb-2">Active tools</div>
          <div className="grid grid-cols-5 gap-3 mb-6">
            {liveAgents.map((agent) => {
              const colorClass = agent.color === 'blue'
                ? 'border-blue-300 bg-blue-50/50 hover:border-blue-500 hover:bg-blue-100/60'
                : 'border-green-300 bg-green-50/50 hover:border-green-500 hover:bg-green-100/60';
              const iconClass = agent.color === 'blue' ? 'text-blue-600' : 'text-green-600';
              const labelClass = agent.color === 'blue' ? 'text-blue-900' : 'text-green-900';
              const subClass = agent.color === 'blue' ? 'text-blue-500' : 'text-green-700';
              return (
                <button
                  key={agent.name}
                  onClick={() => navigate(agent.href)}
                  title={`Open: ${agent.hint}`}
                  className={`group rounded-lg border-2 ${colorClass} p-3 text-center transition-all relative cursor-pointer`}
                >
                  <ExternalLink className={`w-3 h-3 ${iconClass} absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <agent.icon className={`w-5 h-5 ${iconClass} mx-auto mb-1`} />
                  <div className={`text-xs font-semibold ${labelClass}`}>{agent.name}</div>
                  <div className={`text-[10px] ${subClass} mt-0.5`}>{agent.hint}</div>
                </button>
              );
            })}
          </div>

          {/* Upcoming tier */}
          <div className="border-t border-dashed border-gray-200 pt-4">
            <div className="text-[10px] uppercase font-bold tracking-wide text-gray-400 text-center mb-2">
              Coming soon — under construction
            </div>
            <div className="grid grid-cols-6 gap-2">
              {upcomingAgents.map((agent) => (
                <div key={agent.name} className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-2 text-center opacity-60">
                  <agent.icon className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                  <div className="text-[10px] font-medium text-gray-500 leading-tight">{agent.name}</div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-gray-500 text-center mt-4 italic">
            Each tool runs as a registered Mosaic AI agent — versioned in Unity Catalog, traced via MLflow,
            governed by AI Gateway guardrails.
          </p>
        </div>
      )}
    </div>
  );
}

