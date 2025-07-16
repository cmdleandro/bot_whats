
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Loader2, ServerCog } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { getGlobalSettings, saveGlobalSettings } from '@/lib/redis';
import { getUsers } from '@/lib/redis';
import type { User, GlobalSettings } from '@/lib/data';

export default function SettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings>({ defaultInstance: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    const operatorName = localStorage.getItem('chatview_operator_name');
    if (!operatorName) {
      router.replace('/login');
      return;
    }

    try {
      const allUsers = await getUsers();
      const user = allUsers.find(u => u.name === operatorName);
      
      if (user?.role !== 'Admin') {
        toast({ variant: 'destructive', title: 'Acesso Negado', description: 'Você não tem permissão para acessar esta página.' });
        router.replace('/chat');
        return;
      }
      
      setCurrentUser(user);
      const globalSettings = await getGlobalSettings();
      setSettings(globalSettings);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erro de Rede',
        description: 'Não foi possível carregar os dados.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleSaveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await saveGlobalSettings(settings);
      toast({
        title: 'Configurações Salvas',
        description: 'Suas configurações globais foram atualizadas com sucesso.',
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erro ao Salvar',
        description: 'Não foi possível salvar as configurações.',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = event.target;
      setSettings(prev => ({...prev, [name]: value }));
  }

  if (isLoading || !currentUser) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ServerCog className="h-6 w-6" />
            Configurações Globais
          </CardTitle>
          <CardDescription>
            Defina as configurações padrão para toda a aplicação. Estas configurações afetarão o comportamento para todos os usuários.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="defaultInstance">Nome da Instância Padrão</Label>
              <Input
                id="defaultInstance"
                name="defaultInstance"
                value={settings.defaultInstance}
                onChange={handleInputChange}
                placeholder="Ex: MinhaEmpresa"
                disabled={isSaving}
                required
              />
              <p className="text-sm text-muted-foreground">
                Este nome será usado para iniciar novas conversas.
              </p>
            </div>
            
            <div className="flex justify-end">
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar Configurações
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
