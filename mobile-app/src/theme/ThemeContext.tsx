import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePreset = 'DEFAULT_DARK' | 'GAMBIT_PURPLE' | 'CYBERPUNK';

export interface ThemeColors {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  text: string;
  cardBorder: string;
}

export const THEME_PALETTES: Record<ThemePreset, ThemeColors> = {
  DEFAULT_DARK: {
    background: '#1E1E1E',
    surface: '#121212',
    primary: '#90CAF9',
    secondary: '#06B6D4',
    text: '#E0E0E0',
    cardBorder: 'rgba(144, 202, 249, 0.3)'
  },
  GAMBIT_PURPLE: {
    background: '#0F0B15',
    surface: '#1A1325',
    primary: '#FF2A85',
    secondary: '#9D4EDD',
    text: '#F3E8FF',
    cardBorder: 'rgba(255, 42, 133, 0.3)'
  },
  CYBERPUNK: {
    background: '#050507',
    surface: '#0D0D11',
    primary: '#FFE600',
    secondary: '#00F0FF',
    text: '#F0F0F0',
    cardBorder: 'rgba(255, 230, 0, 0.3)'
  }
};

interface ThemeContextType {
  currentTheme: ThemePreset;
  themeColors: ThemeColors;
  setTheme: (theme: ThemePreset) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  currentTheme: 'DEFAULT_DARK',
  themeColors: THEME_PALETTES.DEFAULT_DARK,
  setTheme: () => {}
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTheme, setCurrentThemeState] = useState<ThemePreset>('DEFAULT_DARK');

  useEffect(() => {
    AsyncStorage.getItem('app_theme_selection').then(saved => {
      if (saved && THEME_PALETTES[saved as ThemePreset]) {
        setCurrentThemeState(saved as ThemePreset);
      }
    });
  }, []);

  const setTheme = (theme: ThemePreset) => {
    setCurrentThemeState(theme);
    AsyncStorage.setItem('app_theme_selection', theme).catch(console.error);
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, themeColors: THEME_PALETTES[currentTheme], setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
