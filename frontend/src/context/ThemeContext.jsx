import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const THEME_PALETTES = [
  { id: 'default', name: 'Default', bg: '#080b13', accent: '#38bdf8', badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/40', swatchGradient: 'from-sky-500 to-blue-600' },
  { id: 'cyberpunk', name: 'Cyberpunk', bg: '#0d0221', accent: '#ff007f', badgeBg: 'bg-pink-500/20 text-pink-300 border-pink-500/40', swatchGradient: 'from-pink-500 to-purple-600' },
  { id: 'midnight-stealth', name: 'Midnight Stealth', bg: '#000000', accent: '#10b981', badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', swatchGradient: 'from-emerald-500 to-teal-600' },
  { id: 'crimson-rival', name: 'Crimson Rival', bg: '#0f0505', accent: '#f43f5e', badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40', swatchGradient: 'from-rose-500 to-red-700' }
];

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('m5_theme') || localStorage.getItem('app_color_theme') || localStorage.getItem('m5_color_scheme') || 'default';
  });

  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    try {
      localStorage.setItem('m5_theme', newTheme);
      localStorage.setItem('app_color_theme', newTheme);
      localStorage.setItem('m5_color_scheme', newTheme);
    } catch (e) {}
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
