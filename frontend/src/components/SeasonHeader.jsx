import { useState, useEffect } from 'react';

export default function SeasonHeader({ getApiUrl }) {
  const [seasonMeta, setSeasonMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  const calculateTimeLeft = (endTimestamp) => {
    if (!endTimestamp) return { days: 0, hours: 0, minutes: 0 };
    const difference = new Date(endTimestamp).getTime() - new Date().getTime();
    if (difference <= 0) return { days: 0, hours: 0, minutes: 0 };
    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / (1000 * 60)) % 60),
    };
  };

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    let isMounted = true;
    const fetchSeasonMeta = async () => {
      try {
        setLoading(true);
        const url = getApiUrl ? getApiUrl('/api/meta/season') : '/api/meta/season';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && data.season_name && !data.error) {
            setSeasonMeta(data);
            setTimeLeft(calculateTimeLeft(data.end_timestamp));
            setLoading(false);
            return;
          }
        }
        if (isMounted) {
          setLoading(false);
        }
      } catch (err) {
        console.warn('Could not fetch season meta from backend:', err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSeasonMeta();
    return () => { isMounted = false; };
  }, [getApiUrl]);

  useEffect(() => {
    if (!seasonMeta?.end_timestamp) return;
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(seasonMeta.end_timestamp));
    }, 60000);
    return () => clearInterval(timer);
  }, [seasonMeta?.end_timestamp]);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#131b2f]/90 border border-slate-700/60 p-3.5 sm:p-4 rounded-2xl shadow-xl w-full max-w-7xl mb-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-lg shadow-sm">
          ⚔️
        </div>
        <div className="text-left">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
              {loading ? (
                <span className="inline-block w-28 h-5 bg-slate-700/50 rounded animate-pulse" />
              ) : seasonMeta?.season_name ? (
                seasonMeta.season_name
              ) : (
                <span className="text-amber-400">Season Unconfirmed</span>
              )}
            </h2>
            {loading ? (
              <span className="inline-block w-10 h-4 bg-slate-700/50 rounded-full animate-pulse" />
            ) : seasonMeta?.season_name ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  LIVE
                </span>
                {seasonMeta.is_half_season && (
                  <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    MID-SEASON
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                UNCONFIRMED
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap justify-end">
        {/* Real-time UTC Countdown Badge */}
        {!loading && seasonMeta?.end_timestamp && (
          <div className="bg-[#0b101e] border border-slate-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-mono font-bold text-slate-200 shadow-inner">
            <span className="text-emerald-400 animate-pulse">⏳</span>
            <span>
              {timeLeft.days}d {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m remaining
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
