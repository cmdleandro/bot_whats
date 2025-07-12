'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Send, Bot, User, ChevronLeft } from 'lucide-react';

import { contacts as mockContacts, messages as mockMessages, Message, Contact } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ReplySuggestions } from '@/components/ai/reply-suggestions';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function ChatViewPage() {
  const params = useParams();
  const contactId = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [operatorName, setOperatorName] = useState('');

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const name = localStorage.getItem('chatview_operator_name');
    setOperatorName(name || 'Operador');

    const currentContact = mockContacts.find(c => c.id === contactId);
    if (currentContact) {
      setContact(currentContact);
      const contactMessages = mockMessages.filter(m => m.contactId === contactId);
      setMessages(contactMessages);
    }
  }, [contactId]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (newMessage.trim() === '') return;

    const message: Message = {
      id: `m${Date.now()}`,
      contactId,
      text: newMessage,
      sender: 'operator',
      operatorName: operatorName,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prevMessages => [...prevMessages, message]);
    setNewMessage('');
  };

  const handleSuggestionClick = (suggestion: string) => {
    setNewMessage(suggestion);
  };
  
  const lastUserMessage = messages.slice().reverse().find(m => m.sender === 'user');

  if (!contact) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/20">
        <p>Carregando conversa...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-card">
      <header className="flex items-center gap-4 border-b bg-background p-3">
        <Button variant="ghost" size="icon" className="md:hidden" asChild>
            <Link href="/chat">
                <ChevronLeft className="h-6 w-6" />
            </Link>
        </Button>
        <Avatar>
          <AvatarImage src={contact.avatar} alt={contact.name} data-ai-hint="person portrait" />
          <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="font-semibold">{contact.name}</h2>
          <p className="text-xs text-muted-foreground">Online</p>
        </div>
      </header>

      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="p-4 md:p-6 space-y-6">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={cn(
                'flex items-end gap-3 max-w-[85%]',
                msg.sender === 'operator' ? 'ml-auto flex-row-reverse' : 'mr-auto'
              )}
            >
              <Avatar className="h-8 w-8">
                {msg.sender === 'operator' ? (
                  <AvatarFallback>{operatorName.charAt(0)}</AvatarFallback>
                ) : msg.sender === 'bot' ? (
                   <AvatarImage src="/logo.png" alt="IAI Thermas Logo" />
                ) : (
                  <>
                  <AvatarImage src={contact.avatar} alt={contact.name} />
                  <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                  </>
                )}
              </Avatar>
              <div
                className={cn(
                  'rounded-lg px-4 py-2 text-sm shadow-sm flex flex-col',
                  msg.sender === 'operator' ? 'rounded-br-none bg-primary text-primary-foreground' : 'rounded-bl-none bg-background'
                )}
              >
                {(msg.sender === 'bot' || msg.sender === 'operator') && (
                    <p className="text-xs font-bold mb-1" style={{ color: msg.sender === 'operator' ? undefined : 'hsl(var(--accent))' }}>
                        {msg.sender === 'bot' ? 'BOT' : msg.operatorName}
                    </p>
                )}
                <p className="whitespace-pre-wrap">{msg.text}</p>
                <p className="mt-1 text-right text-xs opacity-60 self-end">{msg.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
      
      <footer className="border-t bg-background p-4">
        {lastUserMessage && (
          <ReplySuggestions lastMessage={lastUserMessage} onSuggestionClick={handleSuggestionClick} />
        )}
        <div className="relative flex items-center">
          <Textarea
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Digite uma mensagem..."
            className="min-h-[48px] resize-none pr-16"
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
          >
            <Send className="h-5 w-5" />
            <span className="sr-only">Enviar</span>
          </Button>
        </div>
      </footer>
    </div>
  );
}
