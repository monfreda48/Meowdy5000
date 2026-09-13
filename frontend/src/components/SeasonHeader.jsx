import { useState, useEffect } from 'react';

export default function SeasonHeader({ getApiUrl }) {
  const [seasonMeta, setSeasonMeta] = useState({
    season_name: 'Season 1',
    end_timestamp: '2026-10-15T00:00:00Z',
    days_remaining: 32,
    upcoming_hero: 'Hawkeye',
    source: 'rivalsmeta.com'
  });

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

  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(seasonMeta.end_timestamp));

  useEffect(() => {
    const fetchSeasonMeta = async () => {
      try {
        const url = getApiUrl ? getApiUrl('/api/meta/season') : '/api/meta/season';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data.season_name) {
            setSeasonMeta(data);
            setTimeLeft(calculateTimeLeft(data.end_timestamp));
          }
        }
      } catch (err) {
        console.warn('Could not fetch season meta from backend:', err);
      }
    };

    fetchSeasonMeta();
  }, [getApiUrl]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(seasonMeta.end_timestamp));
    }, 60000);
    return () => clearInterval(timer);
  }, [seasonMeta.end_timestamp]);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#131b2f]/90 border border-slate-700/60 p-3.5 sm:p-4 rounded-2xl shadow-xl w-full max-w-3xl mb-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-lg shadow-sm">
          ⚔️
        </div>
        <div className="text-left">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
              {seasonMeta.season_name}
            </h2>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              LIVE
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Official Marvel Rivals Competitive Period
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap justify-end">
        {/* Real-time UTC Countdown Badge */}
        <div className="bg-[#0b101e] border border-slate-700/80 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-mono font-bold text-slate-200 shadow-inner">
          <span className="text-emerald-400 animate-pulse">⏳</span>
          <span>
            {timeLeft.days}d {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m remaining
          </span>
        </div>

        {/* Upcoming Hero Teaser Badge */}
        {seasonMeta.upcoming_hero && (
          <div className="bg-purple-500/10 border border-purple-500/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-xs font-bold text-purple-300">
            <span>🎯</span>
            <span>Teaser: {seasonMeta.upcoming_hero}</span>
          </div>
        )}
      </div>
    </div>
  );
}
