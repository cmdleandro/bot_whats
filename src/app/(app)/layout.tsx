'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, MessageSquare, Users } from 'lucide-react';

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ThemeSwitcher } from '@/components/theme/theme-switcher';
import { ThemeProvider } from '@/components/theme/theme-provider';
import type { User } from '@/lib/data';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const appVersion = '1.0.4'; // Version number

  React.useEffect(() => {
    const operatorName = localStorage.getItem('chatview_operator_name');
    const storedUsers = localStorage.getItem('chatview_users');
    
    if (!operatorName) {
      router.replace('/login');
      return;
    }

    if (storedUsers) {
      const users: User[] = JSON.parse(storedUsers);
      const user = users.find(u => u.name === operatorName);
      if (user) {
        setCurrentUser(user);
      } else {
        // Logged-in user not found in user list, force logout
        handleLogout();
      }
    } else {
       // No users stored, something is wrong, force logout
       handleLogout();
    }

  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('chatview_operator_name');
    router.replace('/login');
  };

  if (!currentUser) {
    return null; // or a loading spinner
  }
  
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  return (
    <ThemeProvider>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-3">
              <Image src="/logo.svg" alt="ChatView Logo" width={32} height={32} />
              <span className="text-xl font-semibold">ChatView</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith('/chat')}
                >
                  <Link href="/chat">
                    <MessageSquare />
                    <span>Mensageria</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith('/users')}
                >
                  <Link href="/users">
                    <Users />
                    <span>{currentUser.role === 'Admin' ? 'Usuários' : 'Meu Perfil'}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
             <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                    <AvatarFallback>{getInitials(currentUser.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-semibold">{currentUser.name}</span>
                      <span className="text-xs text-muted-foreground">{currentUser.role}</span>
                      <span className="text-xs text-muted-foreground/50 mt-1">Versão: {appVersion}</span>
                    </div>
                </div>
                <ThemeSwitcher />
            </div>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleLogout}>
                  <LogOut />
                  <span>Sair</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </ThemeProvider>
  );
}
