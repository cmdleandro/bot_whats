
'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';

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

const getInitialState = () => {
  if (typeof window === 'undefined') {
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
    return {
      theme: 'zinc',
      isDarkMode: false,
      notificationSound: '/notification1.wav',
    };
  }
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const initialState = useMemo(() => getInitialState(), []);
  const [theme, setThemeState] = useState<Theme>(initialState.theme);
  const [isDarkMode, setIsDarkModeState] = useState<boolean>(initialState.isDarkMode);
  const [notificationSound, setNotificationSoundState] = useState<string>(initialState.notificationSound);
  const { toast } = useToast();

  useEffect(() => {
    const body = window.document.body;

    // 1. Clean Slate: Remove all old theme-related classes.
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
    
    // 4. Debug log via Toast
    const currentClasses = Array.from(body.classList).join(' ');
    toast({
      title: "Debug: Classes aplicadas no <body>",
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{currentClasses}</code>
        </pre>
      ),
    });

  }, [theme, isDarkMode, toast]);

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
