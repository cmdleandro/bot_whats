
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Trash2, Loader2, Info, UserPlus } from 'lucide-react';
import { StoredContact } from '@/lib/data';
import { getStoredContacts, saveStoredContacts } from '@/lib/redis';
import { processContactsCsv } from '@/ai/flows/process-csv-flow';
import { useRouter } from 'next/navigation';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<StoredContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [csvContent, setCsvContent] = useState<string>('');
  const { toast } = useToast();
  const router = useRouter();
  
  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedContacts = await getStoredContacts();
      setContacts(storedContacts);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao Carregar Contatos',
        description: 'Não foi possível buscar a lista de contatos do banco de dados.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setCsvContent(text);
      };
      reader.readAsText(file);
    }
  };

  const handleImport = async () => {
    if (!csvContent) {
      toast({
        variant: 'destructive',
        title: 'Nenhum Arquivo Selecionado',
        description: 'Por favor, selecione um arquivo CSV para importar.',
      });
      return;
    }
    setIsProcessing(true);
    try {
      const result = await processContactsCsv({ csvContent });
      if (result.contacts.length > 0) {
        await saveStoredContacts(result.contacts);
        await fetchContacts(); 
        toast({
          title: 'Importação Concluída',
          description: `${result.contacts.length} contatos foram importados e salvos com sucesso.`,
        });
        setIsDialogOpen(false);
        setCsvContent('');
      } else {
        toast({
          variant: 'destructive',
          title: 'Nenhum Contato Encontrado',
          description: 'A IA não conseguiu extrair contatos válidos do arquivo CSV.',
        });
      }
    } catch (error) {
      console.error('Erro ao processar CSV:', error);
      toast({
        variant: 'destructive',
        title: 'Erro na Importação',
        description: 'Ocorreu um erro ao processar o arquivo. Verifique se o formato está correto.',
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleDeleteAll = async () => {
    if (confirm('Você tem certeza que deseja apagar TODOS os contatos importados? Esta ação não pode ser desfeita.')) {
        setIsLoading(true);
        try {
            await saveStoredContacts([]);
            setContacts([]);
            toast({
                title: 'Contatos Apagados',
                description: 'Sua lista de contatos foi removida com sucesso.'
            });
        } catch (error) {
             toast({
                variant: 'destructive',
                title: 'Erro ao Apagar',
                description: 'Não foi possível apagar os contatos.',
            });
        } finally {
            setIsLoading(false);
        }
    }
  }
  
  const handleStartChat = (contactId: string) => {
    if (contactId) {
        router.push(`/chat/${encodeURIComponent(contactId)}`);
    }
  };


  return (
    <div className="p-4 md:p-8">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Gerenciar Contatos</CardTitle>
            <CardDescription>
              Importe e visualize sua lista de contatos para usar na busca com IA.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar Contatos
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Importar do Google Contacts (CSV)</DialogTitle>
                  <DialogDescription>
                    Selecione o arquivo CSV exportado do Google Contacts para importar.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-2">
                        <p className="font-semibold flex items-center gap-2"><Info className="h-5 w-5 text-primary"/> Instruções</p>
                        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                            <li>No Google Contacts, selecione os contatos desejados e clique em "Exportar".</li>
                            <li>Escolha o formato "CSV do Google".</li>
                            <li>Faça o upload do arquivo exportado abaixo.</li>
                        </ol>
                    </div>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    disabled={isProcessing}
                  />
                </div>
                <DialogFooter>
                  <Button onClick={handleImport} disabled={isProcessing || !csvContent}>
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Processar e Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="destructive" onClick={handleDeleteAll} disabled={isLoading || contacts.length === 0}>
                <Trash2 className="mr-2 h-4 w-4" />
                Apagar Tudo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[60vh] w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>ID (Telefone)</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : contacts.length > 0 ? (
                  contacts.map((contact, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{contact.name}</TableCell>
                      <TableCell className="font-mono text-xs">{contact.id}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => handleStartChat(contact.id)}>
                            <UserPlus className="mr-2 h-4 w-4"/>
                            Conversar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Nenhum contato importado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
