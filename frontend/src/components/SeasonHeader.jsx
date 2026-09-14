import React, { useState, useEffect } from 'react';

function useSeasonCountdown(endEpochMs) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    if (!endEpochMs) return;
    const calculate = () => {
      const diff = Math.max(0, endEpochMs - Date.now());
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft({ days, hours, minutes });
    };
    calculate();
    const timer = setInterval(calculate, 60000);
    return () => clearInterval(timer);
  }, [endEpochMs]);

  return timeLeft;
}

export default function SeasonHeader({ getApiUrl, seasonMeta: propSeasonMeta }) {
  const [fetchedMeta, setFetchedMeta] = useState(null);

  useEffect(() => {
    if (propSeasonMeta) return;
    let isMounted = true;
    const fetchSeasonMeta = async () => {
      try {
        const url = getApiUrl ? getApiUrl('/api/meta/season') : '/api/meta/season';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && data.season_name && !data.error) {
            setFetchedMeta(data);
          }
        }
      } catch (err) {
        console.warn('Could not fetch season meta from backend:', err);
      }
    };

    fetchSeasonMeta();
    return () => { isMounted = false; };
  }, [getApiUrl, propSeasonMeta]);

  const meta = propSeasonMeta || fetchedMeta;
  const endEpochMs = meta?.end_epoch_ms || (meta?.end_timestamp ? new Date(meta.end_timestamp).getTime() : null);
  const timeLeft = useSeasonCountdown(endEpochMs);

  if (!meta || !meta.season_name) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[var(--theme-surface-1)] border border-[var(--theme-border)] p-3.5 sm:p-4 rounded-2xl shadow-xl w-full max-w-7xl mb-4 text-left">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--theme-accent)]/15 border border-[var(--theme-accent)]/40 text-[var(--theme-accent-text)] flex items-center justify-center font-bold text-lg shadow-sm">
          ⚔️
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
              {meta.season_name}
            </h2>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
              LIVE
            </span>
            {meta.featured_hero && (
              <span className="text-[10px] font-bold text-[var(--theme-accent-text)] bg-[var(--theme-accent)]/10 border border-[var(--theme-accent)]/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {meta.featured_hero}
              </span>
            )}
          </div>
        </div>
      </div>

      {endEpochMs && (
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          <div className="bg-[var(--theme-surface-2)] border border-[var(--theme-border)] px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-mono font-bold text-slate-200 shadow-inner">
            <span>⏳ {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m remaining</span>
          </div>
        </div>
      )}
    </div>
  );
}
