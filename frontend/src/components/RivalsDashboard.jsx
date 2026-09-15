import React, { useState } from 'react';
import { Search, RefreshCw, Shield, Swords, BarChart3, Users, Map, Settings, Check, Flame, Award } from 'lucide-react';

export default function RivalsDashboard({
  stats = null,
  loading = false,
  claimedUid = null,
  season = '10',
  onSearch,
  onSync,
  onUnclaim,
  onClaim
}) {
  const [activeTab, setActiveTab] = useState('consensus');
  const [searchQuery, setSearchQuery] = useState('');

  const current = stats?.current || {};

  // Core Identity Telemetry
  const username = current.username || stats?.username || 'Unknown Player';
  const platform = (current.platform || stats?.platform || 'PC').toUpperCase();
  const uid = current.uid || stats?.uid || '--';
  const level = current.level ?? '--';
  const rank = current.rank || 'Unranked';
  const rankScore = current.rankScore || current.rank_score || current.score || null;
  const peakRank = current.peakRank || current.peak_rank || null;
  const mainHero = current.topHero || current.top_hero || current.main_hero || null;

  // Combat Telemetry
  const winRate = current.winRate || current.win_rate || '--';
  const wins = Number(current.matchesWon ?? current.wins ?? 0);
  const losses = Number(current.matchesLost ?? current.losses ?? 0);
  const totalMatches = Number(current.matchesPlayed ?? current.total_matches ?? current.matches ?? (wins + losses) ?? 0);

  const winPercent = totalMatches > 0 ? Math.min(100, Math.max(0, (wins / totalMatches) * 100)) : 0;
  const lossPercent = totalMatches > 0 ? Math.min(100 - winPercent, Math.max(0, (losses / totalMatches) * 100)) : 0;

  const kda = current.kda || current.kdRatio || current.avg_kda || '--';
  const kills = current.kills ?? current.total_kills ?? '--';
  const deaths = current.deaths ?? current.total_deaths ?? '--';
  const assists = current.assists ?? current.total_assists ?? '--';

  const dmg10m = current.heroDamage || current.damagePer10m || current.damage_per_10m || '--';
  const heal10m = current.healing || current.healingPer10m || current.healing_per_10m || '--';
  const block10m = current.damageBlocked || current.dmg_blocked_10m || '--';
  const playtime = current.timePlayed || current.totalSeasonPlaytime || current.seasonPlaytimeHours || '--';
  const mvps = current.mvps ?? current.mvp ?? 0;
  const svps = current.svps ?? current.svp ?? 0;

  // Tab Data Ingestion
  const heroesList = stats?.heroes || stats?.data?.heroes || stats?.tabs?.heroes || (mainHero ? [{ hero: mainHero, matches: totalMatches, win_rate: winRate, kda }] : []);
  const squadmates = stats?.top_squadmates || stats?.teammates || stats?.tabs?.matches_data?.teammates || [];
  const matchups = stats?.hero_matchups || stats?.matchups || [];

  // Dynamic 4-Site Consensus Cell Resolver
  const getSiteStat = (metricKey, siteKey, siteName) => {
    const recSources = stats?.reconciled_stats?.[metricKey]?.sources;
    if (recSources && typeof recSources === 'object') {
      const target = siteName.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [k, v] of Object.entries(recSources)) {
        if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === target) {
          if (v !== null && v !== undefined && v !== '' && v !== '--') return String(v);
        }
      }
    }

    const bucket = stats?.[siteKey];
    if (bucket && typeof bucket === 'object') {
      const val = bucket[metricKey] ?? bucket.summary?.[metricKey] ?? bucket.overview?.[metricKey];
      if (val !== null && val !== undefined && val !== '' && val !== '--') return String(val);
    }

    return '--';
  };

  // Competitive rank row removed as requested
  const consensusRows = [
    { label: 'Win Rate', metricKey: 'winRate', consensus: winRate },
    { label: 'KDA Ratio', metricKey: 'kda', consensus: kda },
    { label: 'Total Matches', metricKey: 'matchesPlayed', consensus: totalMatches > 0 ? String(totalMatches) : '--' },
    { label: 'Hero Damage / 10 Min', metricKey: 'heroDamage', consensus: dmg10m },
    { label: 'Healing / 10 Min', metricKey: 'healing', consensus: heal10m },
    { label: 'Damage Blocked / 10 Min', metricKey: 'damageBlocked', consensus: block10m }
  ];

  const isClaimed = Boolean(
    claimedUid &&
    (String(claimedUid).trim().toLowerCase() === String(uid).trim().toLowerCase() ||
     String(claimedUid).trim().toLowerCase() === String(username).trim().toLowerCase())
  );

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery.trim());
    }
  };

  return (
    <div className="w-full space-y-6 text-[var(--theme-text)] font-sans">
      {/* Top Search & Sync Bar */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-[var(--theme-border)]">
        <div className="flex items-center gap-3">
          <span className="bg-[var(--theme-accent)]/15 text-[var(--theme-accent)] border border-[var(--theme-accent)]/30 px-2.5 py-1 rounded-md text-xs font-black tracking-widest uppercase">
            M5
          </span>
          <h1 className="text-lg font-black tracking-wider uppercase text-[var(--theme-text)]">Rivals Tracker</h1>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 md:w-80">
            <input
              type="text"
              placeholder="Search UID or IGN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--theme-surface-2)] border border-[var(--theme-border)] rounded-xl px-3.5 py-2 pl-9 text-sm text-[var(--theme-text)] placeholder-[var(--theme-subtext)] focus:outline-none focus:border-[var(--theme-accent)] transition-colors"
            />
            <Search className="w-4 h-4 text-[var(--theme-subtext)] absolute left-3 top-2.5" />
          </form>

          <button
            type="button"
            onClick={onSync}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[var(--theme-surface-2)] hover:bg-[var(--theme-surface-1)] disabled:opacity-50 border border-[var(--theme-border)] rounded-xl text-xs font-bold text-[var(--theme-text)] transition-all cursor-pointer shadow-sm hover:border-[var(--theme-accent)]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[var(--theme-accent)]' : ''}`} />
            <span>{loading ? 'Syncing...' : 'Sync'}</span>
          </button>

          <span className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] text-[var(--theme-subtext)] text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap">
            ⏳ S{season} LIVE
          </span>
        </div>
      </header>

      {/* Tier 1: Identity Banner */}
      <section className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-[var(--theme-surface-2)] border border-[var(--theme-border)] flex items-center justify-center text-[var(--theme-subtext)] text-2xl font-bold">
              👤
            </div>
            <span className="absolute -top-2 -right-2 bg-[var(--theme-accent)] border border-[var(--theme-accent)]/50 text-[10px] font-black px-1.5 py-0.5 rounded-md text-slate-950 shadow-sm">
              {level}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-black text-[var(--theme-text)]">{username}</h2>
              <span className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] text-[var(--theme-subtext)] text-[11px] font-bold px-2 py-0.5 rounded uppercase">
                {platform}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-[var(--theme-subtext)]">
              <span>UID: {uid}</span>
              <span>•</span>
              {isClaimed ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                    <Check className="w-3 h-3" /> Profile Claimed
                  </span>
                  {onUnclaim && (
                    <button
                      type="button"
                      onClick={onUnclaim}
                      className="text-[var(--theme-subtext)] hover:text-[var(--theme-text)] ml-1 underline cursor-pointer text-[11px]"
                    >
                      Unclaim
                    </button>
                  )}
                </div>
              ) : (
                onClaim && (
                  <button
                    type="button"
                    onClick={() => onClaim(uid || username)}
                    className="text-[var(--theme-accent)] hover:underline font-bold cursor-pointer text-[11px]"
                  >
                    ★ Claim Profile
                  </button>
                )
              )}
            </div>

            {mainHero && (
              <p className="text-xs text-[var(--theme-subtext)]">
                Main Hero: <span className="font-bold text-[var(--theme-text)]">{mainHero}</span>
              </p>
            )}
          </div>
        </div>

        {/* Dynamic Rank Card */}
        <div className="w-full md:w-auto bg-[var(--theme-surface-2)] border border-[var(--theme-border)] rounded-xl p-4 flex flex-col items-start md:items-end justify-center min-w-[220px]">
          <div className="flex items-center gap-2">
            <span className="text-base">💎</span>
            <span className="text-sm font-black uppercase text-blue-400">{rank}</span>
            {rankScore && (
              <>
                <span className="text-[var(--theme-subtext)] text-xs">•</span>
                <span className="text-sm font-mono font-bold text-[var(--theme-text)]">{rankScore} RS</span>
              </>
            )}
          </div>
          {peakRank && (
            <p className="text-xs text-purple-400 font-semibold mt-1 flex items-center gap-1">
              🏆 Peak: {peakRank}
            </p>
          )}
        </div>
      </section>

      {/* Tier 2: Core Combat Performance */}
      <section className="space-y-3">
        <h3 className="text-xs font-black tracking-widest uppercase text-[var(--theme-subtext)]">
          Core Combat Performance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Card 1: Win Rate */}
          <div className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-subtext)]">Win Rate</span>
              <p className="text-3xl font-black text-[var(--theme-text)] mt-1 font-mono">{winRate}</p>
              <p className="text-xs text-[var(--theme-subtext)] mt-1">
                <span className="text-emerald-400 font-bold">{wins} Wins</span> /{' '}
                <span className="text-rose-400 font-bold">{losses} Losses</span>
              </p>
            </div>
            <div>
              <div className="w-full bg-[var(--theme-surface-2)] rounded-full h-2 overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${winPercent}%` }}
                />
                <div
                  className="bg-rose-500 h-full transition-all duration-500"
                  style={{ width: `${lossPercent}%` }}
                />
              </div>
              <p className="text-[11px] font-mono text-[var(--theme-subtext)] text-right mt-1.5">
                {totalMatches > 0 ? `${totalMatches} Games Total` : '-- Games Total'}
              </p>
            </div>
          </div>

          {/* Card 2: KDA Ratio */}
          <div className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-subtext)]">KDA Ratio</span>
              <p className="text-3xl font-black text-[var(--theme-text)] mt-1 font-mono">{kda}</p>
              <p className="text-xs font-mono text-[var(--theme-subtext)] mt-1">
                <span className="text-emerald-400 font-bold">{kills} K</span> /{' '}
                <span className="text-rose-400 font-bold">{deaths} D</span> /{' '}
                <span className="text-[var(--theme-accent)] font-bold">{assists} A</span>
              </p>
            </div>
            <div className="pt-2 border-t border-[var(--theme-border)] flex items-center justify-between text-xs text-[var(--theme-subtext)]">
              <span>Combat Average:</span>
              <span className="font-mono text-[var(--theme-text)] font-semibold">{totalMatches > 0 ? `${(Number(kills || 0) / totalMatches).toFixed(1)} K/Match` : '--'}</span>
            </div>
          </div>

          {/* Card 3: 10 Min Combat Rates */}
          <div className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] rounded-2xl p-5 flex flex-col justify-between space-y-2">
            <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-2.5 rounded-xl">
              <span className="text-[10px] text-[var(--theme-subtext)] uppercase font-semibold block">Damage / 10 Min</span>
              <p className="text-sm font-black font-mono text-rose-300 mt-0.5">{dmg10m}</p>
            </div>
            <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-2.5 rounded-xl">
              <span className="text-[10px] text-[var(--theme-subtext)] uppercase font-semibold block">Healing / 10 Min</span>
              <p className="text-sm font-black font-mono text-purple-300 mt-0.5">{heal10m}</p>
            </div>
            <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-2.5 rounded-xl">
              <span className="text-[10px] text-[var(--theme-subtext)] uppercase font-semibold block">Blocked / 10 Min</span>
              <p className="text-sm font-black font-mono text-indigo-300 mt-0.5">{block10m}</p>
            </div>
          </div>

          {/* Card 4: Dedicated Season Playtime */}
          <div className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--theme-subtext)]">Season Playtime</span>
              <p className="text-3xl font-black text-amber-300 mt-1 font-mono">{playtime}</p>
              <p className="text-xs text-[var(--theme-subtext)] mt-1">Recorded Competitive Matches</p>
            </div>
            <div className="pt-2 border-t border-[var(--theme-border)] flex items-center justify-between text-xs text-[var(--theme-subtext)]">
              <span>Status:</span>
              <span className="text-emerald-400 font-bold">Active Season</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tier 3: Navigation Drawer */}
      <section className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-1 border-b border-[var(--theme-border)] bg-[var(--theme-surface-2)] px-4 pt-3 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'consensus', label: '4-Site Consensus', icon: Shield },
            { id: 'heroes', label: 'Heroes', icon: Swords },
            { id: 'maps', label: 'Maps & Squad', icon: Map },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-t border-x cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--theme-surface-1)] border-[var(--theme-border)] text-[var(--theme-text)] border-b-2 border-b-[var(--theme-accent)]'
                    : 'border-transparent text-[var(--theme-subtext)] hover:text-[var(--theme-text)] hover:bg-[var(--theme-surface-1)]/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl">
                  <span className="text-xs text-[var(--theme-subtext)] font-semibold uppercase">Total Eliminations</span>
                  <p className="text-2xl font-black font-mono text-emerald-400 mt-1">{kills}</p>
                </div>
                <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl">
                  <span className="text-xs text-[var(--theme-subtext)] font-semibold uppercase">Total Assists</span>
                  <p className="text-2xl font-black font-mono text-[var(--theme-accent)] mt-1">{assists}</p>
                </div>
                <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl">
                  <span className="text-xs text-[var(--theme-subtext)] font-semibold uppercase">Total Deaths</span>
                  <p className="text-2xl font-black font-mono text-rose-400 mt-1">{deaths}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Award className="w-6 h-6 text-amber-400" />
                    <div>
                      <h4 className="text-sm font-bold text-[var(--theme-text)]">MVP Honors</h4>
                      <p className="text-xs text-[var(--theme-subtext)]">Match MVP recognitions</p>
                    </div>
                  </div>
                  <span className="text-xl font-black font-mono text-amber-400">{mvps}</span>
                </div>
                <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Flame className="w-6 h-6 text-purple-400" />
                    <div>
                      <h4 className="text-sm font-bold text-[var(--theme-text)]">SVP Honors</h4>
                      <p className="text-xs text-[var(--theme-subtext)]">Top performer on defeated side</p>
                    </div>
                  </div>
                  <span className="text-xl font-black font-mono text-purple-400">{svps}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 4-SITE CONSENSUS */}
          {activeTab === 'consensus' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black tracking-widest uppercase text-[var(--theme-subtext)]">
                  Live 4-Site Consensus Verification
                </h4>
                <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                  ⭐ Multi-Source Active
                </span>
              </div>

              <div className="overflow-x-auto border border-[var(--theme-border)] rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--theme-surface-2)] text-[var(--theme-subtext)] uppercase font-black tracking-wider border-b border-[var(--theme-border)]">
                    <tr>
                      <th className="py-3 px-4">Metric</th>
                      <th className="py-3 px-4 text-center">🌐 Tracker.gg</th>
                      <th className="py-3 px-4 text-center">⚔️ RivalsMeta</th>
                      <th className="py-3 px-4 text-center">🎯 RivalsTracker</th>
                      <th className="py-3 px-4 text-center">📊 RivalsData</th>
                      <th className="py-3 px-4 text-right text-[var(--theme-accent)]">Consensus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--theme-border)]/60 font-mono text-[var(--theme-text)]">
                    {consensusRows.map((row, idx) => {
                      const tGgVal = getSiteStat(row.metricKey, 'trackerGg', 'Tracker.gg');
                      const rMetaVal = getSiteStat(row.metricKey, 'rivalsMeta', 'RivalsMeta');
                      const rTrVal = getSiteStat(row.metricKey, 'rivalsTracker', 'RivalsTracker');
                      const rDataVal = getSiteStat(row.metricKey, 'rivalsData', 'RivalsData');

                      return (
                        <tr key={idx} className="hover:bg-[var(--theme-surface-2)]/40 transition-colors">
                          <td className="py-3 px-4 font-sans font-bold text-[var(--theme-text)]">{row.label}</td>
                          <td className="py-3 px-4 text-center">{tGgVal}</td>
                          <td className="py-3 px-4 text-center">{rMetaVal}</td>
                          <td className="py-3 px-4 text-center">{rTrVal}</td>
                          <td className="py-3 px-4 text-center">{rDataVal}</td>
                          <td className="py-3 px-4 text-right font-black text-emerald-400 bg-[var(--theme-accent)]/10 border-l border-[var(--theme-accent)]/20">
                            {row.consensus}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: HEROES */}
          {activeTab === 'heroes' && (
            <div className="space-y-4">
              <h4 className="text-xs font-black tracking-widest uppercase text-[var(--theme-subtext)]">
                Hero Performance & Roster Breakdown
              </h4>
              <div className="overflow-x-auto border border-[var(--theme-border)] rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--theme-surface-2)] text-[var(--theme-subtext)] uppercase font-black tracking-wider border-b border-[var(--theme-border)]">
                    <tr>
                      <th className="py-3 px-4">Hero</th>
                      <th className="py-3 px-4 text-center">Matches</th>
                      <th className="py-3 px-4 text-center">Win Rate</th>
                      <th className="py-3 px-4 text-center">KDA</th>
                      <th className="py-3 px-4 text-right">Dmg / Min</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--theme-border)]/60 font-mono text-[var(--theme-text)]">
                    {heroesList.length > 0 ? (
                      heroesList.map((h, idx) => (
                        <tr key={idx} className="hover:bg-[var(--theme-surface-2)]/40 transition-colors">
                          <td className="py-3 px-4 font-sans font-bold text-[var(--theme-text)] flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[var(--theme-accent)]" />
                            {h.hero || h.name || 'Hero'}
                          </td>
                          <td className="py-3 px-4 text-center">{h.matches ?? '--'}</td>
                          <td className="py-3 px-4 text-center text-emerald-400">{h.win_rate ?? h.winRate ?? '--'}</td>
                          <td className="py-3 px-4 text-center">{h.kda ?? h.kda_ratio ?? '--'}</td>
                          <td className="py-3 px-4 text-right">{h.damage_per_min ? Math.round(h.damage_per_min) : '--'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-[var(--theme-subtext)] font-sans">
                          No hero breakdown data recorded for this season.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: MAPS & SQUAD */}
          {activeTab === 'maps' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-xs font-black tracking-widest uppercase text-[var(--theme-subtext)]">
                  Frequent Squadmates
                </h4>
                <div className="border border-[var(--theme-border)] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--theme-surface-2)] text-[var(--theme-subtext)] uppercase font-bold border-b border-[var(--theme-border)]">
                      <tr>
                        <th className="py-2.5 px-3">Player</th>
                        <th className="py-2.5 px-3 text-center">Matches</th>
                        <th className="py-2.5 px-3 text-right">Win Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--theme-border)]/60 font-mono">
                      {squadmates.length > 0 ? (
                        squadmates.slice(0, 6).map((mate, idx) => (
                          <tr key={idx} className="hover:bg-[var(--theme-surface-2)]/40">
                            <td className="py-2.5 px-3 font-sans font-medium text-[var(--theme-text)]">{mate.name || mate.player_name || 'Teammate'}</td>
                            <td className="py-2.5 px-3 text-center">{mate.matches || mate.played_with_count || '--'}</td>
                            <td className="py-2.5 px-3 text-right text-emerald-400">{mate.win_rate ? `${mate.win_rate}%` : '--'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-[var(--theme-subtext)] font-sans">
                            No squadmate synergy data logged yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-black tracking-widest uppercase text-[var(--theme-subtext)]">
                  Hero Matchups & Counters
                </h4>
                <div className="border border-[var(--theme-border)] rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--theme-surface-2)] text-[var(--theme-subtext)] uppercase font-bold border-b border-[var(--theme-border)]">
                      <tr>
                        <th className="py-2.5 px-3">Opponent Hero</th>
                        <th className="py-2.5 px-3 text-center">Matches</th>
                        <th className="py-2.5 px-3 text-right">Advantage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--theme-border)]/60 font-mono">
                      {matchups.length > 0 ? (
                        matchups.slice(0, 6).map((m, idx) => (
                          <tr key={idx} className="hover:bg-[var(--theme-surface-2)]/40">
                            <td className="py-2.5 px-3 font-sans font-medium text-[var(--theme-text)]">{m.opponent_hero || m.hero || 'Opponent'}</td>
                            <td className="py-2.5 px-3 text-center">{m.matches ?? '--'}</td>
                            <td className="py-2.5 px-3 text-right text-[var(--theme-accent)]">{m.win_rate || m.advantage || '--'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-4 text-center text-[var(--theme-subtext)] font-sans">
                            No matchup counter data logged yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h4 className="text-xs font-black tracking-widest uppercase text-[var(--theme-subtext)] mb-2">
                  Profile Status & Telemetry Preferences
                </h4>
                <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-[var(--theme-text)]">Claimed Account</p>
                      <p className="text-xs text-[var(--theme-subtext)]">{uid ? `UID: ${uid}` : 'No account claimed'}</p>
                    </div>
                    {isClaimed && onUnclaim && (
                      <button
                        type="button"
                        onClick={onUnclaim}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        Unclaim Profile
                      </button>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[var(--theme-border)] flex items-center justify-between text-xs">
                    <span className="text-[var(--theme-subtext)]">Scraper Consensus Pipeline:</span>
                    <span className="font-mono text-emerald-400 font-semibold">4/4 Active Providers</span>
                  </div>

                  <div className="pt-3 border-t border-[var(--theme-border)] flex items-center justify-between text-xs">
                    <span className="text-[var(--theme-subtext)]">Cache Invalidation:</span>
                    <span className="font-mono text-[var(--theme-text)]">Auto-refresh on sync</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
