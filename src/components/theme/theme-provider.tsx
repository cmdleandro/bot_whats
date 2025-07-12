'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

const THEME_STORAGE_KEY = 'chatview-theme';
const DARK_MODE_STORAGE_KEY = 'chatview-dark-mode';

type Theme = string;
type ThemeProviderState = {
  theme: Theme;
  isDarkMode: boolean;
  setTheme: (theme: Theme) => void;
  toggleDarkMode: () => void;
};

const initialState: ThemeProviderState = {
  theme: 'iait',
  isDarkMode: false,
  setTheme: () => null,
  toggleDarkMode: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return initialState.theme;
    }
    return localStorage.getItem(THEME_STORAGE_KEY) || initialState.theme;
  });

  const [isDarkMode, setIsDarkModeState] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return initialState.isDarkMode;
    }
    const storedValue = localStorage.getItem(DARK_MODE_STORAGE_KEY);
    return storedValue ? JSON.parse(storedValue) : initialState.isDarkMode;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(...root.classList); // Remove all existing classes

    if (theme) {
      root.classList.add(`theme-${theme}`);
    }
    
    if (isDarkMode) {
      root.classList.add('dark');
    }
  }, [theme, isDarkMode]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    setThemeState(newTheme);
  };
  
  const toggleDarkMode = () => {
    const newIsDarkMode = !isDarkMode;
    localStorage.setItem(DARK_MODE_STORAGE_KEY, JSON.stringify(newIsDarkMode));
    setIsDarkModeState(newIsDarkMode);
  }

  const value = useMemo(() => ({
    theme,
    isDarkMode,
    setTheme,
    toggleDarkMode,
  }), [theme, isDarkMode]);

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
};
