'use client';

import React, { useState, useEffect } from 'react';
import { PlusCircle, MoreHorizontal, Trash2, Edit } from 'lucide-react';
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


export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Operador' | 'Admin'>('Operador');


  useEffect(() => {
    const storedUsers = localStorage.getItem('chatview_users');
    if (storedUsers) {
      setUsers(JSON.parse(storedUsers));
    } else {
      setUsers(initialUsers);
      localStorage.setItem('chatview_users', JSON.stringify(initialUsers));
    }
  }, []);

  useEffect(() => {
    if (isDialogOpen && editingUser) {
        setName(editingUser.name);
        setEmail(editingUser.email);
        setRole(editingUser.role);
        setPassword(''); // Clear password field for editing
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

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editingUser) {
        const updatedUsers = users.map(user =>
            user.id === editingUser.id ? { 
                ...user, 
                name, 
                email, 
                role, 
                // Only update password if a new one is provided
                password: password ? password : user.password 
            } : user
        );
        persistUsers(updatedUsers);
    } else {
        const newUser: User = {
            id: Date.now().toString(),
            name,
            email,
            password: password, // Password is required for new users
            role,
            createdAt: new Date().toISOString().split('T')[0],
        };
        persistUsers([...users, newUser]);
    }

    setEditingUser(null);
    setIsDialogOpen(false);
  };

  const handleDeleteUser = (userId: string) => {
    const updatedUsers = users.filter(user => user.id !== userId);
    persistUsers(updatedUsers);
  };
  
  const handleOpenDialog = (user: User | null = null) => {
    setEditingUser(user);
    setIsDialogOpen(true);
  }

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
                  {editingUser ? 'Atualize os detalhes do usuário. Deixe a senha em branco para mantê-la.' : 'Preencha os detalhes para criar uma nova conta de operador.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleFormSubmit}>
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
                        <Button aria-haspopup="true" size="icon" variant="ghost">
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
