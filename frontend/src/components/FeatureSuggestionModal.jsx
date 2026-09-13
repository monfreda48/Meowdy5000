import { useState } from 'react';

export default function FeatureSuggestionModal({ isOpen, onClose, uid, appVersion, getApiUrl }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Stats & Telemetry');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanDesc = description.trim();

    if (!cleanTitle || !cleanDesc) {
      setErrorMsg('Please fill in both the title and details.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const path = '/api/feedback/suggestion';
      const url = getApiUrl ? getApiUrl(path) : path;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          title: cleanTitle,
          description: cleanDesc,
          category: category,
          player_uid: uid || null,
          app_version: appVersion || '1.0.32'
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.error || `Status ${response.status}`);
      }

      setSuccessMsg('💡 Feature Suggestion Submitted!');
      setTitle('');
      setDescription('');
      setCategory('Stats & Telemetry');
      setSubmitting(false);

      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to submit feature suggestion:', err);
      setErrorMsg(`Submission failed: ${err.message}`);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-[#0d111d] border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 text-left relative">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold text-lg">
              💡
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider">
                Feature Suggestion
              </h3>
              <p className="text-[11px] text-slate-400">Share your ideas to help improve M5 Stat Tracker</p>
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

        {/* Metadata Badges */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-[#070a13] p-2 rounded-xl border border-slate-800/80 flex-wrap">
          <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">
            Version: <strong className="text-emerald-400">{appVersion || '1.0.32'}</strong>
          </span>
          {uid && (
            <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">
              UID: <strong className="text-indigo-400">{uid}</strong>
            </span>
          )}
        </div>

        {/* Status Messages */}
        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold animate-in fade-in">
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold animate-in fade-in">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Suggestion Title <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Add match history timeline charts"
              className="w-full bg-[#070a13] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#070a13] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
            >
              <option value="UI / Theme">UI / Theme</option>
              <option value="Stats & Telemetry">Stats & Telemetry</option>
              <option value="Hero Insights">Hero Insights</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              Details / Use Case <span className="text-amber-400">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your feature idea and how it would improve the stat tracking experience..."
              className="w-full bg-[#070a13] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>Submit Suggestion</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
