
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Sparkles, UserPlus, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { findContacts, FindContactsOutput } from '@/ai/flows/find-contact-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { getStoredContacts } from '@/lib/redis';

export default function AiContactFinderPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foundContacts, setFoundContacts] = useState<FindContactsOutput | null>(null);
  const [hasStoredContacts, setHasStoredContacts] = useState<boolean | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    async function checkContacts() {
        setIsLoading(true);
        try {
            const contacts = await getStoredContacts();
            setHasStoredContacts(contacts.length > 0);
        } catch (error) {
            console.error("Erro ao verificar contatos armazenados:", error);
            setHasStoredContacts(false);
             toast({
                variant: 'destructive',
                title: 'Erro de Banco de Dados',
                description: 'Não foi possível verificar a lista de contatos armazenada.',
            });
        } finally {
            setIsLoading(false);
        }
    }
    checkContacts();
  }, [toast]);


  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campo Obrigatório',
        description: 'Por favor, forneça um nome para buscar.',
      });
      return;
    }

    setIsLoading(true);
    setFoundContacts(null);

    try {
      const result = await findContacts({
        searchTerm: searchTerm,
      });
      setFoundContacts(result);
      if (result.contacts.length === 0) {
        toast({
            title: 'Nenhum Contato Encontrado',
            description: `A IA não encontrou contatos correspondentes a "${searchTerm}".`,
        });
      }
    } catch (error) {
      console.error('Erro ao buscar contatos com IA:', error);
      toast({
        variant: 'destructive',
        title: 'Erro da IA',
        description: 'Ocorreu um erro ao processar sua solicitação. Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartChat = (contactId: string) => {
    if (contactId) {
        router.push(`/chat/${encodeURIComponent(contactId)}`);
    }
  };

  const renderContent = () => {
    if (hasStoredContacts === null || isLoading) {
      return (
        <div className="flex justify-center items-center p-8">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
      );
    }

    if (!hasStoredContacts) {
        return (
            <CardContent>
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Nenhuma Lista de Contatos Encontrada</AlertTitle>
                    <AlertDescription>
                        Para usar a busca, você precisa primeiro importar sua lista de contatos.
                        <Button asChild variant="link" className="p-0 h-auto ml-1">
                            <Link href="/contacts">
                                Ir para a página de Gerenciamento de Contatos
                            </Link>
                        </Button>
                    </AlertDescription>
                </Alert>
            </CardContent>
        )
    }

    return (
       <>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="search-term" className="font-semibold">Digite o Nome a ser Buscado</label>
            <div className="flex gap-2">
              <Input
                id="search-term"
                placeholder="Ex: Leandro"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoading}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSearch();
                    }
                }}
              />
              <Button onClick={handleSearch} disabled={isLoading || !searchTerm.trim()}>
                {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
                Buscar
              </Button>
            </div>
             <p className="text-xs text-muted-foreground">
                A busca será realizada na sua lista de contatos importada.
            </p>
          </div>
        </CardContent>
        {foundContacts && (
            <CardFooter className="flex flex-col items-start gap-4 border-t pt-6">
                <h3 className="font-semibold">Resultados da Busca:</h3>
                {foundContacts.contacts.length > 0 ? (
                    <ul className="w-full space-y-2">
                        {foundContacts.contacts.map((contact, index) => (
                           <li key={index} className="flex items-center justify-between p-3 rounded-md border bg-muted/50">
                                <div>
                                    <p className="font-bold">{contact.name}</p>
                                    <p className="text-sm text-muted-foreground font-mono">{contact.id}</p>
                                </div>
                                <Button size="sm" onClick={() => handleStartChat(contact.id)}>
                                    <UserPlus />
                                    Iniciar Chat
                                </Button>
                           </li>
                        ))}
                    </ul>
                ): (
                     <p className="text-sm text-muted-foreground w-full text-center p-4">
                        Nenhum contato correspondente encontrado.
                    </p>
                )}
            </CardFooter>
        )}
       </>
    )
  }


  return (
    <div className="p-4 md:p-8 flex justify-center items-start">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            <div>
                <CardTitle>Assistente de Busca de Contatos</CardTitle>
                <CardDescription>Use IA para encontrar o ID de um contato a partir do nome, usando sua lista de contatos importada.</CardDescription>
            </div>
          </div>
        </CardHeader>
        {renderContent()}
      </Card>
    </div>
  );
}
