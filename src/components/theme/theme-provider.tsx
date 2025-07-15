
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

const initialState: Omit<ThemeProviderState, 'setTheme' | 'toggleDarkMode' | 'setNotificationSound'> = {
  theme: 'zinc',
  isDarkMode: false,
  notificationSound: '/notification1.wav',
};

// Helper function to get initial state from localStorage
const getInitialState = () => {
  if (typeof window === 'undefined') {
    return initialState;
  }
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const storedIsDarkMode = localStorage.getItem(DARK_MODE_STORAGE_KEY);
    const storedNotificationSound = localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY);

    return {
      theme: storedTheme || initialState.theme,
      isDarkMode: storedIsDarkMode ? JSON.parse(storedIsDarkMode) : initialState.isDarkMode,
      notificationSound: storedNotificationSound || initialState.notificationSound,
    };
  } catch (error) {
    console.warn('Failed to read theme from localStorage', error);
    return initialState;
  }
};


const ThemeProviderContext = createContext<ThemeProviderState>({
  ...getInitialState(),
  setTheme: () => null,
  toggleDarkMode: () => null,
  setNotificationSound: () => null,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialState().theme);
  const [isDarkMode, setIsDarkModeState] = useState<boolean>(() => getInitialState().isDarkMode);
  const [notificationSound, setNotificationSoundState] = useState<string>(() => getInitialState().notificationSound);

  useEffect(() => {
    const body = window.document.body;
    
    // 1. Clear all existing theme-related classes to start fresh.
    const classesToRemove = Array.from(body.classList).filter(
      cls => cls.startsWith('theme-')
    );
    if (classesToRemove.length > 0) {
      body.classList.remove(...classesToRemove);
    }

    // 2. Add the current theme class.
    body.classList.add(`theme-${theme}`);

    // 3. Apply or remove the 'dark' class based on the state.
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
