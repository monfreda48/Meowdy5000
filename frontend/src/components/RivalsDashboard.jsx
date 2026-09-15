import React, { useState } from 'react';
import {
  User,
  Trophy,
  Shield,
  Swords,
  BarChart3,
  Check,
  Activity,
  Award,
  AlertCircle
} from 'lucide-react';

export default function RivalsDashboard({
  stats = null,
  loading = false,
  claimedUid = null,
  onUnclaim,
  onClaim
}) {
  const [activeTab, setActiveTab] = useState('consensus');

  // Backend contract ingestion with safe fallbacks
  const player = stats?.player || {
    uid: stats?.current?.uid || stats?.uid || null,
    username: stats?.current?.username || stats?.username || null,
    platform: stats?.current?.platform || stats?.platform || 'PS5',
    level: stats?.current?.level ?? null,
    rank: stats?.current?.rank || 'Unranked',
    rank_score: stats?.current?.rankScore || stats?.current?.rank_score || null,
    peak_rank: stats?.current?.peakRank || stats?.current?.peak_rank || null
  };

  const consensus = stats?.consensus || {
    win_rate: {
      display: stats?.current?.winRate || stats?.current?.win_rate || '--',
      sources: stats?.reconciled_stats?.winRate?.sources || stats?.reconciled_stats?.win_rate?.sources || {}
    },
    kda: {
      display: stats?.current?.kda || stats?.current?.kdRatio || '--',
      sources: stats?.reconciled_stats?.kda?.sources || stats?.reconciled_stats?.kdRatio?.sources || {}
    },
    total_matches: {
      display: stats?.current?.matchesPlayed || stats?.current?.total_matches || '--',
      sources: stats?.reconciled_stats?.matchesPlayed?.sources || stats?.reconciled_stats?.totalMatches?.sources || {}
    },
    damage_10m: {
      display: stats?.current?.heroDamage || stats?.current?.damagePer10m || '--',
      sources: stats?.reconciled_stats?.heroDamage?.sources || {}
    },
    healing_10m: {
      display: stats?.current?.healing || stats?.current?.healingPer10m || '--',
      sources: stats?.reconciled_stats?.healing?.sources || {}
    },
    blocked_10m: {
      display: stats?.current?.damageBlocked || '--',
      sources: stats?.reconciled_stats?.damageBlocked?.sources || {}
    }
  };

  const sources = stats?.sources || {
    tracker_gg: { status: 'empty', raw_stats: {}, heroes: [], matches: [] },
    rivals_meta: { status: 'empty', raw_stats: {}, heroes: [], matchups: [] },
    rivals_tracker: { status: 'empty', raw_stats: {}, heroes: [], history: [] },
    rivals_data: { status: 'empty', raw_stats: {}, heroes: [] }
  };

  const current = stats?.current || {};

  // Numeric UID verification (must strictly be digits only)
  const rawUid = player.uid;
  const isValidNumericUid =
    rawUid !== null &&
    rawUid !== undefined &&
    typeof rawUid === 'string' &&
    /^\d+$/.test(rawUid.trim());

  // Combat calculations
  const winRate = consensus.win_rate?.display || '--';
  const kda = consensus.kda?.display || '--';
  const totalMatchesStr = consensus.total_matches?.display || '--';
  const totalMatches = Number(totalMatchesStr.replace(/,/g, '')) || 0;

  const wins = Number(current.matchesWon ?? current.wins ?? 0);
  const losses = Number(current.matchesLost ?? current.losses ?? 0);
  const winPercent = totalMatches > 0 ? Math.min(100, Math.max(0, (wins / totalMatches) * 100)) : 0;
  const lossPercent = totalMatches > 0 ? Math.min(100 - winPercent, Math.max(0, (losses / totalMatches) * 100)) : 0;

  const kills = current.kills ?? '--';
  const deaths = current.deaths ?? '--';
  const assists = current.assists ?? '--';

  const dmg10m = consensus.damage_10m?.display || '--';
  const heal10m = consensus.healing_10m?.display || '--';
  const block10m = consensus.blocked_10m?.display || '--';
  const playtime = current.timePlayed || current.seasonPlaytimeHours || '--';

  const isClaimed = Boolean(
    claimedUid &&
    player.uid &&
    String(claimedUid).trim().toLowerCase() === String(player.uid).trim().toLowerCase()
  );

  const getSourceValue = (sourceObj, keyNames) => {
    if (!sourceObj || typeof sourceObj !== 'object') return '--';
    for (const k of keyNames) {
      if (sourceObj[k] !== undefined && sourceObj[k] !== null && sourceObj[k] !== '') {
        return String(sourceObj[k]);
      }
    }
    return '--';
  };

  const consensusRows = [
    { label: 'Win Rate', key: 'win_rate' },
    { label: 'KDA Ratio', key: 'kda' },
    { label: 'Total Matches', key: 'total_matches' },
    { label: 'Hero Damage / 10 Min', key: 'damage_10m' },
    { label: 'Healing / 10 Min', key: 'healing_10m' },
    { label: 'Damage Blocked / 10 Min', key: 'blocked_10m' }
  ];

  return (
    <div className="w-full space-y-6 text-[var(--theme-text)] font-sans">
      {/* 1. Player Identity Header Banner */}
      <section className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-[var(--theme-surface-2)] border border-[var(--theme-border)] flex items-center justify-center text-[var(--theme-subtext)]">
              <User className="w-8 h-8 text-[var(--theme-subtext)]" />
            </div>
            {player.level !== null && player.level !== undefined && player.level !== '--' && (
              <span className="absolute -top-2 -right-2 bg-[var(--theme-accent)] border border-[var(--theme-accent)]/50 text-[10px] font-black px-1.5 py-0.5 rounded-md text-slate-950 shadow-sm">
                {player.level}
              </span>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-black text-[var(--theme-text)]">{player.username || '--'}</h2>
              <span className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] text-[var(--theme-subtext)] text-[11px] font-bold px-2 py-0.5 rounded uppercase">
                {player.platform || 'PS5'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-medium text-[var(--theme-subtext)]">
              {isValidNumericUid && (
                <>
                  <span>UID: {player.uid}</span>
                  <span className="text-[var(--theme-border)]">|</span>
                </>
              )}
              {isClaimed ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                    <Check className="w-3.5 h-3.5" /> Profile Claimed
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
                onClaim && player.uid && (
                  <button
                    type="button"
                    onClick={() => onClaim(player.uid)}
                    className="text-[var(--theme-accent)] hover:underline font-bold cursor-pointer text-[11px]"
                  >
                    Claim Profile
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Rank Card */}
        <div className="w-full md:w-auto bg-[var(--theme-surface-2)] border border-[var(--theme-border)] rounded-xl p-4 flex flex-col items-start md:items-end justify-center min-w-[220px]">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-black uppercase text-blue-400">{player.rank || 'Unranked'}</span>
            {player.rank_score && player.rank_score !== '--' && (
              <>
                <span className="text-[var(--theme-subtext)] text-xs">|</span>
                <span className="text-sm font-mono font-bold text-[var(--theme-text)]">{player.rank_score}</span>
              </>
            )}
          </div>
          {player.peak_rank && player.peak_rank !== '--' && (
            <p className="text-xs text-purple-400 font-semibold mt-1 flex items-center gap-1">
              Peak: {player.peak_rank}
            </p>
          )}
        </div>
      </section>

      {/* 2. Core Performance KPI Row */}
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
              <p className="text-3xl font-black text-[var(--theme-text)] mt-1 font-mono">{kda}</p>
              <p className="text-xs font-mono text-[var(--theme-subtext)] mt-1">
                <span className="text-emerald-400 font-bold">{kills} K</span> /{' '}
                <span className="text-rose-400 font-bold">{deaths} D</span> /{' '}
                <span className="text-[var(--theme-accent)] font-bold">{assists} A</span>
              </p>
            </div>
            <div className="pt-2 border-t border-[var(--theme-border)] flex items-center justify-between text-xs text-[var(--theme-subtext)]">
              <span>Combat Average:</span>
              <span className="font-mono text-[var(--theme-text)] font-semibold">
                {totalMatches > 0 && kills !== '--' ? `${(Number(kills) / totalMatches).toFixed(1)} K/Match` : '--'}
              </span>
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

      {/* 3. 5-Tab Navigation Drawer */}
      <section className="bg-[var(--theme-surface-1)] border border-[var(--theme-border)] rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-1 border-b border-[var(--theme-border)] bg-[var(--theme-surface-2)] px-4 pt-3 overflow-x-auto">
          {[
            { id: 'consensus', label: '4-Site Consensus', icon: Shield },
            { id: 'tracker_gg', label: 'Tracker.gg', icon: BarChart3 },
            { id: 'rivals_meta', label: 'RivalsMeta', icon: Swords },
            { id: 'rivals_tracker', label: 'RivalsTracker', icon: Activity },
            { id: 'rivals_data', label: 'RivalsData', icon: Award }
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
                  <tbody className="divide-y divide-[var(--theme-border)]/60 font-mono text-[var(--theme-text)]">
                    {consensusRows.map((row, idx) => {
                      const cObj = consensus[row.key] || {};
                      const src = cObj.sources || {};
                      const tGgVal = src.tracker_gg || src['Tracker.gg'] || '--';
                      const rMetaVal = src.rivals_meta || src['RivalsMeta'] || '--';
                      const rTrVal = src.rivals_tracker || src['RivalsTracker'] || '--';
                      const rDataVal = src.rivals_data || src['RivalsData'] || '--';

                      return (
                        <tr key={idx} className="hover:bg-[var(--theme-surface-2)]/40 transition-colors">
                          <td className="py-3 px-4 font-sans font-bold text-[var(--theme-text)]">{row.label}</td>
                          <td className="py-3 px-4 text-center">{tGgVal}</td>
                          <td className="py-3 px-4 text-center">{rMetaVal}</td>
                          <td className="py-3 px-4 text-center">{rTrVal}</td>
                          <td className="py-3 px-4 text-center">{rDataVal}</td>
                          <td className="py-3 px-4 text-right font-black text-emerald-400 bg-[var(--theme-accent)]/10 border-l border-[var(--theme-accent)]/20">
                            {cObj.display || '--'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: TRACKER.GG */}
          {activeTab === 'tracker_gg' && (
            <div className="space-y-4">
              {sources.tracker_gg?.status?.includes('error') ||
              (Object.keys(sources.tracker_gg?.raw_stats || {}).length === 0 &&
               (sources.tracker_gg?.heroes || []).length === 0) ? (
                <div className="p-8 text-center bg-[var(--theme-surface-2)] border border-[var(--theme-border)] rounded-xl space-y-2">
                  <AlertCircle className="w-8 h-8 text-[var(--theme-subtext)] mx-auto" />
                  <p className="text-xs text-[var(--theme-subtext)] font-semibold">
                    No telemetry returned from Tracker.gg for this account
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl">
                      <span className="text-xs text-[var(--theme-subtext)] font-semibold uppercase">Win Rate</span>
                      <p className="text-xl font-black font-mono text-emerald-400 mt-1">
                        {getSourceValue(sources.tracker_gg.raw_stats, ['winRate', 'win_rate'])}
                      </p>
                    </div>
                    <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl">
                      <span className="text-xs text-[var(--theme-subtext)] font-semibold uppercase">KDA</span>
                      <p className="text-xl font-black font-mono text-[var(--theme-accent)] mt-1">
                        {getSourceValue(sources.tracker_gg.raw_stats, ['kda', 'kdRatio'])}
                      </p>
                    </div>
                    <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl">
                      <span className="text-xs text-[var(--theme-subtext)] font-semibold uppercase">Matches</span>
                      <p className="text-xl font-black font-mono text-[var(--theme-text)] mt-1">
                        {getSourceValue(sources.tracker_gg.raw_stats, ['matchesPlayed', 'matches'])}
                      </p>
                    </div>
                  </div>

                  {sources.tracker_gg.heroes && sources.tracker_gg.heroes.length > 0 && (
                    <div className="overflow-x-auto border border-[var(--theme-border)] rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[var(--theme-surface-2)] text-[var(--theme-subtext)] uppercase font-bold border-b border-[var(--theme-border)]">
                          <tr>
                            <th className="py-2.5 px-3">Hero Segment</th>
                            <th className="py-2.5 px-3 text-center">Matches</th>
                            <th className="py-2.5 px-3 text-center">Win Rate</th>
                            <th className="py-2.5 px-3 text-right">KDA</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--theme-border)]/60 font-mono">
                          {sources.tracker_gg.heroes.map((h, idx) => (
                            <tr key={idx} className="hover:bg-[var(--theme-surface-2)]/40">
                              <td className="py-2.5 px-3 font-sans font-medium text-[var(--theme-text)]">
                                {h.metadata?.name || h.hero || 'Hero'}
                              </td>
                              <td className="py-2.5 px-3 text-center">{h.stats?.matchesPlayed?.displayValue || '--'}</td>
                              <td className="py-2.5 px-3 text-center text-emerald-400">{h.stats?.winRate?.displayValue || '--'}</td>
                              <td className="py-2.5 px-3 text-right">{h.stats?.kda?.displayValue || '--'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RIVALS META */}
          {activeTab === 'rivals_meta' && (
            <div className="space-y-4">
              {sources.rivals_meta?.status?.includes('error') ||
              (Object.keys(sources.rivals_meta?.raw_stats || {}).length === 0 &&
               (sources.rivals_meta?.matchups || []).length === 0) ? (
                <div className="p-8 text-center bg-[var(--theme-surface-2)] border border-[var(--theme-border)] rounded-xl space-y-2">
                  <AlertCircle className="w-8 h-8 text-[var(--theme-subtext)] mx-auto" />
                  <p className="text-xs text-[var(--theme-subtext)] font-semibold">
                    No telemetry returned from RivalsMeta for this account
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl">
                      <span className="text-xs text-[var(--theme-subtext)] font-semibold uppercase">Win Rate</span>
                      <p className="text-xl font-black font-mono text-emerald-400 mt-1">
                        {getSourceValue(sources.rivals_meta.raw_stats, ['win_rate', 'winRate'])}
                      </p>
                    </div>
                    <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl">
                      <span className="text-xs text-[var(--theme-subtext)] font-semibold uppercase">KDA</span>
                      <p className="text-xl font-black font-mono text-[var(--theme-accent)] mt-1">
                        {getSourceValue(sources.rivals_meta.raw_stats, ['kda', 'kda_ratio'])}
                      </p>
                    </div>
                    <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl">
                      <span className="text-xs text-[var(--theme-subtext)] font-semibold uppercase">Total Matches</span>
                      <p className="text-xl font-black font-mono text-[var(--theme-text)] mt-1">
                        {getSourceValue(sources.rivals_meta.raw_stats, ['total_matches', 'matches'])}
                      </p>
                    </div>
                  </div>

                  {sources.rivals_meta.matchups && sources.rivals_meta.matchups.length > 0 && (
                    <div className="border border-[var(--theme-border)] rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[var(--theme-surface-2)] text-[var(--theme-subtext)] uppercase font-bold border-b border-[var(--theme-border)]">
                          <tr>
                            <th className="py-2.5 px-3">Opponent Hero</th>
                            <th className="py-2.5 px-3 text-center">Matches</th>
                            <th className="py-2.5 px-3 text-right">Win Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--theme-border)]/60 font-mono">
                          {sources.rivals_meta.matchups.map((m, idx) => (
                            <tr key={idx} className="hover:bg-[var(--theme-surface-2)]/40">
                              <td className="py-2.5 px-3 font-sans font-medium text-[var(--theme-text)]">{m.opponent_hero || m.hero || 'Opponent'}</td>
                              <td className="py-2.5 px-3 text-center">{m.matches ?? '--'}</td>
                              <td className="py-2.5 px-3 text-right text-emerald-400">{m.win_rate ?? '--'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RIVALS TRACKER */}
          {activeTab === 'rivals_tracker' && (
            <div className="space-y-4">
              {sources.rivals_tracker?.status?.includes('error') ||
              (Object.keys(sources.rivals_tracker?.raw_stats || {}).length === 0 &&
               (sources.rivals_tracker?.history || []).length === 0) ? (
                <div className="p-8 text-center bg-[var(--theme-surface-2)] border border-[var(--theme-border)] rounded-xl space-y-2">
                  <AlertCircle className="w-8 h-8 text-[var(--theme-subtext)] mx-auto" />
                  <p className="text-xs text-[var(--theme-subtext)] font-semibold">
                    No telemetry returned from RivalsTracker for this account
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl">
                      <span className="text-xs text-[var(--theme-subtext)] font-semibold uppercase">Competitive Rank</span>
                      <p className="text-xl font-black font-mono text-blue-400 mt-1">
                        {getSourceValue(sources.rivals_tracker.raw_stats, ['rank', 'current_rank'])}
                      </p>
                    </div>
                    <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl">
                      <span className="text-xs text-[var(--theme-subtext)] font-semibold uppercase">Win Rate</span>
                      <p className="text-xl font-black font-mono text-emerald-400 mt-1">
                        {getSourceValue(sources.rivals_tracker.raw_stats, ['win_rate', 'winRate'])}
                      </p>
                    </div>
                    <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl">
                      <span className="text-xs text-[var(--theme-subtext)] font-semibold uppercase">Total Games</span>
                      <p className="text-xl font-black font-mono text-[var(--theme-text)] mt-1">
                        {getSourceValue(sources.rivals_tracker.raw_stats, ['total_games', 'total_matches'])}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: RIVALS DATA */}
          {activeTab === 'rivals_data' && (
            <div className="space-y-4">
              {sources.rivals_data?.status?.includes('error') ||
              (Object.keys(sources.rivals_data?.raw_stats || {}).length === 0 &&
               (sources.rivals_data?.heroes || []).length === 0) ? (
                <div className="p-8 text-center bg-[var(--theme-surface-2)] border border-[var(--theme-border)] rounded-xl space-y-2">
                  <AlertCircle className="w-8 h-8 text-[var(--theme-subtext)] mx-auto" />
                  <p className="text-xs text-[var(--theme-subtext)] font-semibold">
                    No telemetry returned from RivalsData for this account
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl">
                      <span className="text-xs text-[var(--theme-subtext)] font-semibold uppercase">Rank Tier</span>
                      <p className="text-xl font-black font-mono text-blue-400 mt-1">
                        {getSourceValue(sources.rivals_data.raw_stats, ['rank_tier', 'rank'])}
                      </p>
                    </div>
                    <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl">
                      <span className="text-xs text-[var(--theme-subtext)] font-semibold uppercase">Rank Score</span>
                      <p className="text-xl font-black font-mono text-purple-400 mt-1">
                        {getSourceValue(sources.rivals_data.raw_stats, ['rank_score', 'score'])}
                      </p>
                    </div>
                    <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl">
                      <span className="text-xs text-[var(--theme-subtext)] font-semibold uppercase">Win Rate</span>
                      <p className="text-xl font-black font-mono text-emerald-400 mt-1">
                        {getSourceValue(sources.rivals_data.raw_stats, ['win_rate', 'winRate'])}
                      </p>
                    </div>
                    <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] p-4 rounded-xl">
                      <span className="text-xs text-[var(--theme-subtext)] font-semibold uppercase">Record</span>
                      <p className="text-xl font-black font-mono text-[var(--theme-text)] mt-1">
                        {getSourceValue(sources.rivals_data.raw_stats, ['record'])}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
