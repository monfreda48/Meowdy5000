import React, { useState } from 'react';

export default function HeroProgression({
  heroes = [],
  roles = [],
  mode = "Quick Play",
  season = "Season 10",
  expandAllHeroes: propExpandAllHeroes,
  setExpandAllHeroes: propSetExpandAllHeroes,
  showAllHeroesList: propShowAllHeroesList,
  setShowAllHeroesList: propSetShowAllHeroesList
}) {
  const [internalExpandAllHeroes, setInternalExpandAllHeroes] = useState(false);
  const [internalShowAllHeroesList, setInternalShowAllHeroesList] = useState(false);
  const [expandedHeroId, setExpandedHeroId] = useState(null);

  const expandAllHeroes = propExpandAllHeroes !== undefined ? propExpandAllHeroes : internalExpandAllHeroes;
  const setExpandAllHeroes = propSetExpandAllHeroes || setInternalExpandAllHeroes;

  const showAllHeroesList = propShowAllHeroesList !== undefined ? propShowAllHeroesList : internalShowAllHeroesList;
  const setShowAllHeroesList = propSetShowAllHeroesList || setInternalShowAllHeroesList;

  const heroList = heroes || [];
  if (heroList.length === 0) {
    return null;
  }

  const displayedHeroes = showAllHeroesList ? heroList : heroList.slice(0, 5);

  return (
    <div className="bg-[#0d111d] border border-slate-800 rounded-2xl p-5 mb-6 shadow-xl text-left select-none">
      {/* Header with Expand All / Collapse All Controls */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-sm">👑</span>
            <h2 className="text-xs font-extrabold text-white uppercase tracking-wider">
              TOP HEROES & COMBAT METRICS
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">
            Live telemetry parsed from RivalsMeta ({mode})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 uppercase tracking-wide">
            {mode || season}
          </span>
          <button
            type="button"
            onClick={() => setExpandAllHeroes(!expandAllHeroes)}
            className="text-[10px] font-bold uppercase tracking-wider text-[var(--theme-accent-text)] hover:text-white transition-colors cursor-pointer px-2 py-1 rounded bg-[var(--theme-surface-2)] border border-[var(--theme-border)]"
          >
            {expandAllHeroes ? '▲ Collapse All' : '▼ Expand All'}
          </button>
        </div>
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

      {/* Interactive Top Heroes Roster */}
      <div className="space-y-2">
        {displayedHeroes.map((hero, idx) => {
          const heroName = hero.hero || hero.hero_name || hero.name || `Hero #${idx + 1}`;
          const heroKey = hero.id || heroName || idx;
          const isHeroExpanded = expandAllHeroes || expandedHeroId === heroKey;
          return (
            <div key={heroKey} className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface-2)] overflow-hidden text-left transition-all">
              <button
                type="button"
                onClick={() => setExpandedHeroId(isHeroExpanded && !expandAllHeroes ? null : heroKey)}
                className="w-full flex items-center justify-between p-2.5 hover:bg-[var(--theme-surface-3)] transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded bg-[var(--theme-surface-3)] border border-[var(--theme-border)] text-[10px] font-mono font-bold flex items-center justify-center text-[var(--theme-accent-text)] shrink-0">
                    {idx + 1}
                  </span>
                  {(hero.avatar_url || hero.avatar) && (
                    <img src={hero.avatar_url || hero.avatar} alt={heroName} className="w-6 h-6 rounded-full border border-[var(--theme-border)] object-cover shrink-0" />
                  )}
                  <span className="text-xs font-bold text-white tracking-wide">{heroName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    {hero.win_rate || (hero.win_rate_val ? `${hero.win_rate_val}%` : '--')}
                  </span>
                  <span className="text-[10px] text-[var(--theme-subtext)] font-mono">
                    {isHeroExpanded ? '▲' : '▼'}
                  </span>
                </div>
              </button>

              {/* Expanded Hero Substats */}
              {isHeroExpanded && (
                <div className="p-3 border-t border-[var(--theme-border)] bg-[var(--theme-surface-1)] grid grid-cols-3 gap-2 text-center text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                  <div>
                    <span className="text-[9px] uppercase text-[var(--theme-subtext)] block">Matches</span>
                    <span className="font-bold text-white font-mono">{hero.matches || hero.matches_played || hero.total_matches || '--'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-[var(--theme-subtext)] block">Win Rate</span>
                    <span className="font-bold text-white font-mono">{hero.win_rate || (hero.win_rate_val ? `${hero.win_rate_val}%` : '--')}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase text-[var(--theme-subtext)] block">K/D</span>
                    <span className="font-bold text-white font-mono">{hero.kda || hero.kd || '--'}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {heroList.length > 5 && (
        <button
          type="button"
          onClick={() => setShowAllHeroesList(!showAllHeroesList)}
          className="w-full py-1.5 mt-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-2)] text-[10px] font-bold uppercase tracking-wider text-[var(--theme-subtext)] hover:text-white hover:border-[var(--theme-accent)] transition-all cursor-pointer"
        >
          {showAllHeroesList ? 'Show Top 5 Only' : `View All ${heroList.length} Heroes`}
        </button>
      )}
    </div>
  );
}
