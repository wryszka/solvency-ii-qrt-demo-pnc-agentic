import { useEffect, useState, useRef } from 'react';
import {
  Loader2, Send, Bot, User, Shield, ChevronDown,
  CheckCircle2, AlertTriangle, MessageSquare, Building2, ExternalLink,
} from 'lucide-react';
import {
  fetchRegulatorExamples, askRegulatorQuestion, fetchEmbeds,
  type RegulatorExampleCategory, type RegulatorAnswer, type GuardrailVerdict,
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [genieUrl, setGenieUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRegulatorExamples()
      .then((r) => setExamples(r.examples))
      .catch((e) => console.error('Failed to fetch examples:', e));
    fetchEmbeds()
      .then((e) => setGenieUrl(e.genie_url.replace('/embed/genie/spaces/', '/genie/spaces/')))
      .catch(() => {});
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
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Regulatory AI</h2>
          <p className="text-sm text-gray-500 mt-1">
            Solvency II chatbot
            <span className="ml-2 text-[10px] font-medium text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full uppercase tracking-wide">Powered by Databricks Foundation Model API</span>
          </p>
        </div>
        {genieUrl && (
          <a href={genieUrl} target="_blank" rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />
            Query data with AI/BI Genie
          </a>
        )}
      </div>

      {/* Chat area */}
      <div className="bg-white rounded-lg border border-gray-200 flex flex-col" style={{ minHeight: '500px' }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: '600px' }}>
          {messages.length === 0 && !loading && (
            <div className="text-center py-8">
              <div className="inline-flex p-3 bg-violet-100 rounded-full mb-4">
                <Bot className="w-8 h-8 text-violet-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Solvency II Regulatory Chatbot</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto mb-4">
                Ask me anything about the company's regulatory reports — in plain English.
                I'll analyse the data and write you a clear answer.
              </p>

              {/* Two tools explanation */}
              <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto mb-6">
                <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <Bot className="w-4 h-4 text-violet-600" />
                    <span className="text-xs font-bold text-violet-800">This chatbot</span>
                  </div>
                  <p className="text-xs text-gray-600">Reads all QRT data and writes narrative answers, analysis, and regulator letters.</p>
                </div>
                {genieUrl && (
                  <a href={genieUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-left hover:bg-blue-100/50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <ExternalLink className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-blue-800">AI/BI Genie Room</span>
                    </div>
                    <p className="text-xs text-gray-600">Query the raw data directly — get tables, charts, and SQL. Opens in Databricks.</p>
                  </a>
                )}
              </div>

              {/* Example questions */}
              <div className="space-y-4 text-left max-w-lg mx-auto">
                {examples.map((cat) => (
                  <div key={cat.category}>
                    <h4 className="text-xs font-bold uppercase text-gray-400 tracking-wide mb-2">{cat.category}</h4>
                    <div className="space-y-1.5">
                      {cat.questions.map((q) => (
                        <button
                          key={q}
                          onClick={() => handleSend(q)}
                          className="w-full text-left px-3 py-2 rounded-lg border border-gray-100 hover:border-violet-200 hover:bg-violet-50/50 text-sm text-gray-700 hover:text-violet-700 transition-colors flex items-start gap-2"
                        >
                          <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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

        {/* Input */}
        <div className="border-t border-gray-200 p-3">
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about QRT data, draft a regulator response, prepare a board briefing..."
              className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              disabled={loading}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="p-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3" />
              <span>Guardrails active</span>
            </div>
            <span>|</span>
            <div className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              <span>Bricksurance SE</span>
            </div>
            <span>|</span>
            <span>Enter to send, Shift+Enter for newline</span>
          </div>
        </div>
      </div>
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
