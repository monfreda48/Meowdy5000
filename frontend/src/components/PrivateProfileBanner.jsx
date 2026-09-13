import React from 'react';

export default function PrivateProfileBanner({
  onRecheck,
  onOpenUidGuide,
  loading = false,
  username = ''
}) {
  return (
    <div className="w-full max-w-4xl mx-auto my-6 bg-amber-950/20 border border-amber-500/40 rounded-2xl p-6 shadow-2xl backdrop-blur-md transition-all duration-300">
      {/* Header section */}
      <div className="flex items-start gap-4 mb-6">
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 shrink-0 mt-1">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            Profile is Private in Marvel Rivals
            {username && <span className="text-amber-400/80 text-sm font-medium">({username})</span>}
          </h2>
          <p className="text-amber-200/70 text-sm mt-1 leading-relaxed">
            Stats and match histories cannot be tracked while NetEase privacy restrictions are active.
          </p>
        </div>
      </div>

      {/* Step-by-Step Resolution Card */}
      <div className="bg-slate-900/80 border border-amber-500/20 rounded-xl p-5 mb-6 space-y-3.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400/90 mb-2">
          How to Make Your Profile Public
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-3 p-3 bg-amber-950/30 border border-amber-500/10 rounded-lg">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs shrink-0">1</span>
            <span className="text-slate-200">Open <strong className="text-white">Marvel Rivals</strong> on your PC or Console.</span>
          </div>

          <div className="flex items-start gap-3 p-3 bg-amber-950/30 border border-amber-500/10 rounded-lg">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs shrink-0">2</span>
            <span className="text-slate-200">Navigate to <strong className="text-white">Settings ⚙️</strong> &rarr; <strong className="text-white">Account & Privacy</strong> (or Career &rarr; Profile Settings).</span>
          </div>

          <div className="flex items-start gap-3 p-3 bg-amber-950/30 border border-amber-500/10 rounded-lg">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs shrink-0">3</span>
            <span className="text-slate-200">Locate <strong className="text-white">Career & Match History Visibility</strong> and toggle to <strong className="text-emerald-400">Public</strong>.</span>
          </div>

          <div className="flex items-start gap-3 p-3 bg-amber-950/30 border border-amber-500/10 rounded-lg">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold text-xs shrink-0">4</span>
            <span className="text-slate-200">Play 1 match or wait 2-3 minutes for NetEase servers to propagate changes.</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-amber-500/20">
        <button
          onClick={onRecheck}
          disabled={loading}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4 text-slate-950" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Re-checking NetEase Servers...
            </>
          ) : (
            <>
              <span>🔄</span> Re-check Profile
            </>
          )}
        </button>

        {onOpenUidGuide && (
          <button
            onClick={onOpenUidGuide}
            className="text-amber-400/90 hover:text-amber-300 text-sm font-semibold underline underline-offset-4 flex items-center gap-1.5 transition-colors"
          >
            <span>🆔</span> Open UID Guide
          </button>
        )}
      </div>
    </div>
  );
}
