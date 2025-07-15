
'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { type Contact } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, BellRing } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getContacts } from '@/lib/redis';
import { Skeleton } from '@/components/ui/skeleton';

export function ContactList() {
  const params = useParams();
  const activeChatId = params.id as string | undefined;
  const [searchTerm, setSearchTerm] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousAttentionIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Inicializa o Audio object no cliente de forma segura
    if (typeof window !== 'undefined') {
        const audio = new Audio('/notification.mp3');
        audio.oncanplaythrough = () => {
            audioRef.current = audio;
        };
        audio.onerror = () => {
            console.warn("Arquivo de áudio 'notification.mp3' não encontrado em /public. A notificação sonora está desativada.");
            audioRef.current = null;
        };
    }
  }, []);

  const fetchContacts = useCallback(async () => {
      // Não mostra o loading para atualizações em background
      if (contacts.length === 0) {
        setIsLoading(true);
      }

      try {
        const redisContacts = await getContacts();
        
        const currentAttentionIds = new Set(
            redisContacts.filter(c => c.needsAttention).map(c => c.id)
        );

        // Verifica se há um *novo* contato que precisa de atenção
        const hasNewAttention = Array.from(currentAttentionIds).some(
            id => !previousAttentionIds.current.has(id)
        );

        if (hasNewAttention && audioRef.current) {
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
    }, [contacts.length, isLoading]);

  useEffect(() => {
    fetchContacts();
    
    // Atualiza a lista a cada 15 segundos
    const interval = setInterval(fetchContacts, 15000);
    return () => clearInterval(interval);

  }, [fetchContacts]);


  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="hidden md:flex flex-col h-full w-full max-w-xs border-r bg-background/50">
      <div className="p-4">
        <h2 className="text-2xl font-bold">Contatos</h2>
         <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Pesquisar contato..." 
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
            <p className="p-4 text-center text-sm text-muted-foreground">Nenhum contato encontrado.</p>
           )}
        </nav>
      </ScrollArea>
    </aside>
  );
}
