import { useEffect, useState } from 'react';
import { Loader2, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import { fetchEmbeds } from '../lib/api';

export default function Genie() {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    fetchEmbeds()
      .then((e) => {
        // Embed URL for iframe
        setEmbedUrl(e.genie_url);
        // Direct URL for "Open in Databricks" fallback
        setDirectUrl(e.genie_url.replace('/embed/genie/spaces/', '/genie/spaces/'));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className={`${fullscreen ? 'fixed inset-0 z-50 bg-white' : 'max-w-6xl mx-auto p-6 space-y-4'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between ${fullscreen ? 'px-4 py-2 border-b border-gray-200 bg-gray-50' : ''}`}>
        <div>
          <h2 className={`font-bold text-gray-900 ${fullscreen ? 'text-lg' : 'text-2xl'}`}>Ask AI</h2>
          {!fullscreen && (
            <p className="text-sm text-gray-500 mt-1">
              Ask questions about QRT data in natural language — get tables and charts
              <span className="ml-2 text-[10px] font-medium text-violet-600 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full uppercase tracking-wide">Powered by Databricks AI/BI Genie</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {directUrl && (
            <a href={directUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50">
              <ExternalLink className="w-3.5 h-3.5" /> Open in Databricks
            </a>
          )}
          <button onClick={() => setFullscreen(!fullscreen)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50">
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </div>

      {/* Embedded Genie */}
      {embedUrl ? (
        <div className={`${fullscreen ? 'h-[calc(100vh-52px)]' : 'rounded-lg border border-gray-200 overflow-hidden'}`}
          style={fullscreen ? {} : { height: '700px' }}>
          <iframe
            src={embedUrl}
            className="w-full h-full border-0"
            title="Databricks Genie"
            allow="fullscreen"
          />
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Genie space not configured. Set the GENIE_SPACE_ID environment variable.
        </div>
      )}
    </div>
  );
}
