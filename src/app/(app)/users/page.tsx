'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, MoreHorizontal, Trash2, Edit, KeyRound } from 'lucide-react';
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
      if (user.role !== 'Admin') {
        setEditingUser(user); // Set operator to edit their own profile
      }
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
                    <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'}>{user.role}</Badge>
                  </TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost" disabled={currentUser.id === user.id}>
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleOpenDialog(user)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteUser(user.id)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
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
    </div>
  );
}
