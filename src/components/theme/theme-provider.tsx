
'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

const THEME_STORAGE_KEY = 'chatview-theme';
const DARK_MODE_STORAGE_KEY = 'chatview-dark-mode';
const NOTIFICATION_SOUND_STORAGE_KEY = 'chatview-notification-sound';
const PLAYBACK_SPEED_STORAGE_KEY = 'chatview-playback-speed';

type ThemeName = 'zinc' | 'slate' | 'blue' | 'green' | 'orange' | 'rose' | 'violet' | 'yellow';
type CssVariables = {
  [key: string]: string;
};
type ThemeDefinition = {
  light: CssVariables;
  dark: CssVariables;
};

const themes: Record<ThemeName, ThemeDefinition> = {
  zinc: {
    light: {
      '--background': '0 0% 100%',
      '--foreground': '222.2 84% 4.9%',
      '--card': '0 0% 100%',
      '--card-foreground': '222.2 84% 4.9%',
      '--popover': '0 0% 100%',
      '--popover-foreground': '222.2 84% 4.9%',
      '--primary': '221.2 83.2% 53.3%',
      '--primary-foreground': '210 40% 98%',
      '--secondary': '210 40% 96.1%',
      '--secondary-foreground': '210 40% 9.8%',
      '--muted': '210 40% 96.1%',
      '--muted-foreground': '215.4 16.3% 46.9%',
      '--accent': '210 40% 96.1%',
      '--accent-foreground': '210 40% 9.8%',
      '--destructive': '0 84.2% 60.2%',
      '--destructive-foreground': '210 40% 98%',
      '--border': '214.3 31.8% 91.4%',
      '--input': '214.3 31.8% 91.4%',
      '--ring': '221.2 83.2% 53.3%',
      '--sidebar-background': '220 13% 91%',
      '--sidebar-foreground': '222.2 84% 4.9%',
      '--sidebar-border': '220 13% 85%',
      '--sidebar-accent': '221.2 83.2% 53.3%',
      '--sidebar-accent-foreground': '210 40% 98%',
      '--sidebar-ring': '221.2 83.2% 53.3%',
    },
    dark: {
      '--background': '222.2 84% 4.9%',
      '--foreground': '210 40% 98%',
      '--card': '222.2 84% 4.9%',
      '--card-foreground': '210 40% 98%',
      '--popover': '222.2 84% 4.9%',
      '--popover-foreground': '210 40% 98%',
      '--primary': '210 40% 98%',
      '--primary-foreground': '222.2 47.4% 11.2%',
      '--secondary': '217.2 32.6% 17.5%',
      '--secondary-foreground': '210 40% 98%',
      '--muted': '217.2 32.6% 17.5%',
      '--muted-foreground': '215 20.2% 65.1%',
      '--accent': '217.2 32.6% 17.5%',
      '--accent-foreground': '210 40% 98%',
      '--destructive': '0 62.8% 30.6%',
      '--destructive-foreground': '210 40% 98%',
      '--border': '217.2 32.6% 17.5%',
      '--input': '217.2 32.6% 17.5%',
      '--ring': '210 40% 98%',
      '--sidebar-background': '220 13% 15%',
      '--sidebar-foreground': '210 40% 98%',
      '--sidebar-border': '220 13% 25%',
      '--sidebar-accent': '210 40% 98%',
      '--sidebar-accent-foreground': '222.2 47.4% 11.2%',
      '--sidebar-ring': '210 40% 98%',
    }
  },
  slate: {
    light: {
      '--background': '0 0% 100%',
      '--foreground': '222.2 84% 4.9%',
      '--card': '0 0% 100%',
      '--card-foreground': '222.2 84% 4.9%',
      '--popover': '0 0% 100%',
      '--popover-foreground': '222.2 84% 4.9%',
      '--primary': '215.4 16.3% 46.9%',
      '--primary-foreground': '210 40% 98%',
      '--secondary': '210 40% 96.1%',
      '--secondary-foreground': '222.2 47.4% 11.2%',
      '--muted': '210 40% 96.1%',
      '--muted-foreground': '215.4 16.3% 46.9%',
      '--accent': '210 40% 96.1%',
      '--accent-foreground': '222.2 47.4% 11.2%',
      '--destructive': '0 84.2% 60.2%',
      '--destructive-foreground': '210 40% 98%',
      '--border': '214.3 31.8% 91.4%',
      '--input': '214.3 31.8% 91.4%',
      '--ring': '215.4 16.3% 46.9%',
      '--sidebar-background': '210 40% 96.1%',
      '--sidebar-foreground': '222.2 47.4% 11.2%',
      '--sidebar-border': '214.3 31.8% 91.4%',
      '--sidebar-accent': '215.4 16.3% 46.9%',
      '--sidebar-accent-foreground': '210 40% 98%',
      '--sidebar-ring': '215.4 16.3% 46.9%',
    },
    dark: {
      '--background': '222.2 84% 4.9%',
      '--foreground': '210 40% 98%',
      '--card': '222.2 84% 4.9%',
      '--card-foreground': '210 40% 98%',
      '--popover': '222.2 84% 4.9%',
      '--popover-foreground': '210 40% 98%',
      '--primary': '210 40% 98%',
      '--primary-foreground': '222.2 47.4% 11.2%',
      '--secondary': '217.2 32.6% 17.5%',
      '--secondary-foreground': '210 40% 98%',
      '--muted': '217.2 32.6% 17.5%',
      '--muted-foreground': '215 20.2% 65.1%',
      '--accent': '217.2 32.6% 17.5%',
      '--accent-foreground': '210 40% 98%',
      '--destructive': '0 62.8% 30.6%',
      '--destructive-foreground': '210 40% 98%',
      '--border': '217.2 32.6% 17.5%',
      '--input': '217.2 32.6% 17.5%',
      '--ring': '210 40% 98%',
      '--sidebar-background': '217.2 32.6% 17.5%',
      '--sidebar-foreground': '210 40% 98%',
      '--sidebar-border': '217.2 32.6% 17.5%',
      '--sidebar-accent': '210 40% 98%',
      '--sidebar-accent-foreground': '222.2 47.4% 11.2%',
      '--sidebar-ring': '210 40% 98%',
    }
  },
  blue: {
    light: {
      '--background': '210 100% 98%',
      '--foreground': '224 71% 4%',
      '--primary': '220 90% 60%',
      '--primary-foreground': '210 20% 98%',
      '--card': '220 100% 100%',
      '--secondary': '220 15% 96%',
      '--muted': '220 15% 96%',
      '--muted-foreground': '220 9% 46%',
      '--accent': '220 15% 96%',
      '--accent-foreground': '224 71% 4%',
      '--border': '220 13% 91%',
      '--input': '220 13% 91%',
      '--ring': '220 90% 60%',
      '--sidebar-background': '220 14% 96%',
      '--sidebar-foreground': '224 71% 4%',
      '--sidebar-border': '220 13% 91%',
      '--sidebar-accent': '220 90% 60%',
      '--sidebar-accent-foreground': '210 20% 98%',
    },
    dark: {
      '--background': '221 83% 9%',
      '--foreground': '210 20% 98%',
      '--card': '221 83% 12%',
      '--primary': '217 91% 60%',
      '--primary-foreground': '221 20% 98%',
      '--secondary': '216 34% 17%',
      '--muted': '216 34% 17%',
      '--muted-foreground': '216 15% 65%',
      '--accent': '216 34% 17%',
      '--accent-foreground': '210 20% 98%',
      '--border': '216 34% 17%',
      '--input': '216 34% 17%',
      '--ring': '217 91% 60%',
      '--sidebar-background': '221 83% 12%',
      '--sidebar-foreground': '210 20% 98%',
      '--sidebar-border': '216 34% 17%',
      '--sidebar-accent': '217 91% 60%',
      '--sidebar-accent-foreground': '221 20% 98%',
    }
  },
  green: {
    light: {
      '--background': '140 70% 98%',
      '--foreground': '145 60% 10%',
      '--card': '140 100% 100%',
      '--primary': '142.1 76.2% 36.3%',
      '--primary-foreground': '140 20% 98%',
      '--secondary': '140 15% 96%',
      '--muted': '140 15% 96%',
      '--muted-foreground': '140 9% 46%',
      '--accent': '140 15% 96%',
      '--accent-foreground': '145 60% 10%',
      '--border': '140 13% 91%',
      '--input': '140 13% 91%',
      '--ring': '142.1 76.2% 36.3%',
      '--sidebar-background': '140 14% 96%',
      '--sidebar-foreground': '145 60% 10%',
      '--sidebar-border': '140 13% 91%',
      '--sidebar-accent': '142.1 76.2% 36.3%',
      '--sidebar-accent-foreground': '140 20% 98%',
    },
    dark: {
      '--background': '141 78% 9%',
      '--foreground': '140 20% 98%',
      '--card': '141 78% 12%',
      '--primary': '142.1 70.2% 45.3%',
      '--primary-foreground': '140 20% 98%',
      '--secondary': '144 34% 17%',
      '--muted': '144 34% 17%',
      '--muted-foreground': '144 15% 65%',
      '--accent': '144 34% 17%',
      '--accent-foreground': '140 20% 98%',
      '--border': '144 34% 17%',
      '--input': '144 34% 17%',
      '--ring': '142.1 70.2% 45.3%',
      '--sidebar-background': '141 78% 12%',
      '--sidebar-foreground': '140 20% 98%',
      '--sidebar-border': '144 34% 17%',
      '--sidebar-accent': '142.1 70.2% 45.3%',
      '--sidebar-accent-foreground': '140 20% 98%',
    }
  },
  orange: {
    light: {
      '--background': '25 100% 98%',
      '--foreground': '20 80% 15%',
      '--card': '25 100% 100%',
      '--primary': '24.6 95% 53.1%',
      '--primary-foreground': '20 20% 98%',
      '--secondary': '25 15% 96%',
      '--muted': '25 15% 96%',
      '--muted-foreground': '25 9% 46%',
      '--accent': '25 15% 96%',
      '--accent-foreground': '20 80% 15%',
      '--border': '25 13% 91%',
      '--input': '25 13% 91%',
      '--ring': '24.6 95% 53.1%',
      '--sidebar-background': '25 14% 96%',
      '--sidebar-foreground': '20 80% 15%',
      '--sidebar-border': '25 13% 91%',
      '--sidebar-accent': '24.6 95% 53.1%',
      '--sidebar-accent-foreground': '20 20% 98%',
    },
    dark: {
      '--background': '24 90% 9%',
      '--foreground': '24 20% 98%',
      '--card': '24 90% 12%',
      '--primary': '24.6 95% 53.1%',
      '--primary-foreground': '24 20% 98%',
      '--secondary': '22 34% 17%',
      '--muted': '22 34% 17%',
      '--muted-foreground': '22 15% 65%',
      '--accent': '22 34% 17%',
      '--accent-foreground': '24 20% 98%',
      '--border': '22 34% 17%',
      '--input': '22 34% 17%',
      '--ring': '24.6 95% 53.1%',
      '--sidebar-background': '24 90% 12%',
      '--sidebar-foreground': '24 20% 98%',
      '--sidebar-border': '22 34% 17%',
      '--sidebar-accent': '24.6 95% 53.1%',
      '--sidebar-accent-foreground': '24 20% 98%',
    }
  },
  rose: {
    light: {
      '--background': '345 100% 98%',
      '--foreground': '345 80% 15%',
      '--card': '345 100% 100%',
      '--primary': '346.8 77.2% 49.8%',
      '--primary-foreground': '345 20% 98%',
      '--secondary': '345 15% 96%',
      '--muted': '345 15% 96%',
      '--muted-foreground': '345 9% 46%',
      '--accent': '345 15% 96%',
      '--accent-foreground': '345 80% 15%',
      '--border': '345 13% 91%',
      '--input': '345 13% 91%',
      '--ring': '346.8 77.2% 49.8%',
      '--sidebar-background': '345 14% 96%',
      '--sidebar-foreground': '345 80% 15%',
      '--sidebar-border': '345 13% 91%',
      '--sidebar-accent': '346.8 77.2% 49.8%',
      '--sidebar-accent-foreground': '345 20% 98%',
    },
    dark: {
      '--background': '347 80% 9%',
      '--foreground': '347 20% 98%',
      '--card': '347 80% 12%',
      '--primary': '346.8 77.2% 49.8%',
      '--primary-foreground': '347 20% 98%',
      '--secondary': '345 34% 17%',
      '--muted': '345 34% 17%',
      '--muted-foreground': '345 15% 65%',
      '--accent': '345 34% 17%',
      '--accent-foreground': '347 20% 98%',
      '--border': '345 34% 17%',
      '--input': '345 34% 17%',
      '--ring': '346.8 77.2% 49.8%',
      '--sidebar-background': '347 80% 12%',
      '--sidebar-foreground': '347 20% 98%',
      '--sidebar-border': '345 34% 17%',
      '--sidebar-accent': '346.8 77.2% 49.8%',
      '--sidebar-accent-foreground': '347 20% 98%',
    }
  },
  violet: {
    light: {
      '--background': '255 100% 98%',
      '--foreground': '258 80% 15%',
      '--card': '255 100% 100%',
      '--primary': '258.8 77.2% 55.8%',
      '--primary-foreground': '255 20% 98%',
      '--secondary': '255 15% 96%',
      '--muted': '255 15% 96%',
      '--muted-foreground': '255 9% 46%',
      '--accent': '255 15% 96%',
      '--accent-foreground': '258 80% 15%',
      '--border': '255 13% 91%',
      '--input': '255 13% 91%',
      '--ring': '258.8 77.2% 55.8%',
      '--sidebar-background': '255 14% 96%',
      '--sidebar-foreground': '258 80% 15%',
      '--sidebar-border': '255 13% 91%',
      '--sidebar-accent': '258.8 77.2% 55.8%',
      '--sidebar-accent-foreground': '255 20% 98%',
    },
    dark: {
      '--background': '258 80% 9%',
      '--foreground': '258 20% 98%',
      '--card': '258 80% 12%',
      '--primary': '258.8 77.2% 55.8%',
      '--primary-foreground': '258 20% 98%',
      '--secondary': '255 34% 17%',
      '--muted': '255 34% 17%',
      '--muted-foreground': '255 15% 65%',
      '--accent': '255 34% 17%',
      '--accent-foreground': '258 20% 98%',
      '--border': '255 34% 17%',
      '--input': '255 34% 17%',
      '--ring': '258.8 77.2% 55.8%',
      '--sidebar-background': '258 80% 12%',
      '--sidebar-foreground': '258 20% 98%',
      '--sidebar-border': '255 34% 17%',
      '--sidebar-accent': '258.8 77.2% 55.8%',
      '--sidebar-accent-foreground': '258 20% 98%',
    }
  },
  yellow: {
    light: {
      '--background': '45 100% 98%',
      '--foreground': '40 80% 15%',
      '--card': '45 100% 100%',
      '--primary': '44.6 95% 53.1%',
      '--primary-foreground': '40 20% 98%',
      '--secondary': '45 15% 96%',
      '--muted': '45 15% 96%',
      '--muted-foreground': '45 9% 46%',
      '--accent': '45 15% 96%',
      '--accent-foreground': '40 80% 15%',
      '--border': '45 13% 91%',
      '--input': '45 13% 91%',
      '--ring': '44.6 95% 53.1%',
      '--sidebar-background': '45 14% 96%',
      '--sidebar-foreground': '40 80% 15%',
      '--sidebar-border': '45 13% 91%',
      '--sidebar-accent': '44.6 95% 53.1%',
      '--sidebar-accent-foreground': '40 20% 98%',
    },
    dark: {
      '--background': '40 80% 9%',
      '--foreground': '40 20% 98%',
      '--card': '40 80% 12%',
      '--primary': '44.6 95% 53.1%',
      '--primary-foreground': '40 20% 98%',
      '--secondary': '42 34% 17%',
      '--muted': '42 34% 17%',
      '--muted-foreground': '42 15% 65%',
      '--accent': '42 34% 17%',
      '--accent-foreground': '40 20% 98%',
      '--border': '42 34% 17%',
      '--input': '42 34% 17%',
      '--ring': '44.6 95% 53.1%',
      '--sidebar-background': '40 80% 12%',
      '--sidebar-foreground': '40 20% 98%',
      '--sidebar-border': '42 34% 17%',
      '--sidebar-accent': '44.6 95% 53.1%',
      '--sidebar-accent-foreground': '40 20% 98%',
    }
  },
};


