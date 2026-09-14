import React, { useState } from 'react';

export default function UpdateModal({ updateInfo, onClose, showNativeToast = () => {} }) {
  const [downloading, setDownloading] = useState(false);

  if (!updateInfo || !updateInfo.updateAvailable) return null;

  const handleDownload = async () => {
    setDownloading(true);
    const targetUrl = updateInfo.downloadUrl || 'https://meowdy5000.synology.me';
    
    showNativeToast('Redirecting to latest release...');

    try {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.warn('Error launching URL:', err);
      window.open(targetUrl, '_blank');
    } finally {
      setTimeout(() => setDownloading(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0d111d] border-2 border-emerald-500/80 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* Top Glow Accent */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-bold shadow-inner">
              ⚡
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-wide uppercase">
                NEW UPDATE AVAILABLE
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Self-hosted Synology direct APK download
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Version Badge & Info */}
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3.5 mb-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">LATEST BUILD</span>
            <span className="text-base font-extrabold text-emerald-400 font-mono">
              v{updateInfo.serverVersion}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CURRENT INSTALLED</span>
            <span className="text-xs font-mono font-bold text-slate-300">
              v{updateInfo.currentVersion}
            </span>
          </div>
        </div>

        {/* Release Notes */}
        <div className="mb-5">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            What's New in this Release:
          </h4>
          <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {updateInfo.releaseNotes.map((note, idx) => (
              <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                <span className="text-emerald-400 font-bold shrink-0">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm rounded-xl uppercase tracking-wider shadow-lg shadow-emerald-900/30 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {downloading ? (
              <>
                <span className="animate-spin">⏳</span>
                Opening Downloader...
              </>
            ) : (
              <>
                <span>🚀</span>
                Download & Install Update
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Remind Me Later
          </button>
        </div>
      </div>
    </div>
  );
}
