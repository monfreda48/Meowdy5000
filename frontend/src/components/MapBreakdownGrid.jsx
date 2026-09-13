import { useState, useEffect } from 'react';

export default function MapBreakdownGrid({ uid, getApiUrl }) {
  const [mapsData, setMapsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('matches'); // 'matches' | 'win_rate' | 'alphabetical'

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchMaps = async () => {
      try {
        const path = `/api/player/${encodeURIComponent(uid)}/maps`;
        const url = getApiUrl ? getApiUrl(path) : path;
        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`Status ${res.status}`);
        }

        const data = await res.json();
        if (isMounted) {
          setMapsData(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Failed to fetch map breakdown:', err);
        if (isMounted) {
          setError('Failed to load map performance data.');
          setLoading(false);
        }
      }
    };

    fetchMaps();

    return () => {
      isMounted = false;
    };
  }, [uid, getApiUrl]);

  // Sort logic
  const sortedMaps = [...mapsData].sort((a, b) => {
    if (sortBy === 'win_rate') {
      if (b.win_rate !== a.win_rate) {
        return b.win_rate - a.win_rate;
      }
      return b.matches_played - a.matches_played;
    } else if (sortBy === 'alphabetical') {
      return (a.map_name || '').localeCompare(b.map_name || '');
    } else {
      // Default: 'matches' (Most Played)
      if (b.matches_played !== a.matches_played) {
        return b.matches_played - a.matches_played;
      }
      return b.win_rate - a.win_rate;
    }
  });

  const getTierColor = (wr) => {
    if (wr >= 60) return { bar: 'bg-emerald-500', text: 'text-emerald-400', badge: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' };
    if (wr >= 50) return { bar: 'bg-cyan-500', text: 'text-cyan-400', badge: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10' };
    return { bar: 'bg-rose-500', text: 'text-rose-400', badge: 'border-rose-500/30 text-rose-400 bg-rose-500/10' };
  };

  return (
    <div className="bg-[#0d111d] border border-slate-800 rounded-2xl p-5 shadow-xl w-full text-left space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-lg shadow-sm shrink-0">
            🗺️
          </div>
          <div>
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              Map Breakdown
            </h3>
            <p className="text-xs text-slate-400">
              Win rate analysis and attack/defense split across battlegrounds
            </p>
          </div>
        </div>

        {/* Sorting Controls */}
        {!loading && mapsData.length > 0 && (
          <div className="flex items-center bg-[#070a13] p-1 rounded-xl border border-slate-800 overflow-x-auto self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setSortBy('matches')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                sortBy === 'matches'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Most Played
            </button>
            <button
              type="button"
              onClick={() => setSortBy('win_rate')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                sortBy === 'win_rate'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Highest Win Rate
            </button>
            <button
              type="button"
              onClick={() => setSortBy('alphabetical')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                sortBy === 'alphabetical'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Alphabetical
            </button>
          </div>
        )}
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-44 bg-slate-800/40 rounded-xl border border-slate-800/60 p-4 space-y-3">
              <div className="w-1/2 h-5 bg-slate-700/50 rounded" />
              <div className="w-1/3 h-8 bg-slate-700/50 rounded" />
              <div className="w-full h-2 bg-slate-700/40 rounded-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium">
          {error}
        </div>
      ) : sortedMaps.length === 0 ? (
        <div className="p-6 bg-[#070a13] border border-slate-800/60 rounded-xl text-center space-y-2">
          <div className="text-2xl">🏛️</div>
          <p className="text-xs font-medium text-slate-300">
            No map breakdown data indexed yet. Play more competitive matches to generate map telemetry.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedMaps.map((mapItem) => {
            const tier = getTierColor(mapItem.win_rate);
            const hasSplit =
              (mapItem.attack_win_rate && mapItem.attack_win_rate > 0) ||
              (mapItem.defense_win_rate && mapItem.defense_win_rate > 0);

            return (
              <div
                key={mapItem.id || mapItem.map_name}
                className="bg-[#070a13] border border-slate-800 hover:border-slate-700 p-4 rounded-xl space-y-3.5 transition-all shadow-md hover:shadow-lg relative overflow-hidden group"
              >
                {/* Decorative Banner Gradient Top Accent */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500/80 via-teal-500/80 to-indigo-500/80 group-hover:h-2 transition-all" />

                {/* Header Band */}
                <div className="flex items-start justify-between gap-2 pt-1">
                  <div>
                    <h4 className="font-bold text-white text-lg tracking-wide uppercase group-hover:text-emerald-300 transition-colors">
                      {mapItem.map_name}
                    </h4>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-800/80 border border-slate-700/80 px-2 py-0.5 rounded-md">
                      {mapItem.game_mode || 'Competitive'}
                    </span>
                  </div>

                  {/* Matches Pill */}
                  <span className="text-xs text-slate-400 font-mono bg-slate-900 border border-slate-800 px-2 py-1 rounded-md">
                    {mapItem.matches_played} Matches
                  </span>
                </div>

                {/* Primary Metric: Win Rate & Record */}
                <div className="flex items-baseline justify-between gap-2">
                  <div>
                    <span className={`text-3xl font-black ${tier.text}`}>
                      {mapItem.win_rate.toFixed(1)}%
                    </span>
                    <span className="text-xs text-slate-500 font-semibold ml-1">Win Rate</span>
                  </div>
                  <div className="text-right text-xs text-slate-300 font-mono">
                    <span className="text-emerald-400 font-bold">{mapItem.wins}W</span>
                    <span className="text-slate-600 mx-1">-</span>
                    <span className="text-rose-400 font-bold">{mapItem.losses}L</span>
                  </div>
                </div>

                {/* Visual Win Rate Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/40">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${tier.bar}`}
                      style={{ width: `${Math.min(100, Math.max(0, mapItem.win_rate))}%` }}
                    />
                  </div>
                </div>

                {/* Attack vs Defense Split (if populated) */}
                {hasSplit && (
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                    <div className="flex items-center gap-1 text-amber-400">
                      <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400">ATK:</span>
                      <span className="font-extrabold">{mapItem.attack_win_rate.toFixed(1)}%</span>
                    </div>
                    <div className="w-px h-3 bg-slate-800" />
                    <div className="flex items-center gap-1 text-blue-400">
                      <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400">DEF:</span>
                      <span className="font-extrabold">{mapItem.defense_win_rate.toFixed(1)}%</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
