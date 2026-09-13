import React, { useState, useEffect } from 'react';

const CATEGORY_STYLES = {
  'Rank Climb': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'Combat Efficiency': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  'Survivability': { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  'Experience': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' }
};

const MOCK_GOALS_DEFAULT = [
  {
    id: 'kda_target',
    category: 'Combat Efficiency',
    title: 'Reach 3.00 KDA Ratio',
    current_value: 2.67,
    target_value: 3.00,
    unit: 'ratio',
    progress_pct: 89.0,
    tip: 'Focus on high-assist grouping to minimize unsupported deaths.',
    is_pinned: false
  },
  {
    id: 'win_rate_climb',
    category: 'Rank Climb',
    title: 'Secure Positive Win Delta',
    current_value: 48.5,
    target_value: 50.0,
    unit: '%',
    progress_pct: 97.0,
    tip: 'Winning 3 consecutive matches will shift your active rank bracket.',
    is_pinned: false
  },
  {
    id: 'survivability',
    category: 'Survivability',
    title: 'Sub-5 Death Average',
    current_value: 6.2,
    target_value: 5.0,
    unit: 'deaths/game',
    progress_pct: 80.6,
    tip: 'Disengage when team fights fall below 2v4 numbers to protect KDA.',
    is_pinned: false
  },
  {
    id: 'match_volume',
    category: 'Experience',
    title: 'Reach 100 Matches Played',
    current_value: 42,
    target_value: 100,
    unit: 'matches',
    progress_pct: 42.0,
    tip: 'Building match sample size improves rank accuracy and telemetry confidence.',
    is_pinned: false
  }
];

export default function GoalRecommendationsCard({ uid, getApiUrl = () => '' }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const baseUrl = typeof getApiUrl === 'function' ? getApiUrl() : '';

  useEffect(() => {
    let isMounted = true;
    async function fetchGoals() {
      if (!uid) {
        setGoals(MOCK_GOALS_DEFAULT);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${baseUrl}/api/player/${uid}/goals`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            const list = Array.isArray(json?.goals) && json.goals.length > 0 ? json.goals : MOCK_GOALS_DEFAULT;
            setGoals(list);
          }
        } else {
          if (isMounted) setGoals(MOCK_GOALS_DEFAULT);
        }
      } catch (err) {
        if (isMounted) setGoals(MOCK_GOALS_DEFAULT);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchGoals();
    return () => { isMounted = false; };
  }, [uid, baseUrl]);

  const togglePin = async (goalId, currentPinned) => {
    const nextState = !currentPinned;
    // Optimistic UI update
    setGoals((prev) => {
      const updated = prev.map((g) => (g.id === goalId ? { ...g, is_pinned: nextState } : g));
      return [...updated].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
    });

    if (!uid) return;

    try {
      await fetch(`${baseUrl}/api/player/${uid}/goals/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal_id: goalId, is_pinned: nextState })
      });
    } catch (e) {
      console.warn('Failed to persist goal pin:', e);
    }
  };

  return (
    <div className="bg-[#0d111d] border border-slate-800 rounded-2xl p-5 shadow-xl transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 text-xl font-bold shadow-inner">
            🎯
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white tracking-wide uppercase flex items-center gap-2">
              RECOMMENDED MILESTONES
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Dynamic targets computed from your recent performance
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-slate-800 text-teal-400 border border-teal-500/20">
          AI COACHING
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 py-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-28 bg-slate-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-sm">
          No goal recommendations available. Play more matches to generate telemetry targets!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {goals.map((goal) => {
            const catStyle = CATEGORY_STYLES[goal.category] || { bg: 'bg-slate-800', text: 'text-slate-300', border: 'border-slate-700' };
            const isPinned = !!goal.is_pinned;

            return (
              <div
                key={goal.id}
                className={`relative bg-[#131b2f] border ${isPinned ? 'border-emerald-400 shadow-emerald-900/20 shadow-md ring-1 ring-emerald-400/40' : 'border-slate-800/90'} rounded-xl p-4 transition-all hover:border-slate-700`}
              >
                {/* Top Row: Category badge & Pin toggle */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${catStyle.bg} ${catStyle.text} border ${catStyle.border} uppercase tracking-wider`}>
                    {goal.category}
                  </span>

                  <button
                    type="button"
                    onClick={() => togglePin(goal.id, isPinned)}
                    title={isPinned ? 'Unpin milestone' : 'Pin milestone to top'}
                    className={`p-1 rounded-md transition-colors ${isPinned ? 'text-emerald-400 hover:text-emerald-300 bg-emerald-500/10' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}
                  >
                    📌
                  </button>
                </div>

                {/* Milestone Title */}
                <h4 className="text-sm font-bold text-white mb-1.5 flex items-center gap-1.5">
                  {goal.title}
                </h4>

                {/* Metric Readout & Delta */}
                <div className="flex items-baseline justify-between text-xs font-mono mb-2">
                  <span className="text-slate-300 font-semibold">
                    {goal.current_value} / {goal.target_value} <span className="text-[10px] text-slate-500">{goal.unit}</span>
                  </span>
                  <span className="font-extrabold text-emerald-400 text-xs">
                    {goal.progress_pct}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800/80 mb-2.5">
                  <div
                    className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, goal.progress_pct))}%` }}
                  />
                </div>

                {/* Tactical Coaching Tip */}
                {goal.tip && (
                  <p className="text-[11px] text-slate-400 italic leading-relaxed bg-slate-900/50 p-2 rounded-lg border border-slate-800/50">
                    💡 {goal.tip}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
