import React from 'react';

export default function MapIntelligenceView({ maps = [] }) {
  if (!maps || maps.length === 0) {
    return (
      <div className="bg-[#0d111d] border border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-xs">
        No map telemetry recorded.
      </div>
    );
  }

  // Group maps by mode
  const modes = {};
  maps.forEach((m) => {
    const modeName = m.mode || "Standard Modes";
    if (!modes[modeName]) modes[modeName] = [];
    modes[modeName].push(m);
  });

  return (
    <div className="space-y-6 select-none text-left">
      {Object.keys(modes).map((modeName) => (
        <div key={modeName} className="bg-[#0d111d] border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <span>🗺️</span>
              <span>{modeName} INTEL</span>
            </h3>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase">
              {modes[modeName].length} Maps
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {modes[modeName].map((m, i) => {
              const wr = m.win_rate ?? 50.0;
              const matches = m.matches || m.games || 0;
              const kda = m.kda || "--";

              return (
                <div key={i} className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white text-sm">{m.map_name || m.name || m.map}</span>
                    <span className="font-mono font-bold text-emerald-400">{wr}% WR</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" 
                      style={{ width: `${Math.min(100, Math.max(0, wr))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                    <span>{matches} matches played</span>
                    <span>KDA: <strong className="text-white">{kda}</strong></span>
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
