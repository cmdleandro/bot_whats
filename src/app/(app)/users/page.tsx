'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, MoreHorizontal, Trash2, Edit, KeyRound, Server, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { checkRedisConnection, type RedisStatus } from '@/actions/redis-status';
import { getUsers, saveUsers } from '@/lib/redis';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function RedisStatusCard() {
  const [status, setStatus] = useState<RedisStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [key, setKey] = useState(0);

  useEffect(() => {
    async function fetchStatus() {
      setIsLoading(true);
      try {
        const redisStatus = await checkRedisConnection();
        setStatus(redisStatus);
      } catch (error: any) {
        console.error("Falha catastrófica ao verificar status do Redis:", error);
        setStatus({
          connected: false,
          error: error.message || "Não foi possível comunicar com o servidor para verificar o status do Redis.",
          sampleKeys: [],
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchStatus();
  }, [key]);

  const handleRefresh = () => {
    setKey(prevKey => prevKey + 1);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Verificando conexão...</span>
        </div>
      );
    }
    if (!status) {
       return (
           <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            <span>Não foi possível obter o status do Redis.</span>
          </div>
        );
    }
    if (!status.connected) {
      return (
         <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falha na Conexão Externa</AlertTitle>
          <AlertDescription>
            <p className="font-semibold mb-2">A aplicação não conseguiu se conectar ao banco de dados Redis.</p>
            {status.error && (
              <div className="mt-4">
                <h3 className="font-semibold">Detalhes do Erro Técnico:</h3>
                <p className="text-xs font-mono bg-destructive/20 p-2 rounded-md mt-1">{status.error}</p>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )
    }

    return (
       <div className="space-y-4">
        <div>
          <h3 className="font-semibold">Status da Conexão</h3>
          <Badge variant="default" className="bg-green-600">Conectado com Sucesso</Badge>
        </div>
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
      </div>
    );
  }


  return (
    <Card className="mt-8">
      <CardHeader>
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                <Server className="h-6 w-6" />
                Status da Conexão Redis
                </CardTitle>
                <CardDescription>
                Diagnóstico da conexão com o banco de dados em tempo real.
                </CardDescription>
            </div>
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
        </div>
      </CardHeader>
      <CardContent>
       {renderContent()}
      </CardContent>
    </Card>
  );
}


export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Operador' | 'Admin'>('Operador');

  const router = useRouter();
  const { toast } = useToast();

  const fetchUsers = React.useCallback(async () => {
    setIsLoading(true);
    const operatorName = localStorage.getItem('chatview_operator_name');
    if (!operatorName) {
      router.replace('/login');
      return;
    }
    try {
      const allUsers = await getUsers();
      setUsers(allUsers);

      const user = allUsers.find(u => u.name === operatorName);
      if (user) {
        setCurrentUser(user);
      } else {
        router.replace('/login');
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível buscar os usuários.' });
    } finally {
      setIsLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (isDialogOpen && editingUser) {
        setName(editingUser.name);
        setEmail(editingUser.email);
        setRole(editingUser.role);
        setPassword('');
    } else if (!isDialogOpen) {
        setName('');
        setEmail('');
        setPassword('');
        setRole('Operador');
    }
  }, [isDialogOpen, editingUser]);

  const persistUsers = async (updatedUsers: User[]) => {
      try {
        await saveUsers(updatedUsers);
        setUsers(updatedUsers);
      } catch (error) {
         toast({ variant: 'destructive', title: 'Erro de Rede', description: 'Não foi possível salvar as alterações.' });
      }
  }

  const handleAdminFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    let updatedUsers: User[];

    if (editingUser) {
        updatedUsers = users.map(user =>
            user.id === editingUser.id ? { 
                ...user, 
                name, 
                email, 
                role, 
                password: password ? password : user.password 
            } : user
        );
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
        updatedUsers = [...users, newUser];
        toast({ title: 'Sucesso', description: 'Usuário criado com sucesso.' });
    }
    
    await persistUsers(updatedUsers);
    setEditingUser(null);
    setIsDialogOpen(false);
  };
  
  const handleOperatorPasswordChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) {
        toast({ variant: 'destructive', title: 'Erro', description: 'A nova senha não pode estar em branco.' });
        return;
    }
    if (currentUser) {
        const updatedUsers = users.map(user =>
            user.id === currentUser.id ? { ...user, password } : user
        );
        await persistUsers(updatedUsers);
        setPassword('');
        toast({ title: 'Sucesso', description: 'Sua senha foi alterada com sucesso.' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (currentUser?.id === userId) {
        toast({ variant: 'destructive', title: 'Ação não permitida', description: 'Você não pode excluir sua própria conta.' });
        return;
    }
    const updatedUsers = users.filter(user => user.id !== userId);
    await persistUsers(updatedUsers);
    toast({ title: 'Sucesso', description: 'Usuário excluído com sucesso.' });
  };
  
  const handleOpenDialog = (user: User | null = null) => {
    setEditingUser(user);
    setIsDialogOpen(true);
  }

  if (isLoading || !currentUser) {
    return (
        <div className="flex h-full items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
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
                <TableHead>Criado em</TableHead>
                <TableHead>
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                     <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'}>
                        {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.createdAt}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleOpenDialog(user)}>
                            <Edit className="mr-2 h-4 w-4"/>
                            Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteUser(user.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4"/>
                            Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <RedisStatusCard />
    </div>
  );
}
