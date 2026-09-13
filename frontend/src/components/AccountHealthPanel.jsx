import React from 'react';

export default function AccountHealthPanel({ punishments = [], statusStanding = "Good Standing" }) {
  const records = Array.isArray(punishments) ? punishments : [];
  const hasRecords = records.length > 0;

  return (
    <div className="bg-[#0d111d] border border-slate-800 rounded-2xl p-5 mb-6 shadow-xl text-left select-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xl font-bold">
            🛡️
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white tracking-wide uppercase">
              FAIR PLAY & ACCOUNT STANDING
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Fair-play telemetry score, AFK logs & penalty standing
            </p>
          </div>
        </div>
        <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full ${hasRecords ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'}`}>
          {hasRecords ? 'Record History' : 'Clean Standing'}
        </span>
      </div>

      {!hasRecords ? (
        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shrink-0 font-black">
              ✓
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-300">
                Clean Standing · 0 Infractions on Record
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                No active sanctions, chat bans, or match abandonment penalties recorded.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-900/60 border border-emerald-500/40 px-3 py-1 rounded-lg">
            100/100
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((p, i) => (
            <div key={i} className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{p.type || 'Communication Restriction'}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-amber-500/30">
                    {p.status || 'EXPIRED'}
                  </span>
                </div>
                <p className="text-xs text-slate-300">Reason: {p.reason || 'Inappropriate speech'} · Duration: {p.duration || '1 hour'}</p>
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-400 shrink-0">
                {p.date || '13 Feb 2026'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
