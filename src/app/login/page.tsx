'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, LogIn } from 'lucide-react';
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

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() && password.trim()) {
      // Mock login: In a real app, you would validate against a backend.
      // Any username/password will work for this demo.
      localStorage.setItem('chatview_operator_name', username);
      router.replace('/chat');
    } else {
      setError('Usuário e senha são obrigatórios.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-10 w-10 text-primary" />
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
