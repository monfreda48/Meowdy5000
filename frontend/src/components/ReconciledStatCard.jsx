import React, { useState } from 'react';

export default function ReconciledStatCard({ label, statObj, icon: Icon, iconEmoji, unit = '' }) {
  if (!statObj) return null;

  const { sources = {}, has_divergence = false } = statObj;
  const sourceKeys = Object.keys(sources);
  const [selectedSource, setSelectedSource] = useState(sourceKeys[0] || 'RivalsData');
  const [isExpanded, setIsExpanded] = useState(false);

  const currentValue = sources[selectedSource] ?? statObj.value ?? '--';

  return (
    <div 
      onClick={() => has_divergence && setIsExpanded(!isExpanded)}
      className={`bg-[#0d111d] border rounded-2xl p-4 transition-all duration-200 ${
        has_divergence ? 'cursor-pointer hover:border-emerald-500/60' : ''
      } border-slate-800 shadow-xl text-left select-none`}
    >
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
          {Icon ? <Icon className="w-4 h-4 text-emerald-400"/> : (iconEmoji ? <span>{iconEmoji}</span> : null)}
          <span>{label}</span>
        </div>
        {has_divergence && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30 tracking-wider flex items-center gap-1">
            <span>⚡</span>
            <span>{isExpanded ? 'Collapse' : `${sourceKeys.length} Sources`}</span>
          </span>
        )}
      </div>

      <div className="text-2xl font-black text-white tabular-nums tracking-tight">
        {currentValue}{unit}
      </div>

      {/* Expanded Comparison Tray */}
      {has_divergence && isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col gap-1.5 text-xs animate-in fade-in duration-200">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Source Telemetry (tap to select):</span>
          <div className={`grid ${sourceKeys.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mt-1`}>
            {sourceKeys.map((src) => (
              <button
                key={src}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSource(src);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-left border transition-all cursor-pointer ${
                  selectedSource === src
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{src}</div>
                <div className="font-extrabold text-white text-xs">{sources[src]}{unit}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
