
'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { type Contact, type StoredContact } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Search, BellRing, PlusCircle, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getContacts } from '@/lib/redis';
import { getStoredContacts } from '@/actions/contact-actions';
import { Skeleton } from '@/components/ui/skeleton';
import { useTheme } from '@/components/theme/theme-provider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';


export function ContactList() {
  const params = useParams();
  const router = useRouter();
  const activeChatId = params.id as string | undefined;
  const { notificationSound } = useTheme();

  const [searchTerm, setSearchTerm] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);

  // For the "New Chat" Dialog
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [storedContacts, setStoredContacts] = useState<StoredContact[]>([]);
  const [isStoredContactsLoading, setIsStoredContactsLoading] = useState(false);
  const [newChatSearchTerm, setNewChatSearchTerm] = useState('');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousAttentionIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleFirstInteraction = () => {
      setHasInteracted(true);
      window.removeEventListener('click', handleFirstInteraction, true);
    };

    window.addEventListener('click', handleFirstInteraction, true);

    return () => {
      window.removeEventListener('click', handleFirstInteraction, true);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && notificationSound) {
      const audio = new Audio(notificationSound);
      audio.oncanplaythrough = () => {
        audioRef.current = audio;
      };
      audio.onerror = () => {
        console.warn(`Arquivo de áudio '${notificationSound}' não encontrado em /public. A notificação sonora está desativada.`);
        audioRef.current = null;
      };
    } else {
        audioRef.current = null;
    }
  }, [notificationSound]);

  const fetchContacts = useCallback(async () => {
      if (contacts.length === 0) {
        setIsLoading(true);
      }

      try {
        const redisContacts = await getContacts();
        
        const currentAttentionIds = new Set(
            redisContacts.filter(c => c.needsAttention).map(c => c.id)
        );

        const hasNewAttention = Array.from(currentAttentionIds).some(
            id => !previousAttentionIds.current.has(id)
        );

        if (hasNewAttention && audioRef.current && hasInteracted) {
            audioRef.current.play().catch(e => console.error("Erro ao tocar áudio de notificação:", e));
        }

        setContacts(redisContacts);
        previousAttentionIds.current = currentAttentionIds;

      } catch (error) {
        console.error("Erro ao buscar contatos:", error);
      } finally {
        if (isLoading) {
            setIsLoading(false);
        }
      }
    }, [contacts.length, isLoading, hasInteracted]);

  useEffect(() => {
    fetchContacts();
    
    const interval = setInterval(fetchContacts, 15000);
    return () => clearInterval(interval);

  }, [fetchContacts]);


  const handleStartNewChat = (contactId: string) => {
    if (contactId.trim()) {
      const formattedId = contactId.trim();
      router.push(`/chat/${encodeURIComponent(formattedId)}`);
      setIsNewChatOpen(false);
      setNewChatSearchTerm('');
    }
  };
  
  const handleOpenNewChatDialog = async () => {
    setIsStoredContactsLoading(true);
    try {
        const fetchedContacts = await getStoredContacts();
        setStoredContacts(fetchedContacts);
    } catch (error) {
        console.error("Failed to fetch stored contacts", error);
        // Optionally show a toast error
    } finally {
        setIsStoredContactsLoading(false);
    }
  }

  const filteredStoredContacts = useMemo(() => {
    return storedContacts.filter(contact =>
        contact.name.toLowerCase().includes(newChatSearchTerm.toLowerCase()) ||
        contact.id.toLowerCase().includes(newChatSearchTerm.toLowerCase())
    );
  }, [storedContacts, newChatSearchTerm]);


  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="hidden md:flex flex-col h-full w-full max-w-xs border-r bg-background/50">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Contatos</h2>
          <div className="flex items-center gap-1">
            <TooltipProvider>
                <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={handleOpenNewChatDialog}>
                            <PlusCircle className="h-6 w-6" />
                            <span className="sr-only">Nova Conversa</span>
                        </Button>
                        </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Iniciar Nova Conversa</p>
                    </TooltipContent>
                </Tooltip>
                <DialogContent className="sm:max-w-md h-[70vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Iniciar Nova Conversa</DialogTitle>
                        <DialogDescription>
                            Selecione um contato salvo para iniciar uma conversa.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nome ou ID..."
                            className="pl-10"
                            value={newChatSearchTerm}
                            onChange={(e) => setNewChatSearchTerm(e.target.value)}
                        />
                    </div>
                    <ScrollArea className="flex-1 -mx-6">
                        <div className="px-6">
                        {isStoredContactsLoading ? (
                           <div className="flex justify-center items-center h-full">
                                <Loader2 className="h-6 w-6 animate-spin" />
                           </div>
                        ) : filteredStoredContacts.length > 0 ? (
                           filteredStoredContacts.map(contact => (
                            <button
                                key={contact.id}
                                onClick={() => handleStartNewChat(contact.id)}
                                className="w-full text-left p-3 flex items-center gap-3 rounded-md hover:bg-accent transition-colors"
                            >
                               <Avatar className="h-10 w-10">
                                  <AvatarImage src={`https://placehold.co/40x40.png`} alt={contact.name} data-ai-hint="person portrait" />
                                  <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                               </Avatar>
                               <div className="flex-1 truncate">
                                    <p className="font-semibold">{contact.name}</p>
                                    <p className="text-sm text-muted-foreground">{contact.id}</p>
                               </div>
                            </button>
                           ))
                        ) : (
                            <p className="text-center text-sm text-muted-foreground pt-8">Nenhum contato encontrado.</p>
                        )}
                        </div>
                    </ScrollArea>
                </DialogContent>
                </Dialog>
            </TooltipProvider>
          </div>
        </div>
         <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Pesquisar conversa..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 p-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg p-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                </div>
            ))
          ) : (
            filteredContacts.map((contact: Contact) => (
              <Link
                key={contact.id}
                href={`/chat/${contact.id}`}
                className={cn(
                  'flex items-center gap-3 rounded-lg p-3 text-muted-foreground transition-all hover:bg-accent/50 hover:text-foreground',
                  activeChatId === contact.id && 'bg-accent/80 text-accent-foreground',
                  contact.needsAttention && 'bg-yellow-400/20 animate-pulse hover:bg-yellow-400/30'
                )}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={contact.avatar} alt={contact.name} data-ai-hint="person portrait" />
                  <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 truncate">
                  <p className="font-semibold">{contact.name}</p>
                  <p className="text-sm truncate">{contact.lastMessage}</p>
                </div>
                <div className="flex flex-col items-end text-xs text-nowrap">
                  <span>{contact.timestamp}</span>
                   {contact.needsAttention ? (
                        <BellRing className="mt-1 h-5 w-5 text-yellow-500" />
                   ) : contact.unreadCount > 0 && (
                        <Badge className="mt-1 h-5 w-5 justify-center p-0">
                          {contact.unreadCount}
                        </Badge>
                   )}
                </div>
              </Link>
            ))
          )}
           {!isLoading && filteredContacts.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
           )}
        </nav>
      </ScrollArea>
    </aside>
  );
}
