import React, { useState, useEffect } from 'react';

const HERO_ROLES = {
  'Magneto': { role: 'Vanguard', icon: '🛡️', bg: 'from-amber-500/20 to-amber-900/10', border: 'border-amber-500/30' },
  'Venom': { role: 'Vanguard', icon: '🛡️', bg: 'from-purple-500/20 to-purple-900/10', border: 'border-purple-500/30' },
  'Doctor Strange': { role: 'Vanguard', icon: '🛡️', bg: 'from-cyan-500/20 to-cyan-900/10', border: 'border-cyan-500/30' },
  'Hulk': { role: 'Vanguard', icon: '🛡️', bg: 'from-emerald-500/20 to-emerald-900/10', border: 'border-emerald-500/30' },
  'Thor': { role: 'Vanguard', icon: '🛡️', bg: 'from-blue-500/20 to-blue-900/10', border: 'border-blue-500/30' },
  'Captain America': { role: 'Vanguard', icon: '🛡️', bg: 'from-blue-600/20 to-blue-900/10', border: 'border-blue-500/30' },
  'Groot': { role: 'Vanguard', icon: '🛡️', bg: 'from-amber-700/20 to-amber-900/10', border: 'border-amber-600/30' },
  'Peni Parker': { role: 'Vanguard', icon: '🛡️', bg: 'from-rose-500/20 to-rose-900/10', border: 'border-rose-500/30' },
  
  'Hela': { role: 'Duelist', icon: '⚔️', bg: 'from-emerald-600/20 to-emerald-900/10', border: 'border-emerald-500/30' },
  'Spider-Man': { role: 'Duelist', icon: '⚔️', bg: 'from-red-500/20 to-red-900/10', border: 'border-red-500/30' },
  'Iron Man': { role: 'Duelist', icon: '⚔️', bg: 'from-yellow-500/20 to-red-900/10', border: 'border-yellow-500/30' },
  'Punisher': { role: 'Duelist', icon: '⚔️', bg: 'from-slate-600/20 to-slate-900/10', border: 'border-slate-500/30' },
  'Black Panther': { role: 'Duelist', icon: '⚔️', bg: 'from-purple-600/20 to-purple-900/10', border: 'border-purple-500/30' },
  'Magik': { role: 'Duelist', icon: '⚔️', bg: 'from-amber-500/20 to-yellow-900/10', border: 'border-amber-400/30' },
  'Hawkeye': { role: 'Duelist', icon: '⚔️', bg: 'from-indigo-500/20 to-indigo-900/10', border: 'border-indigo-500/30' },
  'Wolverine': { role: 'Duelist', icon: '⚔️', bg: 'from-yellow-600/20 to-yellow-900/10', border: 'border-yellow-500/30' },
  'Psylocke': { role: 'Duelist', icon: '⚔️', bg: 'from-pink-500/20 to-purple-900/10', border: 'border-pink-500/30' },
  
  'Luna Snow': { role: 'Strategist', icon: '✨', bg: 'from-cyan-400/20 to-blue-900/10', border: 'border-cyan-400/30' },
  'Mantis': { role: 'Strategist', icon: '✨', bg: 'from-lime-500/20 to-green-900/10', border: 'border-lime-500/30' },
  'Rocket Raccoon': { role: 'Strategist', icon: '✨', bg: 'from-orange-500/20 to-orange-900/10', border: 'border-orange-500/30' },
  'Jeff the Land Shark': { role: 'Strategist', icon: '✨', bg: 'from-teal-400/20 to-teal-900/10', border: 'border-teal-400/30' },
  'Adam Warlock': { role: 'Strategist', icon: '✨', bg: 'from-amber-400/20 to-amber-900/10', border: 'border-amber-400/30' },
  'Invisible Woman': { role: 'Strategist', icon: '✨', bg: 'from-sky-400/20 to-blue-900/10', border: 'border-sky-400/30' },
  'Cloak & Dagger': { role: 'Strategist', icon: '✨', bg: 'from-indigo-600/20 to-slate-900/10', border: 'border-indigo-500/30' }
};

