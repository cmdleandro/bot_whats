'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileUp,
  Loader2,
  Trash2,
  MoreHorizontal,
  PlusCircle,
  UploadCloud,
} from 'lucide-react';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { getStoredContacts, processVcfFile, saveStoredContacts } from '@/actions/contact-actions';
import { StoredContact } from '@/lib/data';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<StoredContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedContacts = await getStoredContacts();
      setContacts(storedContacts);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erro de Rede',
        description: 'Não foi possível carregar os contatos salvos.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      const content = e.target?.result as string;
      if (!content) {
        toast({ variant: 'destructive', title: 'Erro de Arquivo', description: 'Não foi possível ler o arquivo.' });
        setIsUploading(false);
        return;
      }

      try {
        const newContacts = await processVcfFile(content);
        const uniqueNewContacts = newContacts.filter(
          (newContact) => !contacts.some((existing) => existing.id === newContact.id)
        );

        if (uniqueNewContacts.length === 0) {
            toast({ title: 'Nenhum contato novo', description: 'Todos os contatos do arquivo já existem na sua lista.' });
        } else {
            const updatedContacts = [...contacts, ...uniqueNewContacts];
            await saveStoredContacts(updatedContacts);
            setContacts(updatedContacts);
            toast({ title: 'Importação bem-sucedida!', description: `${uniqueNewContacts.length} novos contatos foram adicionados.` });
        }
      } catch (error) {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Erro de Processamento',
          description: 'Não foi possível processar o arquivo VCF.',
        });
      } finally {
        setIsUploading(false);
        setIsDialogOpen(false);
      }
    };
    
    reader.onerror = () => {
        toast({ variant: 'destructive', title: 'Erro de Leitura', description: 'Ocorreu um erro ao tentar ler o arquivo selecionado.' });
        setIsUploading(false);
    }

    reader.readAsText(file);
    // Reset file input to allow re-uploading the same file
    event.target.value = ''; 
  };
  
  const handleDeleteContact = async (id: string) => {
      const updatedContacts = contacts.filter(c => c.id !== id);
      try {
          await saveStoredContacts(updatedContacts);
          setContacts(updatedContacts);
          toast({ title: 'Contato removido', description: 'O contato foi removido com sucesso.' });
      } catch (error) {
          console.error(error);
          toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível remover o contato.' });
      }
  };


  return (
    <div className="p-4 md:p-8">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Gerenciador de Contatos</CardTitle>
            <CardDescription>
              Importe e gerencie sua lista de contatos para facilitar o início de novas conversas.
            </CardDescription>
          </div>
           <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <PlusCircle className="h-4 w-4" />
                  Importar Contatos
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Importar Contatos (.vcf)</DialogTitle>
                  <DialogDescription>
                    Exporte seus contatos do Google Contacts ou de outro aplicativo como um arquivo VCF e envie-o aqui.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:bg-accent hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="h-8 w-8 animate-spin" />
                                <span className="mt-2 text-sm font-medium">Processando...</span>
                            </>
                        ) : (
                            <>
                                <UploadCloud className="h-8 w-8" />
                                <span className="mt-2 text-sm font-medium">Clique para escolher um arquivo .vcf</span>
                            </>
                        )}
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".vcf"
                        className="hidden"
                        disabled={isUploading}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isUploading}>
                        Cancelar
                    </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : contacts.length === 0 ? (
            <Alert>
              <FileUp className="h-4 w-4" />
              <AlertTitle>Nenhum Contato Encontrado</AlertTitle>
              <AlertDescription>
                Você ainda não importou nenhum contato. Clique em "Importar Contatos" para começar.
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>ID (Telefone)</TableHead>
                  <TableHead>
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{contact.id}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Menu de Ações</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDeleteContact(contact.id)} className="text-destructive">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
