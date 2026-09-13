import React from 'react';

export default function MatchupMatrixView({ matchups = [] }) {
  if (!matchups || matchups.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs bg-[#0d111d] border border-slate-800 rounded-2xl">
        No matchup encounter telemetry recorded.
      </div>
    );
  }

  const roles = ['Vanguard', 'Duelist', 'Strategist'];
  const ROLE_EMOJIS = {
    Vanguard: '🛡️',
    Duelist: '⚔️',
    Strategist: '💚'
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left select-none">
      {roles.map((role) => {
        const roleMatchups = matchups.filter(m => (m.role_category || m.enemy_role || m.role || 'General') === role);

        return (
          <div key={role} className="bg-[#0d111d] border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xl">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <span className="text-sm">{ROLE_EMOJIS[role] || '⚔️'}</span>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">{role} Matchups</h3>
            </div>
            <div className="flex flex-col gap-2">
              {roleMatchups.length === 0 ? (
                <div className="text-[11px] text-slate-400 p-2 italic">No {role.toLowerCase()} encounters</div>
              ) : (
                roleMatchups.map((m, idx) => {
                  const wr = m.win_rate ?? m.enemy_win_rate ?? 50.0;
                  const isPositive = wr >= 50;
                  return (
                    <div key={idx} className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{m.enemy_hero || m.hero || m.name}</span>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-[10px] text-slate-400">{m.wins || 0}W {m.losses || 0}L</span>
                        <span className={`text-xs font-black ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {wr}%
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
