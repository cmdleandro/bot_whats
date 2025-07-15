'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

const THEME_STORAGE_KEY = 'chatview-theme';
const DARK_MODE_STORAGE_KEY = 'chatview-dark-mode';
const NOTIFICATION_SOUND_STORAGE_KEY = 'chatview-notification-sound';

type Theme = string;
type ThemeProviderState = {
  theme: Theme;
  isDarkMode: boolean;
  notificationSound: string;
  setTheme: (theme: Theme) => void;
  toggleDarkMode: () => void;
  setNotificationSound: (sound: string) => void;
};

const initialState: ThemeProviderState = {
  theme: 'zinc', // Set a default theme
  isDarkMode: false,
  notificationSound: '/notification1.wav', // Default sound
  setTheme: () => null,
  toggleDarkMode: () => null,
  setNotificationSound: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return initialState.theme;
    return localStorage.getItem(THEME_STORAGE_KEY) || initialState.theme;
  });

  const [isDarkMode, setIsDarkModeState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return initialState.isDarkMode;
    const storedValue = localStorage.getItem(DARK_MODE_STORAGE_KEY);
    return storedValue ? JSON.parse(storedValue) : initialState.isDarkMode;
  });

  const [notificationSound, setNotificationSoundState] = useState<string>(() => {
    if (typeof window === 'undefined') return initialState.notificationSound;
    return localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY) || initialState.notificationSound;
  });

  useEffect(() => {
    const body = window.document.body;
    body.classList.forEach(className => {
      if (className.startsWith('theme-')) {
        body.classList.remove(className);
      }
    });

    if (theme) {
      body.classList.add(`theme-${theme}`);
    }
    
    if (isDarkMode) {
      body.classList.add('dark');
    } else {
      body.classList.remove('dark');
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
  };

  const setNotificationSound = (newSound: string) => {
    localStorage.setItem(NOTIFICATION_SOUND_STORAGE_KEY, newSound);
    setNotificationSoundState(newSound);
  };

  const value = useMemo(() => ({
    theme,
    isDarkMode,
    notificationSound,
    setTheme,
    toggleDarkMode,
    setNotificationSound,
  }), [theme, isDarkMode, notificationSound]);

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
