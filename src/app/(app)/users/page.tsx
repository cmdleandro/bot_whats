'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, MoreHorizontal, Trash2, Edit, KeyRound, Server, Loader2, AlertTriangle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { User } from '@/lib/data';
import { initialUsers } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { checkRedisConnection, RedisStatus } from '@/lib/redis';

function RedisStatusCard() {
  const [status, setStatus] = useState<RedisStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      setIsLoading(true);
      const redisStatus = await checkRedisConnection();
      setStatus(redisStatus);
      setIsLoading(false);
    }
    fetchStatus();
  }, []);

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-6 w-6" />
          Status da Conexão Redis
        </CardTitle>
        <CardDescription>
          Diagnóstico da conexão com o banco de dados Redis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Verificando conexão...</span>
          </div>
        ) : status ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">Status da Conexão</h3>
              {status.connected ? (
                <Badge variant="default" className="bg-green-600">Conectado com Sucesso</Badge>
              ) : (
                <Badge variant="destructive">Falha na Conexão</Badge>
              )}
            </div>
            {status.error && (
              <div>
                <h3 className="font-semibold text-destructive">Mensagem de Erro</h3>
                <p className="text-sm font-mono bg-muted p-2 rounded-md text-destructive">{status.error}</p>
              </div>
            )}
            <div>
              <h3 className="font-semibold">Amostra de Chaves (`chat:*`)</h3>
              {status.sampleKeys && status.sampleKeys.length > 0 ? (
                <ul className="list-disc list-inside bg-muted p-2 rounded-md font-mono text-sm">
                  {status.sampleKeys.map((key) => <li key={key}>{key}</li>)}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma chave com o padrão `chat:*` foi encontrada.</p>
              )}
            </div>
             <div>
              <h3 className="font-semibold">Conteúdo Bruto da Primeira Chave</h3>
               {status.firstKeyContent ? (
                <pre className="text-xs font-mono bg-muted p-2 rounded-md overflow-x-auto">
                  {status.firstKeyContent}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum conteúdo para exibir.</p>
              )}
            </div>
          </div>
        ) : (
           <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span>Não foi possível obter o status do Redis.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Operador' | 'Admin'>('Operador');

  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const operatorName = localStorage.getItem('chatview_operator_name');
    if (!operatorName) {
      router.replace('/login');
      return;
    }
    
    const storedUsers = localStorage.getItem('chatview_users');
    let allUsers: User[] = [];
    if (storedUsers) {
      allUsers = JSON.parse(storedUsers);
    } else {
      allUsers = initialUsers;
      localStorage.setItem('chatview_users', JSON.stringify(initialUsers));
    }
    setUsers(allUsers);

    const user = allUsers.find(u => u.name === operatorName);
    if (user) {
      setCurrentUser(user);
    } else {
      router.replace('/login');
    }
  }, [router]);

  useEffect(() => {
    if (isDialogOpen && editingUser) {
        setName(editingUser.name);
        setEmail(editingUser.email);
        setRole(editingUser.role);
        setPassword('');
    } else {
        setName('');
        setEmail('');
        setPassword('');
        setRole('Operador');
    }
  }, [isDialogOpen, editingUser]);

  const persistUsers = (updatedUsers: User[]) => {
      setUsers(updatedUsers);
      localStorage.setItem('chatview_users', JSON.stringify(updatedUsers));
  }

  const handleAdminFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editingUser) {
        const updatedUsers = users.map(user =>
            user.id === editingUser.id ? { 
                ...user, 
                name, 
                email, 
                role, 
                password: password ? password : user.password 
            } : user
        );
        persistUsers(updatedUsers);
        toast({ title: 'Sucesso', description: 'Usuário atualizado com sucesso.' });
    } else {
        const newUser: User = {
            id: Date.now().toString(),
            name,
            email,
            password: password,
            role,
            createdAt: new Date().toISOString().split('T')[0],
        };
        persistUsers([...users, newUser]);
        toast({ title: 'Sucesso', description: 'Usuário criado com sucesso.' });
    }

    setEditingUser(null);
    setIsDialogOpen(false);
  };
  
  const handleOperatorPasswordChange = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) {
        toast({ variant: 'destructive', title: 'Erro', description: 'A nova senha não pode estar em branco.' });
        return;
    }
    if (currentUser) {
        const updatedUsers = users.map(user =>
            user.id === currentUser.id ? { ...user, password } : user
        );
        persistUsers(updatedUsers);
        setPassword('');
        toast({ title: 'Sucesso', description: 'Sua senha foi alterada com sucesso.' });
    }
  };


  const handleDeleteUser = (userId: string) => {
    if (currentUser?.id === userId) {
        toast({ variant: 'destructive', title: 'Ação não permitida', description: 'Você não pode excluir sua própria conta.' });
        return;
    }
    const updatedUsers = users.filter(user => user.id !== userId);
    persistUsers(updatedUsers);
    toast({ title: 'Sucesso', description: 'Usuário excluído com sucesso.' });
  };
  
  const handleOpenDialog = (user: User | null = null) => {
    setEditingUser(user);
    setIsDialogOpen(true);
  }

  if (!currentUser) {
    return null; // or a loading spinner
  }

  // Operator View
  if (currentUser.role === 'Operador') {
    return (
       <div className="p-4 md:p-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Meu Perfil</CardTitle>
            <CardDescription>
              Atualize sua senha de acesso aqui.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleOperatorPasswordChange} className="space-y-4">
                <div className="space-y-1">
                    <Label>Nome</Label>
                    <Input value={currentUser.name} disabled />
                </div>
                <div className="space-y-1">
                    <Label>Email</Label>
                    <Input value={currentUser.email} disabled />
                </div>
                <div className="space-y-1">
                    <Label htmlFor="new-password">Nova Senha</Label>
                    <Input 
                        id="new-password"
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••" 
                        required 
                    />
                </div>
                 <Button type="submit" className="gap-2">
                    <KeyRound className="h-4 w-4" />
                    Alterar Senha
                </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Admin View
  return (
    <div className="p-4 md:p-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Gerenciamento de Usuários</CardTitle>
            <CardDescription>
              Adicione, edite ou remova usuários do sistema.
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if (!isOpen) setEditingUser(null);}}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-4 w-4" />
                Adicionar Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingUser ? 'Editar Usuário' : 'Adicionar Novo Usuário'}</DialogTitle>
                <DialogDescription>
                  {editingUser ? 'Atualize os detalhes do usuário. Deixe a senha em branco para mantê-la.' : 'Preencha os detalhes para criar uma nova conta.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAdminFormSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Nome</Label>
                    <Input id="name" name="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">Email</Label>
                    <Input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="col-span-3" required />
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="password" className="text-right">Senha</Label>
                    <Input id="password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="col-span-3" placeholder={editingUser ? 'Deixe em branco para manter' : '••••••••'} required={!editingUser} />
                  </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role" className="text-right">Função</Label>
                     <select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value as 'Operador' | 'Admin')} className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                        <option value="Operador">Operador</option>
                        <option value="Admin">Admin</option>
                    </select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{editingUser ? 'Salvar Alterações' : 'Salvar Usuário'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Criado em</-ts>
- src/app/globals.css:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root, .theme-zinc {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --ring: 214.3 31.8% 91.4%;
    --radius: 0.5rem;
  }
 
  .dark, .theme-zinc.dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --ring: 217.2 32.6% 17.5%;
  }

  .theme-slate { --background: 0 0% 100%; --foreground: 224 71.4% 4.1%; --muted: 220 14.3% 95.9%; --muted-foreground: 220 9.8% 46.5%; --popover: 0 0% 100%; --popover-foreground: 224 71.4% 4.1%; --card: 0 0% 100%; --card-foreground: 224 71.4% 4.1%; --border: 220 13% 91%; --input: 220 13% 91%; --primary: 224 71.4% 4.1%; --primary-foreground: 210 20% 98%; --secondary: 220 14.3% 95.9%; --secondary-foreground: 224 71.4% 4.1%; --accent: 220 14.3% 95.9%; --accent-foreground: 224 71.4% 4.1%; --destructive: 0 84.2% 60.2%; --destructive-foreground: 210 20% 98%; --ring: 220 13% 91% }
  .theme-slate.dark { --background: 224 71.4% 4.1%; --foreground: 210 20% 98%; --muted: 215 27.9% 16.9%; --muted-foreground: 216 12.2% 65.1%; --popover: 224 71.4% 4.1%; --popover-foreground: 210 20% 98%; --card: 224 71.4% 4.1%; --card-foreground: 210 20% 98%; --border: 215 27.9% 16.9%; --input: 215 27.9% 16.9%; --primary: 210 20% 98%; --primary-foreground: 224 71.4% 4.1%; --secondary: 215 27.9% 16.9%; --secondary-foreground: 210 20% 98%; --accent: 215 27.9% 16.9%; --accent-foreground: 210 20% 98%; --destructive: 0 62.8% 30.6%; --destructive-foreground: 210 20% 98%; --ring: 215 27.9% 16.9% }
  .theme-stone { --background: 0 0% 100%; --foreground: 220 14.3% 26.1%; --muted: 220 10% 96.1%; --muted-foreground: 220 6.8% 50.4%; --popover: 0 0% 100%; --popover-foreground: 220 14.3% 26.1%; --card: 0 0% 100%; --card-foreground: 220 14.3% 26.1%; --border: 220 10% 89%; --input: 220 10% 89%; --primary: 220 14.3% 26.1%; --primary-foreground: 210 20% 98%; --secondary: 220 10% 96.1%; --secondary-foreground: 220 14.3% 26.1%; --accent: 220 10% 96.1%; --accent-foreground: 220 14.3% 26.1%; --destructive: 0 84.2% 60.2%; --destructive-foreground: 210 20% 98%; --ring: 220 10% 89% }
  .theme-stone.dark { --background: 220 14.3% 26.1%; --foreground: 210 20% 98%; --muted: 216 14.3% 32%; --muted-foreground: 216 10% 65.1%; --popover: 220 14.3% 26.1%; --popover-foreground: 210 20% 98%; --card: 220 14.3% 26.1%; --card-foreground: 210 20% 98%; --border: 216 14.3% 32%; --input: 216 14.3% 32%; --primary: 210 20% 98%; --primary-foreground: 220 14.3% 26.1%; --secondary: 216 14.3% 32%; --secondary-foreground: 210 20% 98%; --accent: 216 14.3% 32%; --accent-foreground: 210 20% 98%; --destructive: 0 62.8% 30.6%; --destructive-foreground: 210 20% 98%; --ring: 216 14.3% 32% }
  .theme-gray { --background: 0 0% 100%; --foreground: 222.9 64.3% 18.2%; --muted: 220 10% 96.1%; --muted-foreground: 220 8.8% 46.5%; --popover: 0 0% 100%; --popover-foreground: 222.9 64.3% 18.2%; --card: 0 0% 100%; --card-foreground: 222.9 64.3% 18.2%; --border: 220 13% 91%; --input: 220 13% 91%; --primary: 221.2 83.2% 53.3%; --primary-foreground: 210 20% 98%; --secondary: 220 14.3% 95.9%; --secondary-foreground: 222.9 64.3% 18.2%; --accent: 220 14.3% 95.9%; --accent-foreground: 222.9 64.3% 18.2%; --destructive: 0 84.2% 60.2%; --destructive-foreground: 210 20% 98%; --ring: 221.2 83.2% 53.3% }
  .theme-gray.dark { --background: 224 71.4% 4.1%; --foreground: 210 20% 98%; --muted: 220 10% 15.9%; --muted-foreground: 216 12.2% 65.1%; --popover: 224 71.4% 4.1%; --popover-foreground: 210 20% 98%; --card: 224 71.4% 4.1%; --card-foreground: 210 20% 98%; --border: 220 10% 25.9%; --input: 220 10% 25.9%; --primary: 217.2 91.2% 59.8%; --primary-foreground: 224 71.4% 4.1%; --secondary: 220 10% 15.9%; --secondary-foreground: 210 20% 98%; --accent: 220 10% 15.9%; --accent-foreground: 210 20% 98%; --destructive: 0 62.8% 30.6%; --destructive-foreground: 210 20% 98%; --ring: 217.2 91.2% 59.8% }
  .theme-neutral { --background: 0 0% 100%; --foreground: 220 14.3% 26.1%; --muted: 220 10% 96.1%; --muted-foreground: 220 6.8% 50.4%; --popover: 0 0% 100%; --popover-foreground: 220 14.3% 26.1%; --card: 0 0% 100%; --card-foreground: 220 14.3% 26.1%; --border: 220 10% 89%; --input: 220 10% 89%; --primary: 220 14.3% 26.1%; --primary-foreground: 210 20% 98%; --secondary: 220 10% 96.1%; --secondary-foreground: 220 14.3% 26.1%; --accent: 220 10% 96.1%; --accent-foreground: 220 14.3% 26.1%; --destructive: 0 84.2% 60.2%; --destructive-foreground: 210 20% 98%; --ring: 220 10% 89% }
  .theme-neutral.dark { --background: 220 14.3% 26.1%; --foreground: 210 20% 98%; --muted: 216 14.3% 32%; --muted-foreground: 216 10% 65.1%; --popover: 220 14.3% 26.1%; --popover-foreground: 210 20% 98%; --card: 220 14.3% 26.1%; --card-foreground: 210 20% 98%; --border: 216 14.3% 32%; --input: 216 14.3% 32%; --primary: 210 20% 98%; --primary-foreground: 220 14.3% 26.1%; --secondary: 216 14.3% 32%; --secondary-foreground: 210 20% 98%; --accent: 216 14.3% 32%; --accent-foreground: 210 20% 98%; --destructive: 0 62.8% 30.6%; --destructive-foreground: 210 20% 98%; --ring: 216 14.3% 32% }
  .theme-red { --background: 0 0% 100%; --foreground: 0 72.2% 50.6%; --muted: 0 40% 96.1%; --muted-foreground: 0 8.8% 46.5%; --popover: 0 0% 100%; --popover-foreground: 0 72.2% 50.6%; --card: 0 0% 100%; --card-foreground: 0 72.2% 50.6%; --border: 0 13% 91%; --input: 0 13% 91%; --primary: 0 72.2% 50.6%; --primary-foreground: 210 20% 98%; --secondary: 0 40% 96.1%; --secondary-foreground: 0 72.2% 50.6%; --accent: 0 40% 96.1%; --accent-foreground: 0 72.2% 50.6%; --destructive: 0 84.2% 60.2%; --destructive-foreground: 210 20% 98%; --ring: 0 72.2% 50.6% }
  .theme-red.dark { --background: 0 72.2% 50.6%; --foreground: 210 20% 98%; --muted: 0 80% 15.9%; --muted-foreground: 216 12.2% 65.1%; --popover: 0 72.2% 50.6%; --popover-foreground: 210 20% 98%; --card: 0 72.2% 50.6%; --card-foreground: 210 20% 98%; --border: 0 80% 25.9%; --input: 0 80% 25.9%; --primary: 210 20% 98%; --primary-foreground: 0 72.2% 50.6%; --secondary: 0 80% 15.9%; --secondary-foreground: 210 20% 98%; --accent: 0 80% 15.9%; --accent-foreground: 210 20% 98%; --destructive: 0 62.8% 30.6%; --destructive-foreground: 210 20% 98%; --ring: 0 62.8% 30.6% }
  .theme-rose { --background: 0 0% 100%; --foreground: 346.8 77.2% 49.8%; --muted: 350 40% 96.1%; --muted-foreground: 350 8.8% 46.5%; --popover: 0 0% 100%; --popover-foreground: 346.8 77.2% 49.8%; --card: 0 0% 100%; --card-foreground: 346.8 77.2% 49.8%; --border: 350 13% 91%; --input: 350 13% 91%; --primary: 346.8 77.2% 49.8%; --primary-foreground: 210 20% 98%; --secondary: 350 40% 96.1%; --secondary-foreground: 346.8 77.2% 49.8%; --accent: 350 40% 96.1%; --accent-foreground: 346.8 77.2% 49.8%; --destructive: 0 84.2% 60.2%; --destructive-foreground: 210 20% 98%; --ring: 346.8 77.2% 49.8% }
  .theme-rose.dark { --background: 346.8 77.2% 49.8%; --foreground: 210 20% 98%; --muted: 350 80% 15.9%; --muted-foreground: 216 12.2% 65.1%; --popover: 346.8 77.2% 49.8%; --popover-foreground: 210 20% 98%; --card: 346.8 77.2% 49.8%; --card-foreground: 210 20% 98%; --border: 350 80% 25.9%; --input: 350 80% 25.9%; --primary: 210 20% 98%; --primary-foreground: 346.8 77.2% 49.8%; --secondary: 350 80% 15.9%; --secondary-foreground: 210 20% 98%; --accent: 350 80% 15.9%; --accent-foreground: 210 20% 98%; --destructive: 0 62.8% 30.6%; --destructive-foreground: 210 20% 98%; --ring: 346.8 77.2% 49.8% }
  .theme-orange { --background: 0 0% 100%; --foreground: 24.6 95% 53.1%; --muted: 20 40% 96.1%; --muted-foreground: 25 8.8% 46.5%; --popover: 0 0% 100%; --popover-foreground: 24.6 95% 53.1%; --card: 0 0% 100%; --card-foreground: 24.6 95% 53.1%; --border: 20 13% 91%; --input: 20 13% 91%; --primary: 24.6 95% 53.1%; --primary-foreground: 210 20% 98%; --secondary: 20 40% 96.1%; --secondary-foreground: 24.6 95% 53.1%; --accent: 20 40% 96.1%; --accent-foreground: 24.6 95% 53.1%; --destructive: 0 84.2% 60.2%; --destructive-foreground: 210 20% 98%; --ring: 24.6 95% 53.1% }
  .theme-orange.dark { --background: 20.5 90.2% 48.2%; --foreground: 210 20% 98%; --muted: 24 80% 15.9%; --muted-foreground: 216 12.2% 65.1%; --popover: 20.5 90.2% 48.2%; --popover-foreground: 210 20% 98%; --card: 20.5 90.2% 48.2%; --card-foreground: 210 20% 98%; --border: 24 80% 25.9%; --input: 24 80% 25.9%; --primary: 210 20% 98%; --primary-foreground: 20.5 90.2% 48.2%; --secondary: 24 80% 15.9%; --secondary-foreground: 210 20% 98%; --accent: 24 80% 15.9%; --accent-foreground: 210 20% 98%; --destructive: 0 62.8% 30.6%; --destructive-foreground: 210 20% 98%; --ring: 24.6 95% 53.1% }
  .theme-green { --background: 0 0% 100%; --foreground: 142.1 76.2% 36.3%; --muted: 150 40% 96.1%; --muted-foreground: 150 8.8% 46.5%; --popover: 0 0% 100%; --popover-foreground: 142.1 76.2% 36.3%; --card: 0 0% 100%; --card-foreground: 142.1 76.2% 36.3%; --border: 150 13% 91%; --input: 150 13% 91%; --primary: 142.1 76.2% 36.3%; --primary-foreground: 210 20% 98%; --secondary: 150 40% 96.1%; --secondary-foreground: 142.1 76.2% 36.3%; --accent: 150 40% 96.1%; --accent-foreground: 142.1 76.2% 36.3%; --destructive: 0 84.2% 60.2%; --destructive-foreground: 210 20% 98%; --ring: 142.1 76.2% 36.3% }
  .theme-green.dark { --background: 142.1 76.2% 36.3%; --foreground: 210 20% 98%; --muted: 140 80% 15.9%; --muted-foreground: 216 12.2% 65.1%; --popover: 142.1 76.2% 36.3%; --popover-foreground: 210 20% 98%; --card: 142.1 76.2% 36.3%; --card-foreground: 210 20% 98%; --border: 140 80% 25.9%; --input: 140 80% 25.9%; --primary: 210 20% 98%; --primary-foreground: 142.1 76.2% 36.3%; --secondary: 140 80% 15.9%; --secondary-foreground: 210 20% 98%; --accent: 140 80% 15.9%; --accent-foreground: 210 20% 98%; --destructive: 0 62.8% 30.6%; --destructive-foreground: 210 20% 98%; --ring: 142.1 76.2% 36.3% }
  .theme-blue { --background: 0 0% 100%; --foreground: 221.2 83.2% 53.3%; --muted: 210 40% 96.1%; --muted-foreground: 215.4 16.3% 46.9%; --popover: 0 0% 100%; --popover-foreground: 221.2 83.2% 53.3%; --card: 0 0% 100%; --card-foreground: 221.2 83.2% 53.3%; --border: 214.3 31.8% 91.4%; --input: 214.3 31.8% 91.4%; --primary: 221.2 83.2% 53.3%; --primary-foreground: 210 40% 98%; --secondary: 210 40% 96.1%; --secondary-foreground: 221.2 83.2% 53.3%; --accent: 210 40% 96.1%; --accent-foreground: 221.2 83.2% 53.3%; --destructive: 0 84.2% 60.2%; --destructive-foreground: 210 40% 98%; --ring: 221.2 83.2% 53.3% }
  .theme-blue.dark { --background: 222.2 84% 4.9%; --foreground: 210 40% 98%; --muted: 217.2 32.6% 17.5%; --muted-foreground: 215 20.2% 65.1%; --popover: 222.2 84% 4.9%; --popover-foreground: 210 40% 98%; --card: 222.2 84% 4.9%; --card-foreground: 210 40% 98%; --border: 217.2 32.6% 17.5%; --input: 217.2 32.6% 17.5%; --primary: 217.2 91.2% 59.8%; --primary-foreground: 222.2 47.4% 11.2%; --secondary: 217.2 32.6% 17.5%; --secondary-foreground: 210 40% 98%; --accent: 217.2 32.6% 17.5%; --accent-foreground: 210 40% 98%; --destructive: 0 62.8% 30.6%; --destructive-foreground: 210 40% 98%; --ring: 217.2 91.2% 59.8% }
  .theme-yellow { --background: 0 0% 100%; --foreground: 47.9 95.8% 53.1%; --muted: 50 40% 96.1%; --muted-foreground: 50 8.8% 46.5%; --popover: 0 0% 100%; --popover-foreground: 47.9 95.8% 53.1%; --card: 0 0% 100%; --card-foreground: 47.9 95.8% 53.1%; --border: 50 13% 91%; --input: 50 13% 91%; --primary: 47.9 95.8% 53.1%; --primary-foreground: 222.2 47.4% 11.2%; --secondary: 50 40% 96.1%; --secondary-foreground: 47.9 95.8% 53.1%; --accent: 50 40% 96.1%; --accent-foreground: 47.9 95.8% 53.1%; --destructive: 0 84.2% 60.2%; --destructive-foreground: 210 40% 98%; --ring: 47.9 95.8% 53.1% }
  .theme-yellow.dark { --background: 47.9 95.8% 53.1%; --foreground: 210 40% 98%; --muted: 50 80% 15.9%; --muted-foreground: 215 20.2% 65.1%; --popover: 47.9 95.8% 53.1%; --popover-foreground: 210 40% 98%; --card: 47.9 95.8% 53.1%; --card-foreground: 210 40% 98%; --border: 50 80% 25.9%; --input: 50 80% 25.9%; --primary: 210 40% 98%; --primary-foreground: 47.9 95.8% 53.1%; --secondary: 50 80% 15.9%; --secondary-foreground: 210 40% 98%; --accent: 50 80% 15.9%; --accent-foreground: 210 40% 98%; --destructive: 0 62.8% 30.6%; --destructive-foreground: 210 40% 98%; --ring: 47.9 95.8% 53.1% }
  .theme-violet { --background: 0 0% 100%; --foreground: 262.1 83.3% 57.8%; --muted: 260 40% 96.1%; --muted-foreground: 260 8.8% 46.5%; --popover: 0 0% 100%; --popover-foreground: 262.1 83.3% 57.8%; --card: 0 0% 100%; --card-foreground: 262.1 83.3% 57.8%; --border: 260 13% 91%; --input: 260 13% 91%; --primary: 262.1 83.3% 57.8%; --primary-foreground: 210 40% 98%; --secondary: 260 40% 96.1%; --secondary-foreground: 262.1 83.3% 57.8%; --accent: 260 40% 96.1%; --accent-foreground: 262.1 83.3% 57.8%; --destructive: 0 84.2% 60.2%; --destructive-foreground: 210 40% 98%; --ring: 262.1 83.3% 57.8% }
  .theme-violet.dark { --background: 263.4 70% 50.4%; --foreground: 210 40% 98%; --muted: 260 80% 15.9%; --muted-foreground: 215 20.2% 65.1%; --popover: 263.4 70% 50.4%; --popover-foreground: 210 40% 98%; --card: 263.4 70% 50.4%; --card-foreground: 210 40% 98%; --border: 260 80% 25.9%; --input: 260 80% 25.9%; --primary: 210 40% 98%; --primary-foreground: 263.4 70% 50.4%; --secondary: 260 80% 15.9%; --secondary-foreground: 210 40% 98%; --accent: 260 80% 15.9%; --accent-foreground: 210 40% 98%; --destructive: 0 62.8% 30.6%; --destructive-foreground: 210 40% 98%; --ring: 263.4 70% 50.4% }
  .theme-light { --background: 0 0% 100%; --foreground: 222.2 84% 4.9%; --muted: 210 40% 96.1%; --muted-foreground: 215.4 16.3% 46.9%; --popover: 0 0% 100%; --popover-foreground: 222.2 84% 4.9%; --card: 0 0% 100%; --card-foreground: 222.2 84% 4.9%; --border: 214.3 31.8% 91.4%; --input: 214.3 31.8% 91.4%; --primary: 212 92% 48%; --primary-foreground: 210 40% 98%; --secondary: 210 40% 96.1%; --secondary-foreground: 222.2 47.4% 11.2%; --accent: 33 93% 54%; --accent-foreground: 0 0% 98%; --destructive: 0 84.2% 60.2%; --destructive-foreground: 210 40% 98%; --ring: 212 92% 48% }
  .theme-light.dark { --background: 240 10% 3.9%; --foreground: 0 0% 98%; --muted: 240 3.7% 15.9%; --muted-foreground: 0 0% 63.9%; --popover: 240 10% 3.9%; --popover-foreground: 0 0% 98%; --card: 240 10% 3.9%; --card-foreground: 0 0% 98%; --border: 240 3.7% 15.9%; --input: 240 3.7% 15.9%; --primary: 212 92% 48%; --primary-foreground: 240 5.9% 10%; --secondary: 240 3.7% 15.9%; --secondary-foreground: 0 0% 98%; --accent: 33 93% 54%; --accent-foreground: 0 0% 98%; --destructive: 0 62.8% 30.6%; --destructive-foreground: 0 0% 98%; --ring: 212 92% 48% }
  .theme-black { --background: 0 0% 100%; --foreground: 0 0% 3.9%; --muted: 0 0% 96.1%; --muted-foreground: 0 0% 45.1%; --popover: 0 0% 100%; --popover-foreground: 0 0% 3.9%; --card: 0 0% 100%; --card-foreground: 0 0% 3.9%; --border: 0 0% 89.8%; --input: 0 0% 89.8%; --primary: 0 0% 9%; --primary-foreground: 0 0% 98%; --secondary: 0 0% 96.1%; --secondary-foreground: 0 0% 9%; --accent: 0 0% 96.1%; --accent-foreground: 0 0% 9%; --destructive: 0 84.2% 60.2%; --destructive-foreground: 0 0% 98%; --ring: 0 0% 3.9% }
  .theme-black.dark { --background: 0 0% 3.9%; --foreground: 0 0% 98%; --muted: 0 0% 14.9%; --muted-foreground: 0 0% 63.9%; --popover: 0 0% 3.9%; --popover-foreground: 0 0% 98%; --card: 0 0% 3.9%; --card-foreground: 0 0% 98%; --border: 0 0% 14.9%; --input: 0 0% 14.9%; --primary: 0 0% 98%; --primary-foreground: 0 0% 9%; --secondary: 0 0% 14.9%; --secondary-foreground: 0 0% 98%; --accent: 0 0% 14.9%; --accent-foreground: 0 0% 98%; --destructive: 0 62.8% 30.6%; --destructive-foreground: 0 0% 98%; --ring: 0 0% 14.9% }
  .theme-iait { --background: 0 0% 96.1%; --foreground: 240 10% 3.9%; --card: 0 0% 100%; --card-foreground: 240 10% 3.9%; --popover: 0 0% 100%; --popover-foreground: 240 10% 3.9%; --primary: 212 92% 48%; --primary-foreground: 210 40% 98%; --secondary: 240 4.8% 95.9%; --secondary-foreground: 240 5.9% 10%; --muted: 240 4.8% 95.9%; --muted-foreground: 240 3.8% 46.1%; --accent: 33 93% 54%; --accent-foreground: 0 0% 98%; --destructive: 0 84.2% 60.2%; --destructive-foreground: 0 0% 98%; --border: 240 5.9% 90%; --input: 240 5.9% 90%; --ring: 212 92% 48% }
  .theme-iait.dark { --background: 240 10% 3.9%; --foreground: 0 0% 98%; --card: 240 10% 3.9%; --card-foreground: 0 0% 98%; --popover: 240 10% 3.9%; --popover-foreground: 0 0% 98%; --primary: 212 92% 48%; --primary-foreground: 240 5.9% 10%; --secondary: 240 3.7% 15.9%; --secondary-foreground: 0 0% 98%; --muted: 240 3.7% 15.9%; --muted-foreground: 0 0% 63.9%; --accent: 33 93% 54%; --accent-foreground: 0 0% 98%; --destructive: 0 62.8% 30.6%; --destructive-foreground: 0 0% 98%; --border: 240 3.7% 15.9%; --input: 240 3.7% 15.9%; --ring: 212 92% 48% }

}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
