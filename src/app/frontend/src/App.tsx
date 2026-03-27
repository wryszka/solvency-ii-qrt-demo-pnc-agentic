import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Building2, FileText, BarChart3, Activity, ShieldCheck, Bot, Code2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import Landing from './pages/Landing';
import Monitor from './pages/Monitor';
import ReportsList from './pages/ReportsList';
import ReportDetail from './pages/ReportDetail';
import DataQuality from './pages/DataQuality';
import Dashboard from './pages/Dashboard';
import Genie from './pages/Genie';
import RegulatorQA from './pages/RegulatorQA';

function NavLink({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  const { pathname } = useLocation();
  const active = pathname === to || (to !== '/' && pathname.startsWith(to));
  return (
    <Link
      to={to}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  );
}

function Nav() {
  return (
    <header className="bg-[#1e293b] text-white">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <FileText className="w-6 h-6 text-blue-400" />
            <div>
              <h1 className="text-lg font-bold tracking-tight">Solvency II</h1>
              <p className="text-xs text-gray-400">Reporting & Approval Dashboard</p>
            </div>
          </Link>
          <nav className="flex items-center gap-1 ml-4">
            <NavLink to="/monitor" icon={Activity} label="Monitor" />
            <NavLink to="/data-quality" icon={ShieldCheck} label="Data Quality" />
            <NavLink to="/reports" icon={FileText} label="Reports" />
            <NavLink to="/dashboard" icon={BarChart3} label="Dashboards" />
            <NavLink to="/regulator-qa" icon={Bot} label="Regulatory AI" />
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <Building2 className="w-4 h-4" />
          <span className="font-medium text-gray-300">Bricksurance SE</span>
          <BackstageLink />
        </div>
      </div>
    </header>
  );
}

function BackstageLink() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/backstage-url')
      .then((r) => r.json())
      .then((d) => { if (d.url) setUrl(d.url); })
      .catch(() => {});
  }, []);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      title="Backstage — technical deep dive notebook"
      className="p-1 rounded hover:bg-white/10 transition-colors opacity-30 hover:opacity-100">
      <Code2 className="w-4 h-4" />
    </a>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-100 font-[system-ui]">
        <Nav />
        <main>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/reports" element={<ReportsList />} />
            <Route path="/monitor" element={<Monitor />} />
            <Route path="/report/:qrtId" element={<ReportDetail />} />
            <Route path="/data-quality" element={<DataQuality />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/regulator-qa" element={<RegulatorQA />} />
            <Route path="/genie" element={<Genie />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
