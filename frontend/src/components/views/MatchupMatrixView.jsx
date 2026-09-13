import React from 'react';

export default function MatchupMatrixView({ matchups = [] }) {
  if (!matchups || matchups.length === 0) {
    return (
      <div className="bg-[#0d111d] border border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-xs">
        No enemy matchup telemetry recorded.
      </div>
    );
  }

  // Group matchups by role if available, or list all
  const categories = {};
  matchups.forEach((m) => {
    const role = m.role || "General Opponents";
    if (!categories[role]) categories[role] = [];
    categories[role].push(m);
  });

  return (
    <div className="space-y-6 select-none text-left">
      {Object.keys(categories).map((catName) => (
        <div key={catName} className="bg-[#0d111d] border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h3 className="text-xs font-extrabold text-white uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
            <span>🛡️</span>
            <span>{catName} MATCHUPS</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories[catName].map((m, i) => {
              const wr = m.win_rate ?? m.enemy_win_rate ?? 50.0;
              const isHighThreat = wr < 50;
              const games = m.games || m.total_games || m.matches || 0;
              const record = m.record || `${m.wins || 0}W ${m.losses || 0}L`;

              return (
                <div key={i} className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-bold text-white text-sm block">{m.enemy_hero || m.hero || m.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      Record: {record} ({games} games)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${isHighThreat ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
                      {wr}% Win
                    </span>
                    <span className="text-[9px] text-slate-500 block mt-1 font-semibold">
                      {isHighThreat ? '⚠️ HIGH THREAT' : '✓ FAVORABLE'}
                    </span>
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
