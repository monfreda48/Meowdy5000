import React from 'react';

const TABS = [
  { id: 'heroes', label: 'Heroes & Roles', emoji: '⚔️' },
  { id: 'matchups', label: 'Matchup Matrix', emoji: '👥' },
  { id: 'maps', label: 'Map Intelligence', emoji: '🗺️' },
  { id: 'standing', label: 'Fair Play & History', emoji: '🛡️' },
];

export default function ViewSwitcher({ activeTab, onTabChange }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3 mb-6 overflow-x-auto select-none no-scrollbar">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              isActive
                ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20'
                : 'bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <span className="text-sm">{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
