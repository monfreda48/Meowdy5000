import React from 'react';

export default function MapIntelligenceView({ maps = [] }) {
  if (!maps || maps.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs bg-[#0d111d] border border-slate-800 rounded-2xl">
        No map performance telemetry available.
      </div>
    );
  }

  const modes = Array.from(new Set(maps.map(m => m.mode || 'Standard Modes')));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left select-none">
      {modes.map((mode) => (
        <div key={mode} className="bg-[#0d111d] border border-slate-800 rounded-2xl p-4 shadow-xl">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2 mb-3 flex items-center gap-2">
            <span>🗺️</span>
            <span>{mode} MAPS</span>
          </h3>
          <div className="flex flex-col gap-2">
            {maps.filter(m => (m.mode || 'Standard Modes') === mode).map((m, idx) => {
              const wr = m.win_rate ?? 50.0;
              const matches = m.matches || m.games || 0;
              const kda = m.kda || "--";

              return (
                <div key={idx} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-white">{m.map_name || m.name || m.map}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{matches} matches · {m.time_played || '--'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-emerald-400 font-mono">{wr}%</div>
                    <div className="text-[10px] text-slate-400 font-mono">{kda !== "--" ? `${kda} KDA` : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
