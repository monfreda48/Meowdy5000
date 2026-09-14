import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const THEME_PALETTES = [
  { id: 'default', name: 'Default Cobalt' },
  { id: 'kinetic-purple', name: 'Kinetic Purple' },
  { id: 'gamma-green', name: 'Gamma Green' },
  { id: 'jean-grey', name: 'Jean Grey (Crimson)' },
  { id: 'oops-all-hallways', name: 'Oops All Hallways (Slate)' }
];

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('m5_theme') || 'default';
    } catch {
      return 'default';
    }
  });

  // Synchronously update BOTH <html> and <body> on EVERY state change
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // 1. Set data-theme attribute on both root and body
    root.setAttribute('data-theme', theme);
    body.setAttribute('data-theme', theme);

    // 2. Set theme class for selector redundancy
    root.className = `theme-${theme}`;
    body.className = `theme-${theme} bg-[var(--theme-bg)] text-[var(--theme-text)] min-h-screen`;

    // 3. Persist to storage
    try {
      localStorage.setItem('m5_theme', theme);
      localStorage.setItem('app_color_theme', theme);
      localStorage.setItem('m5_color_scheme', theme);
    } catch (e) {}
  }, [theme]);

  const changeTheme = (newTheme) => {
    if (!newTheme) return;
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ currentTheme: theme, theme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
