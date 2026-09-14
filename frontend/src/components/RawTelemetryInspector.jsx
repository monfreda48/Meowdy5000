import React, { useState } from 'react';

export default function RawTelemetryInspector({ isOpen, onClose, rawTelemetry = {} }) {
  const [activeTab, setActiveTab] = useState('tracker_gg');
  const [filterQuery, setFilterQuery] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const providers = [
    { id: 'tracker_gg', name: 'Tracker.gg' },
    { id: 'rivals_tracker', name: 'RivalsTracker' },
    { id: 'rivals_meta', name: 'RivalsMeta' },
    { id: 'rivals_data', name: 'RivalsData' }
  ];

  const currentPayload = rawTelemetry[activeTab] || { status: 'No data or query initiated' };

  // Filter JSON keys if query provided
  let displayJson = JSON.stringify(currentPayload, null, 2);
  if (filterQuery.trim()) {
    try {
      const q = filterQuery.toLowerCase().strip ? filterQuery.toLowerCase().strip() : filterQuery.toLowerCase();
      const lines = displayJson.split('\n');
      const filteredLines = lines.filter(line => line.toLowerCase().includes(q));
      if (filteredLines.length > 0) {
        displayJson = `// Filtered for key/value: "${filterQuery}" (${filteredLines.length} lines matched)\n` + filteredLines.join('\n');
      } else {
        displayJson = `// No keys or values matching "${filterQuery}" found in ${activeTab} payload.`;
      }
    } catch (e) {
      // keep original displayJson
    }
  }

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(currentPayload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[999999] bg-black/70 backdrop-blur-md flex justify-end animate-in fade-in duration-200 modal-safe-area select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[var(--theme-surface-1)] text-[var(--theme-text)] border-l border-[var(--theme-border)] h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-300 relative drawer-safe-area"
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-[var(--theme-border)] space-y-3">
          <div className="flex items-center justify-between text-left">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔬</span>
              <div>
                <h3 className="text-base font-black uppercase tracking-wider text-white">Raw Telemetry Inspector</h3>
                <p className="text-[11px] text-[var(--theme-subtext)]">Direct 4-provider raw payload verification</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-[var(--theme-surface-2)] hover:bg-[var(--theme-surface-3)] text-slate-300 hover:text-white flex items-center justify-center font-bold text-sm transition-all cursor-pointer border border-[var(--theme-border)]"
            >
              ✕
            </button>
          </div>

          {/* Provider Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {providers.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveTab(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border shrink-0 cursor-pointer ${
                  activeTab === p.id
                    ? 'bg-[var(--theme-accent)] text-slate-950 border-[var(--theme-accent)] shadow-md'
                    : 'bg-[var(--theme-surface-2)] text-[var(--theme-subtext)] border-[var(--theme-border)] hover:bg-[var(--theme-surface-3)] hover:text-white'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* Real-time Search Filter & Copy Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Search keys (e.g. damage, teammates, peak_score)..."
                className="w-full bg-[var(--theme-surface-2)] border border-[var(--theme-border)] focus:border-[var(--theme-accent)] text-white px-3 py-1.5 pl-8 rounded-lg text-xs outline-none transition-all placeholder-[var(--theme-text-muted)] font-mono"
              />
              <span className="absolute left-2.5 top-2 text-[var(--theme-text-muted)] text-xs">🔍</span>
            </div>
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0"
            >
              {copied ? '✓ Copied' : '📋 Copy JSON'}
            </button>
          </div>
        </div>

        {/* Formatted JSON Body */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-left bg-[var(--theme-bg)]">
          <pre className="text-emerald-300 whitespace-pre-wrap break-words leading-relaxed selection:bg-emerald-500/30 selection:text-white">
            {displayJson}
          </pre>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[var(--theme-border)] bg-[var(--theme-surface-1)] text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[var(--theme-surface-2)] hover:bg-[var(--theme-surface-3)] text-white font-bold text-xs uppercase tracking-wider border border-[var(--theme-border)] cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
