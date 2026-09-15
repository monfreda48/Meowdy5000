import React, { useState } from 'react';
import { 
  Shield, Swords, BarChart3, Users, Map, Check,
  User, Trophy
} from 'lucide-react';

export default function RivalsDashboard({
  stats = null,
  loading = false,
  claimedUid = null,
  onUnclaim,
  onClaim
}) {
  const [activeTab, setActiveTab] = useState('consensus');

  const current = stats?.current || stats || {};

  // Identity
  const username = current.username || stats?.username || '--';
  const platform = (current.platform || stats?.platform || 'PS5').toUpperCase();
  const rawUid = current.uid || stats?.uid || '';
  const isNumericUid = Boolean(rawUid && /^\d+$/.test(String(rawUid).trim()));
  const displayUid = isNumericUid ? String(rawUid).trim() : '';

  const level = current.level ?? null;
  const rank = current.rank || 'Unranked';
  const rankScore = current.rankScore || current.rank_score || null;
  const peakRank = current.peakRank || current.peak_rank || null;

  // Win Rate & Matches
  const winRate = current.winRate || current.win_rate || '--';
  const wins = Number(current.matchesWon ?? current.wins ?? 0);
  const losses = Number(current.matchesLost ?? current.losses ?? 0);
  const totalMatches = Number(current.matchesPlayed ?? current.total_matches ?? current.matches ?? (wins + losses) ?? 0);

  const winPercent = totalMatches > 0 ? Math.min(100, Math.max(0, (wins / totalMatches) * 100)) : 0;
  const lossPercent = totalMatches > 0 ? Math.min(100 - winPercent, Math.max(0, (losses / totalMatches) * 100)) : 0;

  // Combat Totals & KDA
  const kda = current.kda || current.kdRatio || '--';
  const kills = current.kills ?? '--';
  const deaths = current.deaths ?? '--';
  const assists = current.assists ?? '--';
  
  const pureKd = current.pureKd || current.pure_kd || (
    kills !== '--' && deaths !== '--' && Number(deaths) > 0
      ? (Number(kills) / Number(deaths)).toFixed(2)
      : (kills !== '--' ? String(kills) : '--')
  );

  // Combat Rates & Output
  const dmg10m = current.heroDamage || current.damagePer10m || current.damage_per_10m || '--';
  const dmgMin = current.damagePerMin || current.damage_per_min || '--';
  const totalDmg = current.totalDamage || current.total_damage || '--';

  const heal10m = current.healing || current.healingPer10m || current.healing_per_10m || '--';
  const healMin = current.healingPerMin || current.healing_per_min || '--';
  const totalHeal = current.totalHealing || current.total_healing || '--';

  const block10m = current.damageBlocked || current.damage_blocked || '--';
  const blockMin = current.damageBlockedMin || current.damage_blocked_min || '--';
  const totalBlock = current.totalBlocked || current.total_blocked || '--';

  const accuracy = current.accuracy || '--';
  const critRate = current.critRate || current.crit_rate || '--';
  const soloKills = current.soloKills ?? current.solo_kills ?? '--';
  const playtime = current.timePlayed || current.seasonPlaytimeHours || current.time_played || '--';
  const mvps = current.mvps ?? current.mvp ?? 0;
  const svps = current.svps ?? current.svp ?? 0;

  // Roster, Squad & Matchups
  const heroesList = Array.isArray(stats?.heroes) ? stats.heroes : [];
  const squadmates = Array.isArray(stats?.top_squadmates) ? stats.top_squadmates : [];
  const matchups = Array.isArray(stats?.hero_matchups) ? stats.hero_matchups : [];

  const isClaimed = Boolean(
    claimedUid &&
    ((displayUid && String(claimedUid).trim().toLowerCase() === displayUid.toLowerCase()) ||
     String(claimedUid).trim().toLowerCase() === String(username).trim().toLowerCase())
  );

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

  return (
    <div className="w-full space-y-6 text-[var(--theme-text)] font-sans">
      {/* Player Identity Banner */}
      <section className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="relative shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[var(--theme-surface-2)] border-2 border-[var(--theme-accent)] flex items-center justify-center text-[var(--theme-accent)] shadow-lg shadow-[var(--theme-accent-glow)]">
              <User className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            {level && level !== '--' && (
              <span className="absolute -top-2 -right-2 bg-[var(--theme-accent)] text-slate-950 font-black text-xs px-2 py-0.5 rounded-lg shadow-md border border-black/20 font-mono">
                {level}
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">{username}</h1>
              <span className="bg-blue-600/20 border border-blue-500/40 text-blue-300 text-xs font-black px-2.5 py-0.5 rounded-md uppercase tracking-wider font-mono">
                {platform}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-[var(--theme-subtext)] flex-wrap">
              {displayUid ? (
                <>
                  <span className="font-mono text-slate-300">UID: {displayUid}</span>
                  <span className="text-slate-600">/</span>
                </>
              ) : null}
              {isClaimed ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Profile Claimed
                  </span>
                  {onUnclaim && (
                    <button
                      type="button"
                      onClick={onUnclaim}
                      className="text-xs text-rose-400 hover:text-rose-300 underline font-semibold cursor-pointer ml-1"
                    >
                      Unclaim
                    </button>
                  )}
                </div>
              ) : (
                onClaim && (
                  <button
                    type="button"
                    onClick={() => onClaim(displayUid || username)}
                    className="text-xs text-[var(--theme-accent)] hover:underline font-black uppercase cursor-pointer"
                  >
                    Claim Profile
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Rank & Rating */}
        <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] rounded-2xl p-4 min-w-[220px] text-left md:text-right shadow-inner">
          <div className="flex items-center justify-start md:justify-end gap-2">
            <Trophy className="w-5 h-5 text-blue-400" />
            <span className="text-base sm:text-lg font-black text-blue-400 uppercase tracking-wider">{rank}</span>
            {rankScore && (
              <span className="text-sm font-mono font-bold text-slate-200">/ {rankScore} RS</span>
            )}
          </div>
          {peakRank && (
            <p className="text-xs text-purple-400 font-bold mt-1 flex items-center justify-start md:justify-end gap-1 font-sans">
              Peak: {peakRank}
            </p>
          )}
        </div>
      </section>

      {/* Core Combat Performance Grid */}
      <section className="space-y-3">
        <h3 className="text-xs font-black tracking-widest uppercase text-[var(--theme-subtext)]">
          Core Combat Performance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Win Rate */}
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

          {/* KDA Ratio */}
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
              <span className="font-mono text-white font-semibold">
                {totalMatches > 0 && kills !== '--' ? `${(Number(kills) / totalMatches).toFixed(1)} K/Match` : '--'}
              </span>
            </div>
          </div>

          {/* 10 Min Rates */}
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

          {/* Season Playtime */}
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

      {/* Navigation Drawer Tabs */}
      <section className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-1 border-b border-[var(--theme-border)] bg-[var(--theme-surface-2)] px-4 pt-3 overflow-x-auto">
          {[
            { id: 'consensus', label: '4-Site Consensus', icon: Shield },
            { id: 'all_telemetry', label: 'All Scraped Telemetry', icon: BarChart3 },
            { id: 'heroes', label: 'Hero Roster', icon: Swords },
            { id: 'maps', label: 'Maps & Squad', icon: Map }
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
          {/* TAB 1: 4-SITE CONSENSUS */}
          {activeTab === 'consensus' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black tracking-widest uppercase text-[var(--theme-subtext)]">
                  Live 4-Site Consensus Verification
                </h4>
                <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                  Multi-Source Active
                </span>
              </div>

              <div className="overflow-x-auto border border-[var(--theme-border)] rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--theme-surface-2)] text-[var(--theme-subtext)] uppercase font-black tracking-wider border-b border-[var(--theme-border)]">
                    <tr>
                      <th className="py-3 px-4">Metric</th>
                      <th className="py-3 px-4 text-center">Tracker.gg</th>
                      <th className="py-3 px-4 text-center">RivalsMeta</th>
                      <th className="py-3 px-4 text-center">RivalsTracker</th>
                      <th className="py-3 px-4 text-center">RivalsData</th>
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

          {/* TAB 2: ALL SCRAPED TELEMETRY */}
          {activeTab === 'all_telemetry' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-3.5 rounded-xl">
                  <span className="text-[10px] text-[var(--theme-subtext)] uppercase font-bold">Total Damage / 10m</span>
                  <p className="text-xl font-black font-mono text-white mt-0.5">{dmg10m}</p>
                </div>
                <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-3.5 rounded-xl">
                  <span className="text-[10px] text-[var(--theme-subtext)] uppercase font-bold">Total Healing / 10m</span>
                  <p className="text-xl font-black font-mono text-white mt-0.5">{heal10m}</p>
                </div>
                <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-3.5 rounded-xl">
                  <span className="text-[10px] text-[var(--theme-subtext)] uppercase font-bold">Total Blocked / 10m</span>
                  <p className="text-xl font-black font-mono text-white mt-0.5">{block10m}</p>
                </div>
                <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-3.5 rounded-xl">
                  <span className="text-[10px] text-[var(--theme-subtext)] uppercase font-bold">Weapon Accuracy</span>
                  <p className="text-xl font-black font-mono text-white mt-0.5">{accuracy}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-3.5 rounded-xl">
                  <span className="text-[10px] text-[var(--theme-subtext)] uppercase font-bold">Total Eliminations</span>
                  <p className="text-xl font-black font-mono text-emerald-400 mt-0.5">{kills}</p>
                </div>
                <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-3.5 rounded-xl">
                  <span className="text-[10px] text-[var(--theme-subtext)] uppercase font-bold">Pure K/D Ratio</span>
                  <p className="text-xl font-black font-mono text-white mt-0.5">{pureKd}</p>
                </div>
                <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-3.5 rounded-xl">
                  <span className="text-[10px] text-[var(--theme-subtext)] uppercase font-bold">MVP Honors</span>
                  <p className="text-xl font-black font-mono text-amber-400 mt-0.5">{mvps}</p>
                </div>
                <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-3.5 rounded-xl">
                  <span className="text-[10px] text-[var(--theme-subtext)] uppercase font-bold">SVP Honors</span>
                  <p className="text-xl font-black font-mono text-purple-400 mt-0.5">{svps}</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HERO ROSTER */}
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
                      <th className="py-3 px-4 text-center">Playtime</th>
                      <th className="py-3 px-4 text-right">Dmg / Min</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--theme-border)]/60 font-mono text-slate-200">
                    {heroesList.length > 0 ? (
                      heroesList.map((h, idx) => (
                        <tr key={idx} className="hover:bg-[var(--theme-surface-2)]/40 transition-colors">
                          <td className="py-3 px-4 font-sans font-bold text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[var(--theme-accent)]" />
                            {h.hero || h.name}
                          </td>
                          <td className="py-3 px-4 text-center">{h.matches ?? '--'}</td>
                          <td className="py-3 px-4 text-center text-emerald-400">{h.win_rate ?? h.winRate ?? '--'}</td>
                          <td className="py-3 px-4 text-center">{h.kda ?? '--'}</td>
                          <td className="py-3 px-4 text-center text-slate-400">{h.time_played ?? h.timePlayed ?? '--'}</td>
                          <td className="py-3 px-4 text-right">{h.damage_per_min ? Math.round(h.damage_per_min) : '--'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-[var(--theme-subtext)] font-sans">
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
                        squadmates.map((mate, idx) => (
                          <tr key={idx} className="hover:bg-[var(--theme-surface-2)]/40">
                            <td className="py-2.5 px-3 font-sans font-medium text-white">{mate.name}</td>
                            <td className="py-2.5 px-3 text-center">{mate.matches ?? '--'}</td>
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
                        matchups.map((m, idx) => (
                          <tr key={idx} className="hover:bg-[var(--theme-surface-2)]/40">
                            <td className="py-2.5 px-3 font-sans font-medium text-white">{m.hero}</td>
                            <td className="py-2.5 px-3 text-center">{m.matches ?? '--'}</td>
                            <td className="py-2.5 px-3 text-right text-[var(--theme-accent)]">{m.advantage ?? '--'}</td>
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
        </div>
      </section>
    </div>
  );
}
