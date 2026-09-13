import React from 'react';

export default function FairPlayAndHistoryView({ punishments = [], allTime = {}, accolades = {} }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left select-none">
      {/* Fair Play Status */}
      <div className="bg-[#0d111d] border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
          <span className="text-sm">🛡️</span>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Account Standing & Punishments</h3>
        </div>
        {punishments.length === 0 ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            Clean Standing · 0 Infractions on Record
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {punishments.map((p, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{p.type || p.sanction || 'Sanction'}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold uppercase border border-slate-700">
                      {p.status || 'EXPIRED'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{p.reason || 'Standard infraction'}</p>
                </div>
                <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">{p.date || p.duration || '--'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lifetime Accolades */}
      <div className="bg-[#0d111d] border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
          <span className="text-sm">🏆</span>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Career Accolades & Trophies</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Total Career Games</div>
            <div className="text-lg font-black text-white font-mono">{allTime.total_games ? allTime.total_games.toLocaleString() : '--'}</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Lifetime Playtime</div>
            <div className="text-lg font-black text-emerald-400 font-mono">{allTime.time_played || '--'}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(accolades).map(([badge, count], idx) => (
            <div key={idx} className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <div className="text-[10px] text-slate-400 truncate font-bold">{badge}</div>
              <div className="text-xs font-extrabold text-amber-400 font-mono">{count}x</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
