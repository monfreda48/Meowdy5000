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

  const username = current.username || stats?.username || 'Unknown Player';
  const platform = (current.platform || stats?.platform || 'PC').toUpperCase();
  const uid = current.uid || stats?.uid || '--';
  const level = current.level ?? '--';
  const rank = current.rank || 'Unranked';
  const rankScore = current.rankScore || current.rank_score || null;
  const peakRank = current.peakRank || current.peak_rank || null;
  const mainHero = current.topHero || current.top_hero || 'Jubilee';

  const winRate = current.winRate || current.win_rate || '--';
  const wins = Number(current.matchesWon ?? current.wins ?? 0);
  const losses = Number(current.matchesLost ?? current.losses ?? 0);
  const totalMatches = Number(current.matchesPlayed ?? current.total_matches ?? current.matches ?? (wins + losses) ?? 0);

  const winPercent = totalMatches > 0 ? Math.min(100, Math.max(0, (wins / totalMatches) * 100)) : 0;
  const lossPercent = totalMatches > 0 ? Math.min(100 - winPercent, Math.max(0, (losses / totalMatches) * 100)) : 0;

  const kda = current.kda || current.kdRatio || '--';
  const kills = current.kills ?? '--';
  const deaths = current.deaths ?? '--';
  const assists = current.assists ?? '--';

  const dmg10m = current.heroDamage || current.damagePer10m || '--';
  const heal10m = current.healing || current.healingPer10m || '--';
  const block10m = current.damageBlocked || '--';
  const playtime = current.timePlayed || current.seasonPlaytimeHours || '--';
  const accuracy = current.accuracy || '--';
  const mvps = current.mvps ?? 0;
  const svps = current.svps ?? 0;

  const heroesList = stats?.heroes || [];
  const squadmates = stats?.top_squadmates || [];
  const matchups = stats?.hero_matchups || [];

  const getSiteStat = (metricKey, siteName) => {
    const recSources = stats?.reconciled_stats?.[metricKey]?.sources;
    if (recSources && typeof recSources === 'object') {
      const target = siteName.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const [k, v] of Object.entries(recSources)) {
        if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === target) {
          if (v !== null && v !== undefined && v !== '' && v !== '--') return String(v);
        }
      }
    }
    return '--';
  };

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
    if (searchQuery.trim() && onSearch) onSearch(searchQuery.trim());
  };

  return (
    <div className="w-full space-y-6 text-[var(--theme-text)] font-sans">
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
              <p className="text-3xl font-black text-white mt-1 font-mono">{winRate}</p>
              <p className="text-xs text-[var(--theme-subtext)] mt-1">
                <span className="text-emerald-400 font-bold">{wins} Wins</span> /{' '}
                <span className="text-rose-400 font-bold">{losses} Losses</span>
              </p>
            </div>
            <div>
              <div className="w-full bg-[var(--theme-surface-2)] rounded-full h-2 overflow-hidden flex">
                <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${winPercent}%` }} />
                <div className="bg-rose-500 h-full transition-all duration-500" style={{ width: `${lossPercent}%` }} />
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
              <p className="text-3xl font-black text-white mt-1 font-mono">{kda}</p>
              <p className="text-xs font-mono text-[var(--theme-subtext)] mt-1">
                <span className="text-emerald-400 font-bold">{kills} K</span> /{' '}
                <span className="text-rose-400 font-bold">{deaths} D</span> /{' '}
                <span className="text-[var(--theme-accent)] font-bold">{assists} A</span>
              </p>
            </div>
            <div className="pt-2 border-t border-[var(--theme-border)] flex items-center justify-between text-xs text-[var(--theme-subtext)]">
              <span>Combat Average:</span>
              <span className="font-mono text-white font-semibold">{totalMatches > 0 ? `${(Number(kills || 0) / totalMatches).toFixed(1)} K/Match` : '--'}</span>
            </div>
          </div>

          {/* Card 3: 10 Min Combat Rates */}
          <div className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] rounded-2xl p-5 flex flex-col justify-between space-y-2">
            <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-2 rounded-xl">
              <span className="text-[10px] text-[var(--theme-subtext)] uppercase font-semibold block">Damage / 10 Min</span>
              <p className="text-sm font-black font-mono text-rose-300 mt-0.5">{dmg10m}</p>
            </div>
            <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-2 rounded-xl">
              <span className="text-[10px] text-[var(--theme-subtext)] uppercase font-semibold block">Healing / 10 Min</span>
              <p className="text-sm font-black font-mono text-purple-300 mt-0.5">{heal10m}</p>
            </div>
            <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-2 rounded-xl">
              <span className="text-[10px] text-[var(--theme-subtext)] uppercase font-semibold block">Blocked / 10 Min</span>
              <p className="text-sm font-black font-mono text-indigo-300 mt-0.5">{block10m}</p>
            </div>
          </div>

          {/* Card 4: Season Playtime */}
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
                    ? 'bg-[var(--theme-surface-1)] border-[var(--theme-border)] text-white border-b-2 border-b-[var(--theme-accent)]'
                    : 'border-transparent text-[var(--theme-subtext)] hover:text-white hover:bg-[var(--theme-surface-1)]/40'
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
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl">
                  <span className="text-xs text-[var(--theme-subtext)] font-semibold uppercase">Weapon Accuracy</span>
                  <p className="text-2xl font-black font-mono text-white mt-1">{accuracy}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Award className="w-6 h-6 text-amber-400" />
                    <div>
                      <h4 className="text-sm font-bold text-white">MVP Honors</h4>
                      <p className="text-xs text-[var(--theme-subtext)]">Match MVP recognitions</p>
                    </div>
                  </div>
                  <span className="text-xl font-black font-mono text-amber-400">{mvps}</span>
                </div>
                <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Flame className="w-6 h-6 text-purple-400" />
                    <div>
                      <h4 className="text-sm font-bold text-white">SVP Honors</h4>
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
                  ? Multi-Source Active
                </span>
              </div>

              <div className="overflow-x-auto border border-[var(--theme-border)] rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--theme-surface-2)] text-[var(--theme-subtext)] uppercase font-black tracking-wider border-b border-[var(--theme-border)]">
                    <tr>
                      <th className="py-3 px-4">Metric</th>
                      <th className="py-3 px-4 text-center">?? Tracker.gg</th>
                      <th className="py-3 px-4 text-center">?? RivalsMeta</th>
                      <th className="py-3 px-4 text-center">?? RivalsTracker</th>
                      <th className="py-3 px-4 text-center">?? RivalsData</th>
                      <th className="py-3 px-4 text-right text-[var(--theme-accent)]">Consensus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--theme-border)]/60 font-mono text-slate-200">
                    {consensusRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[var(--theme-surface-2)]/40 transition-colors">
                        <td className="py-3 px-4 font-sans font-bold text-white">{row.label}</td>
                        <td className="py-3 px-4 text-center">{getSiteStat(row.metricKey, 'Tracker.gg')}</td>
                        <td className="py-3 px-4 text-center">{getSiteStat(row.metricKey, 'RivalsMeta')}</td>
                        <td className="py-3 px-4 text-center">{getSiteStat(row.metricKey, 'RivalsTracker')}</td>
                        <td className="py-3 px-4 text-center">{getSiteStat(row.metricKey, 'RivalsData')}</td>
                        <td className="py-3 px-4 text-right font-black text-emerald-400 bg-[var(--theme-accent)]/10 border-l border-[var(--theme-accent)]/20">
                          {row.consensus}
                        </td>
                      </tr>
                    ))}
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
                  <tbody className="divide-y divide-[var(--theme-border)]/60 font-mono text-slate-200">
                    {heroesList.length > 0 ? (
                      heroesList.map((h, idx) => (
                        <tr key={idx} className="hover:bg-[var(--theme-surface-2)]/40 transition-colors">
                          <td className="py-3 px-4 font-sans font-bold text-white flex items-center gap-2">
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
                            <td className="py-2.5 px-3 font-sans font-medium text-white">{mate.name || mate.player_name || 'Teammate'}</td>
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
                            <td className="py-2.5 px-3 font-sans font-medium text-white">{m.opponent_hero || m.hero || 'Opponent'}</td>
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
                      <p className="text-sm font-bold text-white">Claimed Account</p>
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
                    <span className="font-mono text-white">Auto-refresh on sync</span>
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
