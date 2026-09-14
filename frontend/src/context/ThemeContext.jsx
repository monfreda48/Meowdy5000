import React, { createContext, useContext, useState, useEffect } from 'react';

export const VALID_THEMES = [
  'default',
  'kinetic-purple',
  'gamma-green',
  'jean-grey',
  'oops-all-hallways'
];

export const THEME_PALETTES = [
  { id: 'default', name: 'Default Cobalt' },
  { id: 'kinetic-purple', name: 'Kinetic Purple' },
  { id: 'gamma-green', name: 'Gamma Green' },
  { id: 'jean-grey', name: 'Jean Grey' },
  { id: 'oops-all-hallways', name: 'Oops, All Hallways' }
];

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('m5_theme');
      return VALID_THEMES.includes(saved) ? saved : 'default';
    } catch {
      return 'default';
    }
  });

  // Synchronously mutate DOM and storage on every theme state update
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // Set attribute on both <html> and <body>
    root.setAttribute('data-theme', theme);
    body.setAttribute('data-theme', theme);

    // Sync class names for redundant CSS selector specificity
    root.className = `theme-${theme}`;
    body.className = `theme-${theme} min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)] transition-colors duration-150`;

    try {
      localStorage.setItem('m5_theme', theme);
    } catch (e) {}
  }, [theme]);

  const changeTheme = (newTheme) => {
    if (VALID_THEMES.includes(newTheme)) {
      setTheme(newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ currentTheme: theme, theme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      currentTheme: 'default',
      theme: 'default',
      changeTheme: () => {}
    };
  }
  return context;
};
