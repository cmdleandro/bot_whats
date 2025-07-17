
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Send, Bot, User, ChevronLeft, Loader2, Check, CheckCheck, Paperclip } from 'lucide-react';
import { getMessages, addMessage, getContacts, dismissAttention } from '@/lib/redis';
import { Message, Contact, MessageStatus, MediaType } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

function MessageStatusIndicator({ status }: { status: MessageStatus }) {
    const iconClass = "h-4 w-4 ml-1";
    if (status === 'read') {
        return <CheckCheck className={cn(iconClass, "text-blue-500")} />;
    }
    if (status === 'delivered') {
        return <CheckCheck className={iconClass} />;
    }
    // Default to 'sent'
    return <Check className={iconClass} />;
}


const MediaMessage = ({ msg }: { msg: Message }) => {
  if (!msg.mediaUrl) return null;

  const renderMedia = () => {
    if (!msg.mediaType) {
        // Fallback for when mediaType is missing but mediaUrl is present
        if (/\.(jpg|jpeg|png|gif|webp)$/i.test(msg.mediaUrl)) {
            return <Image src={msg.mediaUrl} alt={msg.text || 'Imagem enviada'} width={300} height={300} className="rounded-lg object-cover" unoptimized />;
        }
        return <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Ver Mídia</a>;
    }
    
    switch (msg.mediaType) {
      case 'image':
        return (
          <Image
            src={msg.mediaUrl}
            alt={msg.text || 'Imagem enviada'}
            width={300}
            height={300}
            className="rounded-lg object-cover"
            unoptimized
          />
        );
      case 'video':
        return (
          <video
            src={msg.mediaUrl}
            controls
            className="rounded-lg max-w-xs"
          />
        );
      case 'audio':
        return (
          <audio
            src={msg.mediaUrl}
            controls
            className="w-full"
          />
        );
      case 'document':
        return (
            <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                <Paperclip className="h-4 w-4" />
                <span>{msg.text || 'Ver Documento'}</span>
            </a>
        );
      default:
        return <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Ver Mídia Desconhecida</a>;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {renderMedia()}
      {/* Exibe a legenda (msg.text) se ela existir. Para documentos, o texto já está no link. */}
      {msg.mediaType !== 'document' && msg.text && (
        <p className="text-sm pt-1">{msg.text}</p>
      )}
    </div>
  );
};


export default function ChatViewPage() {
  const params = useParams();
  const rawContactId = params.id as string;
  const contactId = rawContactId ? decodeURIComponent(rawContactId).trim() : '';
  const { toast } = useToast();

  const [contact, setContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);


  const viewportRef = useRef<HTMLDivElement>(null);

  const fetchMessages = React.useCallback(async (id: string, isBackground: boolean) => {
    try {
        const redisMessages = await getMessages(id);
        setMessages(prevMessages => {
            if (JSON.stringify(prevMessages) !== JSON.stringify(redisMessages)) {
                return redisMessages;
            }
            return prevMessages;
        });
    } catch (error) {
        console.error("Erro ao buscar mensagens:", error);
        if (!isBackground) {
            toast({
                variant: 'destructive',
                title: 'Erro de Rede',
                description: 'Não foi possível carregar novas mensagens.',
            });
        }
    }
  }, [toast]);

  useEffect(() => {
    const name = localStorage.getItem('chatview_operator_name');
    setOperatorName(name || 'Operador');
    
    if (contactId) {
        async function fetchContactAndInitialMessages() {
            setIsLoading(true);
            try {
                await dismissAttention(contactId);

                const allContacts = await getContacts();
                const currentContact = allContacts.find(c => c.id === contactId);
                
                if (currentContact) {
                    setContact(currentContact);
                } else {
                    setContact({
                        id: contactId,
                        name: contactId.split('@')[0],
                        avatar: `https://placehold.co/40x40.png`,
                        lastMessage: 'Nenhuma mensagem recente.',
                        timestamp: '',
                        unreadCount: 0
                    });
                }

                await fetchMessages(contactId, false);

            } catch (error) {
                console.error("Erro ao buscar dados do chat:", error);
                toast({
                    variant: 'destructive',
                    title: 'Erro de Rede',
                    description: 'Não foi possível carregar os dados da conversa.',
                });
            } finally {
                setIsLoading(false);
            }
        }

        fetchContactAndInitialMessages();

        const interval = setInterval(() => {
          fetchMessages(contactId, true);
        }, 3000);

        return () => clearInterval(interval);
    }
    
  }, [contactId, toast, fetchMessages]);

  useEffect(() => {
    if (viewportRef.current) {
        viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (newMessage.trim() === '' || isSending) return;

    setIsSending(true);

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const message: Message = {
      id: tempId,
      contactId,
      text: newMessage,
      sender: 'operator',
      operatorName: operatorName,
      timestamp: Date.now(),
      status: 'sent',
    };

    setMessages(prevMessages => [...prevMessages, message]);
    setNewMessage('');

    try {
      await addMessage(contactId, {
        text: message.text,
        sender: 'operator',
        operatorName: operatorName,
        tempId: tempId
      });
    } catch (error: any) {
      console.error('Falha ao enviar mensagem:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao Enviar',
        description: error.message || 'Não foi possível enviar a mensagem. Por favor, tente novamente.',
      });
      setMessages(prevMessages => prevMessages.filter(m => m.id !== tempId));
    } finally {
      setIsSending(false);
      document.querySelector('textarea')?.focus();
    }
  };

  if (!contact && !isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/20">
        <p>Selecione uma conversa para começar.</p>
      </div>
    );
  }

  const getMessageStyle = (sender: Message['sender']) => {
    switch (sender) {
      case 'user':
        return 'rounded-bl-none bg-background';
      case 'operator':
        return 'rounded-br-none bg-primary text-primary-foreground';
      case 'bot':
        return 'rounded-br-none bg-accent text-accent-foreground';
      default:
        return 'rounded-bl-none bg-background';
    }
  };

  return (
    <div className="flex h-screen flex-col bg-card">
      <header className="flex items-center gap-4 border-b bg-background p-3">
        <Button variant="ghost" size="icon" className="md:hidden" asChild>
            <Link href="/chat">
                <ChevronLeft className="h-6 w-6" />
            </Link>
        </Button>
        {contact ? (
          <>
            <Avatar>
              <AvatarImage src={contact.avatar} alt={contact.name} data-ai-hint="person portrait" />
              <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="font-semibold">{contact.name}</h2>
              <p className="text-xs text-muted-foreground">Online</p>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-4 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="space-y-2">
                <div className="h-4 w-24 rounded-md bg-muted" />
                <div className="h-3 w-16 rounded-md bg-muted" />
            </div>
          </div>
        )}
      </header>

      <ScrollArea className="flex-1" viewportRef={viewportRef}>
        <div className="p-4 md:p-6 space-y-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-full p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex justify-center items-center h-full p-8">
              <p className="text-muted-foreground">Nenhuma mensagem nesta conversa.</p>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={cn(
                  'flex items-end gap-3 max-w-[85%]',
                  msg.sender === 'user' ? 'mr-auto' : 'ml-auto flex-row-reverse'
                )}
              >
                <Avatar className="h-8 w-8">
                  {msg.sender === 'operator' ? (
                    <AvatarFallback>{operatorName.charAt(0)}</AvatarFallback>
                  ) : msg.sender === 'bot' ? (
                     <AvatarImage src={msg.botAvatarUrl || "/logo.svg"} alt="Bot Logo" />
                  ) : (
                    <>
                    <AvatarImage src={contact?.avatar} alt={contact?.name} />
                    <AvatarFallback>{contact?.name.charAt(0)}</AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div
                  className={cn(
                    'rounded-lg px-4 py-2 text-sm shadow-sm flex flex-col',
                     getMessageStyle(msg.sender)
                  )}
                >
                  {msg.sender === 'bot' && (
                      <p className="text-xs font-bold mb-1">BOT</p>
                  )}
                  {msg.sender === 'operator' && msg.operatorName && (
                    <span className="font-bold text-xs mb-1">{msg.operatorName}</span>
                  )}
                  
                  {msg.mediaUrl ? (
                    <MediaMessage msg={msg} />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  )}

                  <div className="flex items-center justify-end mt-1 text-xs opacity-60 self-end">
                    <span>{new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    {msg.sender === 'operator' && msg.status && <MessageStatusIndicator status={msg.status} />}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      
      <footer className="border-t bg-background p-4">
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
            disabled={isSending}
          />
          <Button
            type="submit"
            size="icon"
            className="absolute right-3 top-1/2 -translate-y-1/2"
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            <span className="sr-only">Enviar</span>
          </Button>
        </div>
      </footer>
    </div>
  );
}
