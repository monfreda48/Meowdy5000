import { useState } from 'react';

export default function FindUIDModal({ isOpen, onClose, onSelectUid = null }) {
  const [copied, setCopied] = useState(false);
  const sampleUid = "10023456";

  if (!isOpen) return null;

  const handleCopySample = () => {
    try {
      navigator.clipboard.writeText(sampleUid);
      setCopied(true);
      if (onSelectUid) onSelectUid(sampleUid);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) { }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[#131b2f] border border-slate-700/80 rounded-2xl max-w-lg w-full p-5 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 text-left relative overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
              💡
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Locating Your Marvel Rivals UID
              </h3>
              <p className="text-[11px] text-slate-400">Find your permanent numeric player identifier</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Method 1: Career Overview */}
        <div className="bg-[#0b101e] border border-slate-800 p-4 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">1</span>
              <span className="uppercase tracking-wider">Method 1: Career Overview (Recommended)</span>
            </div>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
              Main Menu
            </span>
          </div>

          {/* Annotated Mockup Card */}
          <div className="bg-[#131b2f] border border-slate-700/60 p-3 rounded-lg flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xl shrink-0">
              👤
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">PlayerName</span>
                <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 font-mono">Lvl 45</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                <span>UID:</span>
                <strong className="underline decoration-emerald-400 underline-offset-2">10023456</strong>
                <span className="text-[9px] text-emerald-300 font-sans ml-1">← (9-10 digits)</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 pl-7 leading-relaxed">
            Open the top-left player menu in Marvel Rivals. Your 9–10 digit numeric UID is displayed right below your display name banner.
          </p>
        </div>

        {/* Method 2: In-Match Watermark */}
        <div className="bg-[#0b101e] border border-slate-800 p-4 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
              <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px]">2</span>
              <span className="uppercase tracking-wider">Method 2: In-Match HUD Watermark</span>
            </div>
            <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold">
              In-Game HUD
            </span>
          </div>

          {/* Annotated HUD Card */}
          <div className="bg-[#131b2f] border border-slate-700/60 p-3 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              <span>MATCH HUD (Bottom-Left Corner)</span>
            </div>
            <div className="bg-black/60 border border-slate-700 px-2 py-1 rounded text-[10px] font-mono text-cyan-300">
              UID: 10023456
            </div>
          </div>

          <p className="text-[11px] text-slate-400 pl-7 leading-relaxed">
            During gameplay or spectating, your client UID is persistently watermarked in the bottom-left corner of the HUD screen.
          </p>
        </div>

        {/* Guidance Note & Copy Helper */}
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-300">
            <strong className="text-white font-bold">Permanent Account ID:</strong> Your UID works across all platforms (Steam, PS5, Xbox).
          </div>
          <button
            type="button"
            onClick={handleCopySample}
            className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer"
          >
            {copied ? '✓ Copied Sample!' : 'Copy Sample UID'}
          </button>
        </div>

        {/* Modal Footer */}
        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-md"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
