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
  theme: 'blue',
  isDarkMode: false,
  notificationSound: '/notification1.wav',
  setTheme: () => null,
  toggleDarkMode: () => null,
  setNotificationSound: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialState.theme);
  const [isDarkMode, setIsDarkModeState] = useState<boolean>(initialState.isDarkMode);
  const [notificationSound, setNotificationSoundState] = useState<string>(initialState.notificationSound);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setThemeState(localStorage.getItem(THEME_STORAGE_KEY) || initialState.theme);
    setIsDarkModeState(JSON.parse(localStorage.getItem(DARK_MODE_STORAGE_KEY) || 'false'));
    setNotificationSoundState(localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY) || initialState.notificationSound);
    setIsMounted(true);
  }, []);


  useEffect(() => {
    if (isMounted) {
        const body = window.document.body;
        
        // Clear all theme classes
        body.classList.forEach(className => {
            if (className.startsWith('theme-')) {
                body.classList.remove(className);
            }
        });

        // Add current theme class
        if (theme) {
          body.classList.add(`theme-${theme}`);
        }

        // Toggle dark class
        if (isDarkMode) {
          body.classList.add('dark');
        } else {
          body.classList.remove('dark');
        }
    }
  }, [theme, isDarkMode, isMounted]);

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

  if (!isMounted) {
    // Render children without theme classes on the server and before hydration
    return <>{children}</>;
  }

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
