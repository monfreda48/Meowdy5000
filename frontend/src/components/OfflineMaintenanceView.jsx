import React from 'react';

export default function OfflineMaintenanceView({ onRetry, errorMessage }) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="bg-[#131b2f] border border-red-500/40 rounded-3xl p-8 max-w-lg w-full space-y-5 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-red-500/10 rounded-full blur-2xl pointer-events-none"></div>

        {/* Server Disconnect Icon */}
        <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center text-3xl mx-auto shadow-lg">
          📡
        </div>

        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
            Server Disconnected / Maintenance
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
            Unable to connect to the M5 Stat Tracker Synology backend server. The server may be undergoing routine maintenance or your network connection is offline.
          </p>
        </div>

        {errorMessage && (
          <div className="bg-[#0b101e] border border-slate-800 p-3.5 rounded-xl text-left font-mono text-xs text-red-400 leading-relaxed break-words">
            <span className="text-slate-500 font-bold block mb-1">Diagnostic Log:</span>
            {errorMessage}
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <span>🔄</span>
            <span>Retry Connection</span>
          </button>
        </div>
      </div>
    </div>
  );
}
