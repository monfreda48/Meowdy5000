import React from 'react';

export default function HeroProgression({ heroes = [], roles = [], mode = "Quick Play", season = "Season 10" }) {
  if (!heroes || heroes.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#0d111d] border border-slate-800 rounded-2xl p-5 mb-6 shadow-xl text-left select-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-sm">👑</span>
            <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
              HERO PERFORMANCE & COMBAT METRICS
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Live telemetry parsed from RivalsMeta ({mode})
          </p>
        </div>
        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 uppercase tracking-wide">
          {mode || season}
        </span>
      </div>

      {/* Role Summary Badges */}
      {roles && roles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {roles.map((r, i) => (
            <div key={i} className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
              <span className="font-bold text-white">{r.role}</span>
              <span className="font-mono text-slate-300">
                {r.win_rate}% <span className="text-slate-400 text-[10px]">({r.wins}W {r.losses}L)</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Hero Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {heroes.map((h, idx) => {
          const heroName = h.hero || h.hero_name || "Unknown";
          const matches = h.matches || 0;
          const winRate = h.win_rate || (h.win_rate_val ? `${h.win_rate_val}%` : "0%");
          const kda = h.kda || "--";
          const playtime = h.time_played || "--";
          const avatar = h.avatar || "";

          return (
            <div key={idx} className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/60 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {avatar ? (
                    <img src={avatar} alt={heroName} className="w-10 h-10 rounded-lg border border-slate-700 object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-white border border-slate-700">
                      {heroName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">{heroName}</h3>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {playtime}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-400">{winRate}</div>
                  <div className="text-[10px] text-slate-400">{matches} {matches === 1 ? 'match' : 'matches'}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/60 text-center">
                <div>
                  <div className="text-[10px] text-slate-400">KDA</div>
                  <div className="text-xs font-bold text-white">{kda}</div>
                  {h.kda_split && <div className="text-[9px] text-slate-400 font-mono">{h.kda_split}</div>}
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Dmg / 10M</div>
                  <div className="text-xs font-bold text-sky-400">
                    {h.damage_10m ? h.damage_10m.toLocaleString() : `${h.damage_per_min || 0}/m`}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">Heal / 10M</div>
                  <div className="text-xs font-bold text-emerald-400">
                    {h.heal_10m ? h.heal_10m.toLocaleString() : `${h.heal_per_min || 0}/m`}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
