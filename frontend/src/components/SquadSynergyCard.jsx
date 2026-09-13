import { useState, useEffect } from 'react';

export default function SquadSynergyCard({ uid, playerData, getApiUrl }) {
  const [synergyData, setSynergyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('win_rate'); // 'win_rate' | 'matches'

  useEffect(() => {
    // 1. If playerData has squad_synergy or best_teammates, use it immediately
    const directSynergy = playerData?.squad_synergy || playerData?.current?.squad_synergy || playerData?.best_teammates || playerData?.current?.best_teammates;
    if (Array.isArray(directSynergy) && directSynergy.length > 0) {
      setSynergyData(directSynergy);
      setLoading(false);
      return;
    }

    if (!uid) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchSynergy = async () => {
      try {
        const path = `/api/player/${encodeURIComponent(uid)}/synergy?min_matches=2`;
        const url = getApiUrl ? getApiUrl(path) : path;
        const res = await fetch(url);
        
        if (!res.ok) {
          throw new Error(`Status ${res.status}`);
        }
        
        const data = await res.json();
        if (isMounted) {
          setSynergyData(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Failed to fetch squad synergy:', err);
        if (isMounted) {
          setError('Failed to load squad synergy data.');
          setLoading(false);
        }
      }
    };

    fetchSynergy();

    return () => {
      isMounted = false;
    };
  }, [uid, playerData, getApiUrl]);

  // Normalize items for rendering
  const normalizedList = (synergyData || []).map((t) => {
    const name = t.teammate_name || t.username || t.name || 'Teammate';
    const matches = parseInt(t.matches_together || t.matches || t.games || 0);
    const wrRaw = t.win_rate || t.winRate || '0%';
    const wrNum = typeof wrRaw === 'number' ? wrRaw : (parseFloat(String(wrRaw).replace(/[^0-9.]/g, '')) || 0);
    const wins = t.wins !== undefined ? t.wins : Math.round(matches * (wrNum / 100));
    const losses = t.losses !== undefined ? t.losses : Math.max(0, matches - wins);
    return {
      teammate_name: name,
      matches_together: matches,
      win_rate: wrNum,
      win_rate_str: typeof wrRaw === 'string' && wrRaw.includes('%') ? wrRaw : `${wrNum.toFixed(1)}%`,
      wins,
      losses,
      avg_kda: t.avg_kda || t.kda || 0
    };
  });

  // Sorting logic
  const sortedSynergy = [...normalizedList].sort((a, b) => {
    if (sortBy === 'win_rate') {
      if (b.win_rate !== a.win_rate) {
        return b.win_rate - a.win_rate;
      }
      return b.matches_together - a.matches_together;
    } else {
      if (b.matches_together !== a.matches_together) {
        return b.matches_together - a.matches_together;
      }
      return b.win_rate - a.win_rate;
    }
  });

  const getWinRateStyle = (wr) => {
    if (wr >= 60) {
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    } else if (wr >= 50) {
      return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    }
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  return (
    <div className="bg-[#0d111d] border border-slate-800 rounded-2xl p-5 shadow-xl w-full text-left space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center text-lg shadow-sm shrink-0">
            👥
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white uppercase tracking-wider">
                Squad Synergy
              </h3>
              <span className="text-[10px] font-extrabold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                DUO / TRIO STATS
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Co-op performance with frequent teammates (≥2 matches)
            </p>
          </div>
        </div>

        {/* Sorting Toggle */}
        {!loading && sortedSynergy.length > 0 && (
          <div className="flex items-center bg-[#070a13] p-1 rounded-xl border border-slate-800 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setSortBy('win_rate')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                sortBy === 'win_rate'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Highest Win Rate
            </button>
            <button
              type="button"
              onClick={() => setSortBy('matches')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                sortBy === 'matches'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Most Matches
            </button>
          </div>
        )}
      </div>

      {/* Body / Loading Skeletons / Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-800/40 rounded-xl border border-slate-800/60 p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700/50" />
                <div className="space-y-2">
                  <div className="w-24 h-4 bg-slate-700/50 rounded" />
                  <div className="w-16 h-3 bg-slate-700/40 rounded" />
                </div>
              </div>
              <div className="w-16 h-6 bg-slate-700/50 rounded-lg" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium">
          {error}
        </div>
      ) : sortedSynergy.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-sm font-medium">
          No duo/trio squad telemetry recorded for this season.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedSynergy.map((t, idx) => {
            const initial = (t.teammate_name || '?')[0].toUpperCase();
            return (
              <div
                key={`${t.teammate_name}-${idx}`}
                className="bg-[#070a13] border border-slate-800 hover:border-slate-700/80 p-3.5 rounded-xl flex items-center justify-between gap-3 transition-all hover:bg-[#090d19]"
              >
                {/* Teammate Identity */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600/30 to-purple-600/30 border border-indigo-500/40 text-indigo-300 font-black text-base flex items-center justify-center shrink-0 shadow-inner">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate group-hover:text-indigo-300">
                      {t.teammate_name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] bg-slate-800/90 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700 font-semibold">
                        {t.matches_together} Matches
                      </span>
                      <span className="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded-md border border-slate-800 font-mono">
                        W: {t.wins} / L: {t.losses}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="flex flex-col items-end shrink-0 gap-1">
                  <span
                    className={`text-xs font-black px-2.5 py-1 rounded-lg border shadow-sm ${getWinRateStyle(
                      t.win_rate
                    )}`}
                  >
                    {t.win_rate_str}
                  </span>
                  {t.avg_kda > 0 && (
                    <span className="text-[10px] text-slate-400 font-mono font-semibold bg-slate-800/40 px-1.5 py-0.5 rounded">
                      KDA: {t.avg_kda.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