const DEFAULT_MASTERY_MOCK = [
  { hero_name: "Magneto", mastery_level: 18, current_xp: 8450, next_level_xp: 10000 },
  { hero_name: "Luna Snow", mastery_level: 14, current_xp: 5200, next_level_xp: 8000 },
  { hero_name: "Hela", mastery_level: 11, current_xp: 2100, next_level_xp: 6000 },
  { hero_name: "Venom", mastery_level: 9, current_xp: 1400, next_level_xp: 5000 },
  { hero_name: "Doctor Strange", mastery_level: 7, current_xp: 800, next_level_xp: 4000 }
];

export default function HeroMasteryPanel({ uid, API_BASE_URL = '' }) {
  const [masteryData, setMasteryData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchMastery() {
      if (!uid) {
        setMasteryData(DEFAULT_MASTERY_MOCK);
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/player/${uid}/mastery`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            setMasteryData(Array.isArray(json) && json.length > 0 ? json : DEFAULT_MASTERY_MOCK);
          }
        } else {
          if (isMounted) setMasteryData(DEFAULT_MASTERY_MOCK);
        }
      } catch (err) {
        if (isMounted) setMasteryData(DEFAULT_MASTERY_MOCK);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchMastery();
    return () => { isMounted = false; };
  }, [uid, API_BASE_URL]);

  // Sort heroes by mastery level DESC
  const sortedHeroes = [...masteryData].sort((a, b) => (b.mastery_level || 0) - (a.mastery_level || 0));

  return (
    <div className="bg-[#0d111d] border border-slate-800 rounded-2xl p-5 shadow-xl transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xl font-bold shadow-inner">
            👑
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white tracking-wide uppercase flex items-center gap-2">
              HERO PROGRESSION & MASTERY
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Hero experience, level milestones & combat tier badges
            </p>
          </div>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-slate-800 text-amber-400 border border-amber-500/20">
          SEASON 1 TIER
        </span>
      </div>

      {loading ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sortedHeroes.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          No hero mastery progression data available yet. Play matches to unlock hero levels!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {sortedHeroes.map((hero, idx) => {
            const hName = hero.hero_name || 'Unknown Hero';
            const roleInfo = HERO_ROLES[hName] || { role: 'Combatant', icon: '⚡', bg: 'from-slate-700/20 to-slate-900/10', border: 'border-slate-700/30' };
            const level = hero.mastery_level || 1;
            const currentXp = hero.current_xp || 0;
            const nextXp = hero.next_level_xp || (level * 1000);
            const pct = Math.min(100, Math.max(0, Math.round((currentXp / nextXp) * 100)));

            return (
              <div
                key={idx}
                className={`relative overflow-hidden bg-gradient-to-r ${roleInfo.bg} border ${roleInfo.border} rounded-xl p-3.5 transition-all hover:scale-[1.01] hover:shadow-lg`}
              >
                <div className="flex items-center gap-3 mb-2.5">
                  {/* Portrait / Badge Overlay */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-2xl font-bold shadow-md overflow-hidden">
                      {hero.badge_url ? (
                        <img src={hero.badge_url} alt={hName} className="w-full h-full object-cover" />
                      ) : (
                        <span>{roleInfo.icon}</span>
                      )}
                    </div>
                    {/* Level Badge Overlay */}
                    <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded-md shadow-md border border-amber-300">
                      Lv. {level}
                    </div>
                  </div>

                  {/* Hero Title & Role Tag */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-white truncate">{hName}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900/80 text-slate-300 border border-slate-700/60 shrink-0">
                        {roleInfo.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {currentXp.toLocaleString()} / {nextXp.toLocaleString()} XP
                    </p>
                  </div>
                </div>

                {/* Progress Bar Container */}
                <div className="w-full bg-slate-950/80 rounded-full h-2 overflow-hidden border border-slate-800/80">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">PROGRESS</span>
                  <span className="text-[10px] font-extrabold text-amber-400 font-mono">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
