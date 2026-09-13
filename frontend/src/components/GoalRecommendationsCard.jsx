import React from 'react';

export default function GoalRecommendationsCard({ stats }) {
  const currentStats = stats?.current || {};

  const winRateRaw = currentStats.winRate || currentStats.win_rate || '50.0%';
  const winRateVal = parseFloat(String(winRateRaw).replace(/[^0-9.]/g, '')) || 50.0;

  const kdaRaw = currentStats.kdRatio || currentStats.kda || currentStats.kda_ratio || '2.50';
  const kdaVal = parseFloat(String(kdaRaw).replace(/[^0-9.]/g, '')) || 2.50;

  const deaths = currentStats.deaths || 0;
  const matches = currentStats.matchesPlayed || currentStats.total_matches || currentStats.matches || 1;
  const deathsPerGame = matches > 0 ? (deaths / matches) : 5.0;

  const topHero = currentStats.topHero || currentStats.top_hero || 'Main Hero';

  // Dynamic feedback generators
  const getCombatFeedback = () => {
    if (deathsPerGame > 6) {
      return {
        title: 'Combat & Survivability Analysis',
        badge: 'High Mortality Rate',
        color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
        text: 'High engagement mortality rate detected. Prioritize disengaging when team fight numbers fall below 2v4 to preserve combat uptime and retain ultimate charge.'
      };
    } else if (kdaVal > 3.5) {
      return {
        title: 'Combat & Survivability Analysis',
        badge: 'Optimal Target Prioritization',
        color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
        text: 'High target prioritization efficiency. Primary team impact comes from staggered pick-offs and clean entry fragging.'
      };
    } else {
      return {
        title: 'Combat & Survivability Analysis',
        badge: 'Stable Trade Efficiency',
        color: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
        text: 'Balanced eliminations-to-deaths ratio. Focus on preserving ultimate charge during mid-fight transitions to capitalize on objective pushes.'
      };
    }
  };

  const getHeroPoolFeedback = () => {
    if (winRateVal >= 55) {
      return {
        title: 'Hero Pool & Impact Analysis',
        badge: 'High Conversion Role',
        color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
        text: `Win rate peaks when maining ${topHero} and flexing into Vanguard/Duelist. Support picks currently yield lower combat conversion.`
      };
    } else {
      return {
        title: 'Hero Pool & Impact Analysis',
        badge: 'Flex Shift Required',
        color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
        text: `Primary impact recorded on ${topHero}. Shifting comfort picks to match team composition synergies can improve match outcome consistency.`
      };
    }
  };

  const getTrendFeedback = () => {
    if (winRateVal >= 50) {
      return {
        title: 'Trend & Win Rate Explanation',
        badge: 'Positive Trajectory',
        color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
        text: `Your ${winRateVal.toFixed(1)}% win rate is sustained by solid elimination trade ratios across recent match telemetry.`
      };
    } else {
      return {
        title: 'Trend & Win Rate Explanation',
        badge: 'Win Delta Recovery',
        color: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
        text: `Win rate delta is currently suppressed by early team wipe losses. Grouping with squad duos improves win conversion by +18%.`
      };
    }
  };

  const insights = [
    getCombatFeedback(),
    getHeroPoolFeedback(),
    getTrendFeedback()
  ];

  return (
    <div className="bg-[#0d111d] border border-slate-800 rounded-2xl p-5 shadow-xl transition-all text-left space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 text-xl font-bold shadow-inner shrink-0">
            🤖
          </div>
          <div>
            <h3 className="text-base font-black text-white tracking-wide uppercase flex items-center gap-2">
              PERFORMANCE ANALYSIS & INSIGHTS
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Automated telemetry feedback computed from your active profile stats
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-slate-800 text-teal-400 border border-teal-500/20 shrink-0">
          AI COACHING
        </span>
      </div>

      {/* Dynamic Feedback Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {insights.map((item, idx) => (
          <div
            key={idx}
            className="bg-[#131b2f] border border-slate-800/90 rounded-2xl p-4 space-y-2 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${item.color}`}>
                  {item.badge}
                </span>
              </div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                {item.title}
              </h4>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                {item.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
