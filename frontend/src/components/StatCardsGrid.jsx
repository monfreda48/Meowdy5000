import React from 'react';

export default function StatCardsGrid({ stats, extendedMetrics = {}, squadmates = [], matchups = [] }) {
  if (!stats) return null;

  const currentRank = stats.current_rank || stats.currentRank || stats.rank || 'Unranked';
  const winRate = stats.win_rate || stats.winRate || '0%';
  const kda = stats.kda || stats.kda_ratio || '0.0';
  const dmg10m = stats.hero_damage_10m || stats.heroDamage || stats.damagePer10m || '0';
  const heal10m = stats.healing_10m || stats.healing || stats.healingPer10m || '0';

  const extKeys = Object.keys(extendedMetrics || {});

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Primary Canonical Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Card 1: Rank */}
        <div className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] p-4 rounded-2xl shadow-md text-left transition-all hover:border-[var(--theme-border-hover)]">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--theme-subtext)]">Current Rank</p>
          <p className="text-base sm:text-lg font-black text-[var(--theme-accent)] mt-1 truncate">{currentRank}</p>
          <p className="text-[10px] text-[var(--theme-text-muted)] mt-0.5">{stats.rank_score || 'Competitive'}</p>
        </div>

        {/* Card 2: Win Rate */}
        <div className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] p-4 rounded-2xl shadow-md text-left transition-all hover:border-[var(--theme-border-hover)]">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--theme-subtext)]">Win Rate</p>
          <p className="text-base sm:text-lg font-black text-emerald-400 mt-1">{winRate}</p>
          <p className="text-[10px] text-[var(--theme-text-muted)] mt-0.5">{stats.matchesPlayed || stats.total_matches || 0} Matches</p>
        </div>

        {/* Card 3: KDA */}
        <div className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] p-4 rounded-2xl shadow-md text-left transition-all hover:border-[var(--theme-border-hover)]">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--theme-subtext)]">KDA Ratio</p>
          <p className="text-base sm:text-lg font-black text-amber-400 mt-1">{kda}</p>
          <p className="text-[10px] text-[var(--theme-text-muted)] mt-0.5">Combat Efficiency</p>
        </div>

        {/* Card 4: Damage/10m */}
        <div className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] p-4 rounded-2xl shadow-md text-left transition-all hover:border-[var(--theme-border-hover)]">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--theme-subtext)]">Hero Damage / 10m</p>
          <p className="text-base sm:text-lg font-black text-rose-400 mt-1">{typeof dmg10m === 'number' ? dmg10m.toLocaleString() : dmg10m}</p>
          <p className="text-[10px] text-[var(--theme-text-muted)] mt-0.5">Canonical 10m Rate</p>
        </div>

        {/* Card 5: Healing/10m */}
        <div className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] p-4 rounded-2xl shadow-md text-left transition-all hover:border-[var(--theme-border-hover)]">
          <p className="text-[10px] font-black uppercase tracking-wider text-[var(--theme-subtext)]">Healing / 10m</p>
          <p className="text-base sm:text-lg font-black text-purple-400 mt-1">{typeof heal10m === 'number' ? heal10m.toLocaleString() : heal10m}</p>
          <p className="text-[10px] text-[var(--theme-text-muted)] mt-0.5">Canonical 10m Rate</p>
        </div>
      </div>

      {/* Dynamic Extended Telemetry Section */}
      {extKeys.length > 0 && (
        <div className="space-y-3 text-left">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--theme-subtext)] flex items-center gap-1.5">
              <span>⚡</span> Dynamic Extended Telemetry ({extKeys.length})
            </h3>
            <span className="text-[10px] font-mono text-[var(--theme-accent-text)] bg-[var(--theme-surface-2)] px-2 py-0.5 rounded-full border border-[var(--theme-border)]">
              Multi-Source Reconciled
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {extKeys.map((key) => {
              const item = extendedMetrics[key];
              if (!item) return null;
              return (
                <div key={key} className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-3.5 rounded-xl shadow-sm text-left">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--theme-subtext)] truncate">{item.label || key}</p>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[var(--theme-surface-3)] text-[var(--theme-text-muted)] border border-[var(--theme-border)]">
                      {item.source}
                    </span>
                  </div>
                  <p className="text-sm font-black text-white mt-1">{item.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Structured Squadmates & Hero Matchups */}
      {(squadmates.length > 0 || matchups.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          {/* Top Squadmates */}
          {squadmates.length > 0 && (
            <div className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] p-4 rounded-2xl space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--theme-subtext)] flex items-center gap-2">
                <span>🤝</span> Top Squadmates ({squadmates.length})
              </h4>
              <div className="space-y-2">
                {squadmates.slice(0, 4).map((mate, i) => (
                  <div key={i} className="flex items-center justify-between bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-2.5 rounded-xl text-xs">
                    <span className="font-bold text-white">{mate.name || mate.username || mate.player_name || `Teammate ${i+1}`}</span>
                    <span className="text-emerald-400 font-mono font-bold">{mate.win_rate || mate.winRate || `${mate.matches || 0} Games`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hero Matchups */}
          {matchups.length > 0 && (
            <div className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] p-4 rounded-2xl space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--theme-subtext)] flex items-center gap-2">
                <span>⚔️</span> Hero Matchups ({matchups.length})
              </h4>
              <div className="space-y-2">
                {matchups.slice(0, 4).map((m, i) => (
                  <div key={i} className="flex items-center justify-between bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-2.5 rounded-xl text-xs">
                    <span className="font-bold text-white">{m.hero || m.opponent || `Matchup ${i+1}`}</span>
                    <span className="text-amber-400 font-mono font-bold">{m.record || `${m.wins || 0}W - ${m.losses || 0}L`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
