import { useNavigate } from 'react-router-dom';
import { ArrowRight, Activity, ShieldCheck, FileText, BarChart3, Bot } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  const sections = [
    { icon: Activity, label: 'Monitor', desc: 'Control Tower — feed status, SLA, reconciliation', path: '/monitor' },
    { icon: ShieldCheck, label: 'Data Quality', desc: 'DLT expectation results across all pipelines', path: '/data-quality' },
    { icon: FileText, label: 'Reports', desc: '4 QRT templates with AI-powered review', path: '/reports' },
    { icon: BarChart3, label: 'Dashboards', desc: 'Quarterly comparison dashboard', path: '/dashboard' },
    { icon: Bot, label: 'Regulatory AI', desc: 'Chatbot + Genie — analysis and data queries', path: '/regulator-qa' },
  ];

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      {/* Hero */}
      <div className="text-center pt-6">
        <h2 className="text-3xl font-bold text-gray-900">Solvency II Reporting & Approval</h2>
        <p className="text-base text-gray-500 mt-2">Regulatory reporting platform with AI-powered actuarial review</p>
      </div>

      {/* Disclaimer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <h3 className="text-sm font-bold text-blue-900 mb-2">About this demo</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          This application is not a Databricks product — it is a working demonstration of what can be built
          on the Databricks platform. All processes shown here are real and running: the data pipelines,
          quality checks, AI agents, model governance, and approval workflows all execute on Databricks
          infrastructure using Declarative Pipelines, Unity Catalog, Foundation Model API, and Databricks Apps.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-2">
          The data is synthetic. The regulatory templates, actuarial logic, and AI agent prompts are
          illustrative and should not be relied upon for actual regulatory submissions.
        </p>
        <p className="text-sm text-gray-600 mt-2 italic">
          The source code is available on GitHub and can be deployed to any Databricks workspace.
          It is provided as-is for demonstration and learning purposes — not for production use.
        </p>
      </div>

      {/* Navigation cards */}
      <div className="grid gap-3">
        {sections.map((s) => (
          <button
            key={s.path}
            onClick={() => navigate(s.path)}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-left group"
          >
            <div className="p-2.5 rounded-lg bg-gray-50 text-gray-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
              <s.icon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-900">{s.label}</div>
              <div className="text-sm text-gray-500">{s.desc}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}
