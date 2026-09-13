import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const THEME_PALETTES = [
  { id: 'default', name: 'Default', bg: '#080b13', accent: '#38bdf8', badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/40', swatchGradient: 'from-sky-500 to-blue-600' },
  { id: 'kinetic-purple', name: 'Kinetic Purple', bg: '#0a0512', accent: '#d946ef', badgeBg: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40', swatchGradient: 'from-fuchsia-500 to-purple-700' },
  { id: 'gamma-green', name: 'Gamma Green', bg: '#040d06', accent: '#22c55e', badgeBg: 'bg-green-500/20 text-green-300 border-green-500/40', swatchGradient: 'from-green-500 to-emerald-700' },
  { id: 'jean-grey', name: 'Jean Grey', bg: '#09090b', accent: '#f4f4f5', badgeBg: 'bg-zinc-500/20 text-zinc-200 border-zinc-500/40', swatchGradient: 'from-zinc-300 to-slate-500' },
  { id: 'oops-all-hallways', name: 'Oops, All Hallways', bg: '#0a0303', accent: '#ef4444', badgeBg: 'bg-red-500/20 text-red-300 border-red-500/40', swatchGradient: 'from-red-600 to-rose-800' }
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
