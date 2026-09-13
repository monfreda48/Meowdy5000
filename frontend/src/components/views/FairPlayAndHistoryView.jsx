import React from 'react';
import AccountHealthPanel from '../AccountHealthPanel';

export default function FairPlayAndHistoryView({ player = {} }) {
  const punishments = player.punishments || player.current?.punishments || [];
  const accolades = player.all_time?.accolades || player.accolades || {};
  const totalGames = player.all_time?.total_games || player.total_matches || "--";
  const playtime = player.all_time?.time_played || player.playtime || "--";

  return (
    <div className="space-y-6 select-none text-left">
      {/* Fair Play Panel */}
      <AccountHealthPanel punishments={punishments} />

      {/* Career Accolades & Stats */}
      <div className="bg-[#0d111d] border border-slate-800 rounded-2xl p-5 shadow-xl">
        <h3 className="text-xs font-extrabold text-white uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
          <span>🏆</span>
          <span>CAREER ACCOLADES & MILESTONES</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
            <span className="block text-[10px] text-slate-400 uppercase font-bold">TOTAL MATCHES</span>
            <span className="text-lg font-black text-white font-mono">{totalGames}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
            <span className="block text-[10px] text-slate-400 uppercase font-bold">TOTAL PLAYTIME</span>
            <span className="text-lg font-black text-emerald-400 font-mono">{playtime}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
            <span className="block text-[10px] text-slate-400 uppercase font-bold">MVPS</span>
            <span className="text-lg font-black text-amber-400 font-mono">{accolades.MVPs || player.mvps || "--"}</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
            <span className="block text-[10px] text-slate-400 uppercase font-bold">SVPS</span>
            <span className="text-lg font-black text-sky-400 font-mono">{accolades.SVPs || player.svps || "--"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
