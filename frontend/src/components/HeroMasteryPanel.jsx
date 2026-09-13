import React from 'react';
import HeroProgression from './HeroProgression';

export default function HeroMasteryPanel({ heroes = [], season = "Season 10" }) {
  return <HeroProgression heroes={heroes} season={season} />;
}
