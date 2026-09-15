import React, { useState } from 'react';
import { Search, RefreshCw, Trophy, Shield, Swords, BarChart3, Users, Map, Settings, Check } from 'lucide-react';

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

  // Numeric and string parsing from live telemetry
  const username = current.username || stats?.username || 'Unknown Player';
  const platform = (current.platform || stats?.platform || 'PC').toUpperCase();
  const uid = current.uid || stats?.uid || '--';
  const level = current.level ?? '--';
  const rank = current.rank || 'Unranked';
  const rankScore = current.rankScore || current.rank_score || current.score || null;
  const peakRank = current.peakRank || current.peak_rank || null;
  const mainHero = current.topHero || current.top_hero || current.main_hero || null;

  // Combat metrics
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
  const pureKd = current.pureKdRatio || current.pure_kd || (deaths > 0 && kills !== '--' ? (Number(kills) / Number(deaths)).toFixed(2) : '--');

  const dmg10m = current.heroDamage || current.damagePer10m || current.damage_per_10m || '--';
  const heal10m = current.healing || current.healingPer10m || current.healing_per_10m || '--';
  const block10m = current.damageBlocked || current.dmg_blocked_10m || '--';
  const accuracy = current.accuracy ? (String(current.accuracy).includes('%') ? current.accuracy : `${current.accuracy}%`) : '--';
  const playtime = current.timePlayed || current.totalSeasonPlaytime || current.seasonPlaytimeHours || '--';

  // Dynamic 4-Site Consensus Cell Resolver
  const getSiteStat = (metricKey, siteKey, siteName) => {
    // 1. Check reconciled_stats sources dictionary
    const recSources = stats?.reconciled_stats?.[metricKey]?.sources;
    if (recSources && typeof recSources === 'object') {
      const target = siteName.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [k, v] of Object.entries(recSources)) {
        if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === target) {
          if (v !== null && v !== undefined && v !== '' && v !== '--') return String(v);
        }
      }
    }

    // 2. Check direct provider bucket on root payload
    const bucket = stats?.[siteKey];
    if (bucket && typeof bucket === 'object') {
      const val = bucket[metricKey] ?? bucket.summary?.[metricKey] ?? bucket.overview?.[metricKey];
      if (val !== null && val !== undefined && val !== '' && val !== '--') return String(val);
    }

    return '--';
  };

  const consensusRows = [
    {
      label: 'Win Rate',
      metricKey: 'winRate',
      consensus: winRate
    },
    {
      label: 'KDA Ratio',
      metricKey: 'kda',
      consensus: kda
    },
    {
      label: 'Total Matches',
      metricKey: 'matchesPlayed',
      consensus: totalMatches > 0 ? String(totalMatches) : '--'
    },
    {
      label: 'Hero Damage / 10m',
      metricKey: 'heroDamage',
      consensus: dmg10m
    },
    {
      label: 'Healing / 10m',
      metricKey: 'healing',
      consensus: heal10m
    },
    {
      label: 'Damage Blocked / 10m',
      metricKey: 'damageBlocked',
      consensus: block10m
    },
    {
      label: 'Competitive Rank',
      metricKey: 'rank',
      consensus: rank
    }
  ];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery.trim());
    }
  };

  const isClaimed = Boolean(
    claimedUid &&
    (String(claimedUid).trim().toLowerCase() === String(uid).trim().toLowerCase() ||
     String(claimedUid).trim().toLowerCase() === String(username).trim().toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0b0e14] text-slate-100 font-sans p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header Bar */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <span className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-2.5 py-1 rounded-md text-xs font-black tracking-widest uppercase">
            M5
          </span>
          <h1 className="text-lg font-black tracking-wider uppercase text-white">Rivals Tracker</h1>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 md:w-80">
            <input
              type="text"
              placeholder="Search UID or IGN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 pl-9 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          </form>

          <button
            type="button"
            onClick={onSync}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>{loading ? 'Syncing...' : 'Sync'}</span>
          </button>

          <span className="bg-slate-900 border border-slate-800 text-slate-400 text-xs font-bold px-3 py-2 rounded-xl whitespace-nowrap">
            ⏳ S{season} LIVE
          </span>
        </div>
      </header>

      {/* Tier 1: Consolidated Identity Banner */}
      <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 text-2xl font-bold">
              👤
            </div>
            <span className="absolute -top-2 -right-2 bg-indigo-600 border border-indigo-400/50 text-[10px] font-black px-1.5 py-0.5 rounded-md text-white shadow-sm">
              {level}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-black text-white">{username}</h2>
              <span className="bg-slate-800 border border-slate-700 text-slate-400 text-[11px] font-bold px-2 py-0.5 rounded uppercase">
                {platform}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
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
                      className="text-slate-500 hover:text-slate-300 ml-1 underline cursor-pointer text-[11px]"
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
                    className="text-amber-400 hover:text-amber-300 font-bold cursor-pointer text-[11px]"
                  >
                    ★ Claim Profile
                  </button>
                )
              )}
            </div>

            {mainHero && (
              <p className="text-xs text-slate-400">
                Main Hero: <span className="font-bold text-slate-200">{mainHero}</span>
              </p>
            )}
          </div>
        </div>

        {/* Dynamic Rank Card */}
        <div className="w-full md:w-auto bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col items-start md:items-end justify-center min-w-[220px]">
          <div className="flex items-center gap-2">
            <span className="text-base">💎</span>
            <span className="text-sm font-black uppercase text-blue-400">{rank}</span>
            {rankScore && (
              <>
                <span className="text-slate-500 text-xs">•</span>
                <span className="text-sm font-mono font-bold text-white">{rankScore} RS</span>
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

      {/* Tier 2: Core Combat Performance (3 Cards) */}
      <section className="space-y-3">
        <h3 className="text-xs font-black tracking-widest uppercase text-slate-400">
          Core Combat Performance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Win Rate */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Win Rate</span>
              <p className="text-3xl font-black text-white mt-1 font-mono">{winRate}</p>
              <p className="text-xs text-slate-400 mt-1">
                <span className="text-emerald-400 font-bold">{wins} Wins</span> /{' '}
                <span className="text-rose-400 font-bold">{losses} Losses</span>
              </p>
            </div>
            <div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${winPercent}%` }}
                />
                <div
                  className="bg-rose-500 h-full transition-all duration-500"
                  style={{ width: `${lossPercent}%` }}
                />
              </div>
              <p className="text-[11px] font-mono text-slate-500 text-right mt-1.5">
                {totalMatches > 0 ? `${totalMatches} Games Total` : '-- Games Total'}
              </p>
            </div>
          </div>

          {/* Card 2: KDA Ratio */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">KDA Ratio</span>
              <p className="text-3xl font-black text-white mt-1 font-mono">{kda}</p>
              <p className="text-xs font-mono text-slate-400 mt-1">
                <span className="text-emerald-400 font-bold">{kills} K</span> /{' '}
                <span className="text-rose-400 font-bold">{deaths} D</span> /{' '}
                <span className="text-indigo-400 font-bold">{assists} A</span>
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Pure K/D Ratio:</span>
              <span className="font-mono font-bold text-white">{pureKd}</span>
            </div>
          </div>

          {/* Card 3: Combat Output Per 10 Min */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Combat Per 10 Min</span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-slate-950/60 border border-slate-800/60 p-2 rounded-lg">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Damage</span>
                  <p className="text-sm font-black font-mono text-rose-300">{dmg10m}</p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800/60 p-2 rounded-lg">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Healing</span>
                  <p className="text-sm font-black font-mono text-purple-300">{heal10m}</p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800/60 p-2 rounded-lg">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Blocked</span>
                  <p className="text-sm font-black font-mono text-indigo-300">{block10m}</p>
                </div>
                <div className="bg-slate-950/60 border border-slate-800/60 p-2 rounded-lg">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Accuracy</span>
                  <p className="text-sm font-black font-mono text-slate-200">{accuracy}</p>
                </div>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">Season Playtime:</span>
              <span className="font-mono font-bold text-slate-200">{playtime}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tier 3: Drawer & 4-Site Consensus Verification */}
      <section className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-1 border-b border-slate-800 bg-slate-950/60 px-4 pt-3 overflow-x-auto">
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
                    ? 'bg-slate-900 border-slate-800 text-white border-b-2 border-b-indigo-500'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {activeTab === 'consensus' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black tracking-widest uppercase text-slate-400">
                  Live 4-Site Consensus Verification
                </h4>
                <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                  ⭐ Multi-Source Active
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-black tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Metric</th>
                      <th className="py-3 px-4 text-center">🌐 Tracker.gg</th>
                      <th className="py-3 px-4 text-center">⚔️ RivalsMeta</th>
                      <th className="py-3 px-4 text-center">🎯 RivalsTracker</th>
                      <th className="py-3 px-4 text-center">📊 RivalsData</th>
                      <th className="py-3 px-4 text-right text-indigo-400">Consensus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-slate-200">
                    {consensusRows.map((row, idx) => {
                      const tGgVal = getSiteStat(row.metricKey, 'trackerGg', 'Tracker.gg');
                      const rMetaVal = getSiteStat(row.metricKey, 'rivalsMeta', 'RivalsMeta');
                      const rTrVal = getSiteStat(row.metricKey, 'rivalsTracker', 'RivalsTracker');
                      const rDataVal = getSiteStat(row.metricKey, 'rivalsData', 'RivalsData');

                      return (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-sans font-bold text-white">{row.label}</td>
                          <td className="py-3 px-4 text-center">{tGgVal}</td>
                          <td className="py-3 px-4 text-center">{rMetaVal}</td>
                          <td className="py-3 px-4 text-center">{rTrVal}</td>
                          <td className="py-3 px-4 text-center">{rDataVal}</td>
                          <td className="py-3 px-4 text-right font-black text-emerald-400 bg-emerald-500/5">
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

          {activeTab === 'overview' && (
            <div className="py-8 text-center text-xs text-slate-500 font-medium">
              Additional telemetry details and accolades from active scrapers.
            </div>
          )}

          {activeTab === 'heroes' && (
            <div className="py-8 text-center text-xs text-slate-500 font-medium">
              Hero mastery, individual win rates, and playtime breakdowns.
            </div>
          )}

          {activeTab === 'maps' && (
            <div className="py-8 text-center text-xs text-slate-500 font-medium">
              Map attack/defense win rates and squad synergy records.
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="py-8 text-center text-xs text-slate-500 font-medium">
              Telemetry preferences, auto-sync intervals, and theme configuration.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
