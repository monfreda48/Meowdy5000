import React, { createContext, useContext, useState, useMemo } from 'react';

const TelemetryContext = createContext();

export function TelemetryProvider({ children, rawData }) {
  const [mode, setMode] = useState('all'); // 'competitive' | 'quickplay' | 'all'
  const [heroSortKey, setHeroSortKey] = useState('matches');
  const [heroSortDir, setHeroSortDir] = useState('desc');

  const filteredData = useMemo(() => {
    if (!rawData) return null;

    const rm = rawData.rivalsmeta_tabs || rawData.tabs || {};
    const tgg = rawData.trackergg_tabs || {};

    let heroes = [];
    let roles = [];

    if (mode === 'competitive') {
      heroes = rm.heroes_competitive?.heroes || rawData.heroes_competitive || [];
      roles = rm.heroes_competitive?.roles || [];
    } else if (mode === 'quickplay') {
      heroes = rm.heroes_quickplay?.heroes || rm.heroes?.heroes || rawData.heroes_quickplay || [];
      roles = rm.heroes_quickplay?.roles || rm.heroes?.roles || [];
    } else {
      heroes = tgg.heroes || rm.heroes?.heroes || rawData.top_heroes || rawData.heroes || [];
      roles = tgg.roles || rm.heroes?.roles || rawData.role_breakdown || [];
    }

    const sortedHeroes = [...heroes].sort((a, b) => {
      const valA = a[heroSortKey] ?? 0;
      const valB = b[heroSortKey] ?? 0;
      return heroSortDir === 'desc' ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
    });

    return {
      ...rawData,
      activeMode: mode,
      activeHeroes: sortedHeroes,
      activeRoles: roles,
      matchups: rm.matchups?.matchups || rawData.matchups || [],
      maps: rm.maps?.maps || rawData.maps || [],
      punishments: rm.punishments?.punishments || rawData.punishments || [],
      accolades: rm.all_time?.all_time?.accolades || rawData.accolades || {}
    };
  }, [rawData, mode, heroSortKey, heroSortDir]);

  const value = {
    mode,
    setMode,
    heroSortKey,
    setHeroSortKey,
    heroSortDir,
    setHeroSortDir,
    filteredData
  };

  return (
    <TelemetryContext.Provider value={value}>
      {children}
    </TelemetryContext.Provider>
  );
}

export const useTelemetry = () => useContext(TelemetryContext);
