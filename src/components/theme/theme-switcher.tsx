'use client';

import * as React from 'react';
import { Moon, Palette, Sun, Check, Music4, Play } from 'lucide-react';

import { useTheme } from './theme-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const themes = [
  'zinc', 'blue', 'green', 'orange', 'rose', 'violet', 'yellow', 'slate'
];

const themeColors: Record<string, string> = {
  zinc: 'hsl(221.2 83.2% 53.3%)',
  blue: 'hsl(220 90% 60%)',
  green: 'hsl(142.1 76.2% 36.3%)',
  orange: 'hsl(24.6 95% 53.1%)',
  rose: 'hsl(346.8 77.2% 49.8%)',
  violet: 'hsl(258.8 77.2% 55.8%)',
  yellow: 'hsl(44.6 95% 53.1%)',
  slate: 'hsl(215.4 16.3% 46.9%)',
};


const notificationSounds = Array.from({ length: 9 }, (_, i) => `/notification${i + 1}.wav`);

export function ThemeSwitcher() {
  const { 
    theme, 
    setTheme, 
    isDarkMode, 
    toggleDarkMode,
    notificationSound,
    setNotificationSound,
  } = useTheme();

  const playSound = (soundSrc: string) => {
    const audio = new Audio(soundSrc);
    audio.play().catch(e => console.error("Falha ao tocar áudio de pré-visualização:", e));
  };
  
  const handleSoundItemClick = (e: React.MouseEvent, sound: string) => {
    e.stopPropagation();
    playSound(sound);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Palette className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Trocar Tema e Configurações</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={toggleDarkMode}>
          {isDarkMode ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
          <span>{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="mr-2 h-4 w-4" />
            <span>Temas de Cores</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {themes.map((t) => (
                <DropdownMenuItem key={t} onClick={() => setTheme(t)}>
                   <div className="h-4 w-4 rounded-full mr-2" style={{ backgroundColor: themeColors[t] }}/>
                   <span className="capitalize w-full flex items-center justify-between">
                    {t}
                    {theme === t && <Check className="h-4 w-4" />}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Music4 className="mr-2 h-4 w-4" />
            <span>Som de Notificação</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {notificationSounds.map((sound, index) => (
                <DropdownMenuItem key={sound} onClick={() => setNotificationSound(sound)}>
                  <span className="capitalize w-full flex items-center justify-between">
                    Notificação {index + 1}
                    {notificationSound === sound && <Check className="h-4 w-4 ml-2" />}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-6 w-6 ml-2"
                    onClick={(e) => handleSoundItemClick(e, sound)}
                    aria-label={`Tocar som de notificação ${index + 1}`}
                  >
                     <Play className="h-4 w-4"/>
                  </Button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
