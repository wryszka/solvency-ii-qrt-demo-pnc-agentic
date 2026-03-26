import { useEffect, useState, useRef } from 'react';
import {
  Loader2, Send, Bot, User, Shield, ChevronDown,
  CheckCircle2, AlertTriangle, MessageSquare, Database,
} from 'lucide-react';
import {
  fetchRegulatorExamples, askRegulatorQuestion, askGenie,
  type RegulatorExampleCategory, type RegulatorAnswer, type GuardrailVerdict,
  // GenieResponse type used inline
} from '../lib/api';
import { renderMarkdownSafe } from '../lib/markdown';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  meta?: {
    model_used: string;
    tokens: number;
    period: string;
    guardrails?: GuardrailVerdict;
  };
}

export default function RegulatorQA() {
  const [examples, setExamples] = useState<RegulatorExampleCategory[]>([]);
  const [genieExamples, setGenieExamples] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRegulatorExamples()
      .then((r: { examples: RegulatorExampleCategory[]; genie_examples?: string[] }) => {
        setExamples(r.examples);
        setGenieExamples(r.genie_examples || []);
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
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setLoading(true);
    setElapsed(0);

    try {
      const result: RegulatorAnswer = await askRegulatorQuestion(q);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.answer,
          meta: {
            model_used: result.model_used,
            tokens: result.input_tokens + result.output_tokens,
            period: result.reporting_period,
            guardrails: result.guardrails,
          },
        },
      ]);
    } catch (e: unknown) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${(e as Error).message}` },
      ]);
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
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Regulatory AI</h2>
        <p className="text-sm text-gray-500 mt-1">
          Solvency II chatbot
          <span className="ml-2 text-[10px] font-medium text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full uppercase tracking-wide">Powered by Databricks Foundation Model API + AI/BI Genie</span>
        </p>
      </div>

      {/* Regulatory Chatbot */}
      <div className="bg-white rounded-lg border-2 border-violet-200 overflow-hidden">
        <div className="px-4 py-3 bg-violet-50 border-b border-violet-200 flex items-center gap-2">
          <Bot className="w-5 h-5 text-violet-600" />
          <div>
            <span className="text-sm font-bold text-violet-900">Regulatory Chatbot</span>
            <span className="ml-2 text-[10px] text-violet-500">Writes analysis, letters, briefings</span>
          </div>
        </div>

        {/* Messages */}
        <div className="overflow-y-auto p-4 space-y-3" style={{ maxHeight: '400px' }}>
          {messages.length === 0 && !loading && (
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
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-violet-100 rounded-full">
                <Bot className="w-4 h-4 text-violet-600" />
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-600 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                Analysing QRT data... ({elapsed}s)
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input inside the chatbot block */}
        <div className="border-t border-violet-200 p-3 bg-violet-50/30">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about QRT data, draft a regulator response..."
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

      {/* Genie section */}
      <GeniePane examples={genieExamples} />
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const [showGuardrails, setShowGuardrails] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`p-1.5 rounded-full shrink-0 ${isUser ? 'bg-blue-100' : 'bg-violet-100'}`}>
        {isUser ? <User className="w-4 h-4 text-blue-600" /> : <Bot className="w-4 h-4 text-violet-600" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div className={`rounded-lg px-4 py-3 text-sm ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-50 text-gray-800'
        }`}>
          {isUser ? (
            message.content
          ) : (
            <div className="prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdownSafe(message.content) }}
            />
          )}
        </div>
        {message.meta && (
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
            <span>{message.meta.model_used}</span>
            <span>|</span>
            <span>{message.meta.tokens} tokens</span>
            <span>|</span>
            <span>{message.meta.period}</span>
            {message.meta.guardrails && (
              <>
                <span>|</span>
                <button
                  onClick={() => setShowGuardrails(!showGuardrails)}
                  className="flex items-center gap-1 hover:text-gray-600"
                >
                  <Shield className="w-3 h-3" />
                  {message.meta.guardrails.checks_passed}/{message.meta.guardrails.checks_run}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showGuardrails ? 'rotate-180' : ''}`} />
                </button>
              </>
            )}
          </div>
        )}
        {showGuardrails && message.meta?.guardrails && (
          <div className="mt-1 p-2 bg-gray-50 rounded text-xs space-y-0.5">
            {message.meta.guardrails.warnings.length === 0 && message.meta.guardrails.failures.length === 0 ? (
              <div className="flex items-center gap-1 text-green-700"><CheckCircle2 className="w-3 h-3" />All guardrail checks passed</div>
            ) : (
              <>
                {message.meta.guardrails.failures.map((f, i) => (
                  <div key={i} className="flex items-center gap-1 text-red-700"><AlertTriangle className="w-3 h-3" />{f}</div>
                ))}
                {message.meta.guardrails.warnings.map((w, i) => (
                  <div key={i} className="flex items-center gap-1 text-amber-700"><AlertTriangle className="w-3 h-3" />{w}</div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════ Genie Pane ═══════ */
function GeniePane({ examples }: { examples: string[] }) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ answer: string; sql: string | null; columns: string[]; rows: (string | null)[][] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk(q?: string) {
    const query = (q || question).trim();
    if (!query || loading) return;
    setQuestion('');
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await askGenie(query);
      setResult(r);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border-2 border-blue-200 bg-blue-50/30 p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Database className="w-5 h-5 text-blue-600" />
        <div>
          <div className="text-sm font-bold text-blue-900">AI/BI Genie</div>
          <div className="text-[10px] text-blue-500">Returns tables, charts, SQL queries</div>
        </div>
      </div>

      {!result && !loading && !error && (
        <div className="space-y-1 mb-3">
          {examples.map((q) => (
            <button
              key={q}
              onClick={() => handleAsk(q)}
              className="w-full text-left px-2.5 py-1.5 rounded-md border border-blue-100 hover:border-blue-300 hover:bg-blue-100/50 text-xs text-gray-700 hover:text-blue-800 transition-colors flex items-start gap-1.5"
            >
              <MessageSquare className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />
              {q}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex-1 flex items-center justify-center py-8">
          <div className="text-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
            <p className="text-xs text-gray-500 mt-2">Querying data...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-700 mb-3">{error}</div>
      )}

      {result && (
        <div className="flex-1 space-y-2 mb-3">
          {/* Answer text */}
          <p className="text-xs text-gray-700">{result.answer}</p>

          {/* SQL */}
          {result.sql && (
            <details className="text-xs">
              <summary className="text-blue-600 cursor-pointer font-medium">Show SQL</summary>
              <pre className="mt-1 p-2 bg-gray-900 text-green-300 rounded text-[10px] overflow-x-auto">{result.sql}</pre>
            </details>
          )}

          {/* Data table */}
          {result.columns.length > 0 && result.rows.length > 0 && (
            <div className="overflow-x-auto max-h-48 border border-blue-200 rounded">
              <table className="min-w-full text-[10px]">
                <thead className="bg-blue-50 sticky top-0">
                  <tr>
                    {result.columns.map((col) => (
                      <th key={col} className="px-2 py-1 text-left font-semibold text-blue-800 border-b whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-blue-50/30'}>
                      {row.map((val, j) => (
                        <td key={j} className="px-2 py-1 border-b border-blue-100 whitespace-nowrap font-mono text-gray-700">
                          {val ?? <span className="text-gray-300">null</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button onClick={() => setResult(null)} className="text-[10px] text-blue-600 hover:text-blue-700 font-medium">
            Ask another question
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-1.5 mt-auto">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          placeholder="Ask about your data..."
          disabled={loading}
          className="flex-1 border border-blue-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <button
          onClick={() => handleAsk()}
          disabled={loading || !question.trim()}
          className="px-2.5 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-xs"
        >
          <Send className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
