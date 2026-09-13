import React, { useState, useEffect } from 'react';

const DEFAULT_CONDUCT_MOCK = {
  conduct_rating: 100,
  status_standing: 'Good Standing',
  active_penalties: [],
  warning_count: 0,
  last_incident_date: null
};

export default function AccountHealthPanel({ uid, API_BASE_URL = '' }) {
  const [conduct, setConduct] = useState(DEFAULT_CONDUCT_MOCK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchConduct() {
      if (!uid) {
        setConduct(DEFAULT_CONDUCT_MOCK);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/player/${uid}/conduct`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            setConduct(json && typeof json === 'object' ? json : DEFAULT_CONDUCT_MOCK);
          }
        } else {
          if (isMounted) setConduct(DEFAULT_CONDUCT_MOCK);
        }
      } catch (err) {
        if (isMounted) setConduct(DEFAULT_CONDUCT_MOCK);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchConduct();
    return () => { isMounted = false; };
  }, [uid, API_BASE_URL]);

  const rating = conduct.conduct_rating ?? 100;
  const penalties = conduct.active_penalties || [];
  const isGoodStanding = rating >= 90 && penalties.length === 0;

  return (
    <div className="bg-[#0d111d] border border-slate-800 rounded-2xl p-5 shadow-xl transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${isGoodStanding ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'} border flex items-center justify-center text-xl font-bold shadow-inner`}>
            {isGoodStanding ? '🛡️' : '⚠️'}
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white tracking-wide uppercase flex items-center gap-2">
              FAIR PLAY & ACCOUNT STANDING
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Fair-play telemetry score, AFK logs & penalty standing
            </p>
          </div>
        </div>
        <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full ${isGoodStanding ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'}`}>
          {conduct.status_standing || (isGoodStanding ? 'Good Standing' : 'Restricted')}
        </span>
      </div>

      {loading ? (
        <div className="h-20 bg-slate-800/50 rounded-xl animate-pulse" />
      ) : isGoodStanding ? (
        /* Good Standing State */
        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl shrink-0">
              ✓
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                Account in Good Standing
                <span className="text-xs font-mono font-extrabold text-emerald-400 bg-emerald-900/60 border border-emerald-500/40 px-2 py-0.5 rounded-md">
                  Score: {rating}/100
                </span>
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                No disciplinary actions, AFK warnings, or match abandonment penalties recorded on this account.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono shrink-0">
            <div className="text-center px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="block text-[10px] text-slate-400">WARNINGS</span>
              <span className="font-bold text-white">{conduct.warning_count || 0}</span>
            </div>
            <div className="text-center px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="block text-[10px] text-slate-400">FAIR PLAY</span>
              <span className="font-bold text-emerald-400">{rating}%</span>
            </div>
          </div>
        </div>
      ) : (
        /* Restricted / Warning State */
        <div className="space-y-3">
          <div className="bg-rose-950/20 border border-rose-500/40 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-xl shrink-0">
                🚨
              </div>
              <div>
                <h4 className="text-sm font-bold text-rose-300">
                  Active Account Restrictions
                </h4>
                <p className="text-xs text-slate-300">
                  Conduct Rating: <span className="font-bold text-rose-400">{rating}/100</span>. Penalties apply to queue matchmaking.
                </p>
              </div>
            </div>
          </div>

          {penalties.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">RECORDED INFRACTIONS</span>
              {penalties.map((pen, i) => (
                <div key={i} className="bg-slate-900/90 border border-amber-500/30 rounded-lg p-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-amber-300">{pen.type || 'Match Abandonment'}</span>
                    <p className="text-[11px] text-slate-400">Triggered: {pen.date || conduct.last_incident_date || 'Recent'}</p>
                  </div>
                  <span className="text-[10px] font-bold font-mono px-2 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {pen.duration_remaining || 'Active'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