type ThemeProviderState = {
  theme: ThemeName;
  isDarkMode: boolean;
  notificationSound: string;
  playbackSpeed: number;
  setTheme: (theme: ThemeName) => void;
  toggleDarkMode: () => void;
  setNotificationSound: (sound: string) => void;
  setPlaybackSpeed: (speed: number) => void;
};

const getInitialState = () => {
  if (typeof window === 'undefined') {
    return {
      theme: 'zinc' as ThemeName,
      isDarkMode: false,
      notificationSound: '/notification1.wav',
      playbackSpeed: 1,
    };
  }
  try {
    const storedTheme = (localStorage.getItem(THEME_STORAGE_KEY) || 'zinc') as ThemeName;
    const storedIsDarkMode = JSON.parse(localStorage.getItem(DARK_MODE_STORAGE_KEY) || 'false');
    const storedNotificationSound = localStorage.getItem(NOTIFICATION_SOUND_STORAGE_KEY) || '/notification1.wav';
    const storedPlaybackSpeed = JSON.parse(localStorage.getItem(PLAYBACK_SPEED_STORAGE_KEY) || '1');
    return {
      theme: storedTheme,
      isDarkMode: storedIsDarkMode,
      notificationSound: storedNotificationSound,
      playbackSpeed: storedPlaybackSpeed,
    };
  } catch (error) {
    console.warn('Failed to read theme from localStorage', error);
    return {
      theme: 'zinc' as ThemeName,
      isDarkMode: false,
      notificationSound: '/notification1.wav',
      playbackSpeed: 1,
    };
  }
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const initialState = useMemo(() => getInitialState(), []);
  const [theme, setThemeState] = useState<ThemeName>(initialState.theme);
  const [isDarkMode, setIsDarkModeState] = useState<boolean>(initialState.isDarkMode);
  const [notificationSound, setNotificationSoundState] = useState<string>(initialState.notificationSound);
  const [playbackSpeed, setPlaybackSpeedState] = useState<number>(initialState.playbackSpeed);
  
  useEffect(() => {
    const root = window.document.documentElement;
    const mode = isDarkMode ? 'dark' : 'light';
    const selectedThemeColors = themes[theme][mode];

    for (const [property, value] of Object.entries(selectedThemeColors)) {
      root.style.setProperty(property, value);
    }
    
  }, [theme, isDarkMode]);

  const setTheme = (newTheme: ThemeName) => {
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
  
  const setPlaybackSpeed = (newSpeed: number) => {
    localStorage.setItem(PLAYBACK_SPEED_STORAGE_KEY, JSON.stringify(newSpeed));
    setPlaybackSpeedState(newSpeed);
  };

  const value = useMemo(() => ({
    theme,
    isDarkMode,
    notificationSound,
    playbackSpeed,
    setTheme,
    toggleDarkMode,
    setNotificationSound,
    setPlaybackSpeed,
  }), [theme, isDarkMode, notificationSound, playbackSpeed]);

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
