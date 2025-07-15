
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

// This function runs only on the client, once, to get the initial state.
const getInitialState = () => {
  if (typeof window === 'undefined') {
    // Return a default state for server-side rendering
    return {
      theme: 'zinc',
      isDarkMode: false,
      notificationSound: '/notification1.wav',
    };
  }
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'zinc';
    const storedIsDarkMode = JSON.parse(localStorage.getItem(DARK_MODE_STORAGE_KEY) || 'false');
    const storedNotificationSound = localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY) || '/notification1.wav';
    return {
      theme: storedTheme,
      isDarkMode: storedIsDarkMode,
      notificationSound: storedNotificationSound,
    };
  } catch (error) {
    console.warn('Failed to read theme from localStorage', error);
    // Fallback to default state in case of any error
    return {
      theme: 'zinc',
      isDarkMode: false,
      notificationSound: '/notification1.wav',
    };
  }
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize state directly from the function, which reads from localStorage.
  const [theme, setThemeState] = useState<Theme>(() => getInitialState().theme);
  const [isDarkMode, setIsDarkModeState] = useState<boolean>(() => getInitialState().isDarkMode);
  const [notificationSound, setNotificationSoundState] = useState<string>(() => getInitialState().notificationSound);

  useEffect(() => {
    // This effect runs whenever the theme or dark mode state changes.
    const body = window.document.body;

    // 1. Clean slate: Remove all old theme classes.
    const classesToRemove = Array.from(body.classList).filter(
      (cls) => cls.startsWith('theme-')
    );
    if (classesToRemove.length > 0) {
      body.classList.remove(...classesToRemove);
    }
    
    // 2. Apply the new theme class.
    body.classList.add(`theme-${theme}`);
    
    // 3. Apply or remove the 'dark' class based on the current state.
    if (isDarkMode) {
      body.classList.add('dark');
    } else {
      body.classList.remove('dark');
    }

  }, [theme, isDarkMode]); // Re-run this logic ONLY when theme or isDarkMode changes.

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    setThemeState(newTheme);
  };
  
  const toggleDarkMode = () => {
    setIsDarkModeState(prevIsDarkMode => {
      const newIsDarkMode = !prevIsDarkMode;
      localStorage.setItem(DARK_MODE_STORAGE_KEY, JSON.stringify(newIsDarkMode));
      return newIsDarkMode;
    });
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
