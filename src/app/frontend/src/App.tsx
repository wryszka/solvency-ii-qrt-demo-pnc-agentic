import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Building2, FileText, BarChart3, Activity, ShieldCheck, Bot, Code2, Home } from 'lucide-react';
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
      className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
        active ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-[#1e293b] text-white flex flex-col">
      {/* Brand */}
      <Link to="/" className="flex items-center gap-3 px-4 py-4 border-b border-white/10 hover:opacity-90 transition-opacity">
        <FileText className="w-6 h-6 text-blue-400 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-base font-bold tracking-tight truncate">Solvency II</h1>
          <p className="text-[10px] text-gray-400 truncate">Reporting & Approval</p>
        </div>
      </Link>

      {/* Nav links */}
      <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
        <NavLink to="/" icon={Home} label="Home" />
        <NavLink to="/monitor" icon={Activity} label="Monitor" />
        <NavLink to="/data-quality" icon={ShieldCheck} label="Data Quality" />
        <NavLink to="/reports" icon={FileText} label="Reports" />
        <NavLink to="/dashboard" icon={BarChart3} label="Dashboards" />
        <NavLink to="/regulator-qa" icon={Bot} label="Regulatory AI" />
      </nav>

      {/* Footer — entity + backstage */}
      <div className="border-t border-white/10 p-3 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium text-gray-300 truncate">Bricksurance SE</span>
        </div>
        <BackstageLink />
      </div>
    </aside>
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
        <Sidebar />
        <main className="ml-56">
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
