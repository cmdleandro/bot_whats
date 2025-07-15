
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Sparkles, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { findContacts, FindContactsOutput } from '@/ai/flows/find-contact-flow';

export default function AiContactFinderPage() {
  const [contactList, setContactList] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foundContacts, setFoundContacts] = useState<FindContactsOutput | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const handleSearch = async () => {
    if (!contactList.trim() || !searchTerm.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos Obrigatórios',
        description: 'Por favor, forneça a lista de contatos e um nome para buscar.',
      });
      return;
    }

    setIsLoading(true);
    setFoundContacts(null);

    try {
      const result = await findContacts({
        contactList: contactList,
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


  return (
    <div className="p-4 md:p-8 flex justify-center items-start">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            <div>
                <CardTitle>Assistente de Busca de Contatos</CardTitle>
                <CardDescription>Use IA para encontrar o ID de um contato a partir do nome, usando sua lista de contatos exportada.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="contact-list" className="font-semibold">1. Cole sua Lista de Contatos</label>
            <Textarea
              id="contact-list"
              placeholder="Cole aqui sua lista de contatos exportada do WhatsApp ou de um arquivo de texto. Ex: Leandro (5511999998888), Maria (5521988887777)..."
              value={contactList}
              onChange={(e) => setContactList(e.target.value)}
              className="min-h-[150px]"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="search-term" className="font-semibold">2. Digite o Nome a ser Buscado</label>
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
              <Button onClick={handleSearch} disabled={isLoading || !contactList.trim() || !searchTerm.trim()}>
                {isLoading ? <Loader2 className="animate-spin" /> : <Search />}
                Buscar
              </Button>
            </div>
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
      </Card>
    </div>
  );
}
