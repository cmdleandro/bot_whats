'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { contacts as mockContacts, Contact } from '@/lib/data';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useState } from 'react';


export function ContactList() {
  const params = useParams();
  const activeChatId = params.id;
  const [searchTerm, setSearchTerm] = useState('');

  const filteredContacts = mockContacts.filter(contact =>
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
          {filteredContacts.map((contact: Contact) => (
            <Link
              key={contact.id}
              href={`/chat/${contact.id}`}
              className={cn(
                'flex items-center gap-3 rounded-lg p-3 text-muted-foreground transition-all hover:bg-accent/50 hover:text-foreground',
                activeChatId === contact.id && 'bg-accent/80 text-accent-foreground'
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
              <div className="flex flex-col items-end text-xs">
                <span>{contact.timestamp}</span>
                {contact.unreadCount > 0 && (
                  <Badge className="mt-1 h-5 w-5 justify-center p-0">
                    {contact.unreadCount}
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
