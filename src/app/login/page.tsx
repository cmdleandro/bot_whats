'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { User } from '@/lib/data';
import { initialUsers } from '@/lib/data';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Seed initial users into localStorage if not already there
    if (!localStorage.getItem('chatview_users')) {
      localStorage.setItem('chatview_users', JSON.stringify(initialUsers));
    }
  }, []);


  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Usuário e senha são obrigatórios.');
      return;
    }

    const storedUsers = localStorage.getItem('chatview_users');
    const users: User[] = storedUsers ? JSON.parse(storedUsers) : [];

    const foundUser = users.find(
      (user) => user.name.toLowerCase() === username.toLowerCase() && user.password === password
    );

    if (foundUser) {
      localStorage.setItem('chatview_operator_name', foundUser.name);
      router.replace('/chat');
    } else {
      setError('Usuário ou senha inválidos.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Image src="/logo.png" alt="IAI Thermas Logo" width={56} height={56} />
          </div>
          <CardTitle className="text-2xl">Bem-vindo ao ChatView</CardTitle>
          <CardDescription>
            Faça login para acessar o painel de mensagens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                type="text"
                placeholder="ex: Leandro"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full gap-2">
              <LogIn className="h-4 w-4" />
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
