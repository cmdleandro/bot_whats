
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Send, Bot, ChevronLeft, Loader2, Check, CheckCheck, Paperclip, CornerUpLeft, X, ChevronDown, Mic } from 'lucide-react';
import { getMessages, addMessage, getContacts, dismissAttention } from '@/lib/redis';
import { Message, Contact, MessageStatus, MediaType } from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    return <Check className={iconClass} />;
}

const MediaMessage = ({ msg, onImageClick }: { msg: Message; onImageClick: (url: string) => void }) => {
  const { mediaType, mediaUrl, text } = msg;

  let mediaElement: React.ReactNode = null;

  if (mediaType && mediaUrl) {
    switch (mediaType) {
      case 'image':
        mediaElement = (
          <button onClick={() => onImageClick(mediaUrl)} className="block focus:outline-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl}
              alt={text || 'Imagem enviada'}
              className="rounded-lg object-cover w-full h-auto max-w-[250px]"
            />
          </button>
        );
        break;
      case 'document':
        mediaElement = (
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary underline">
            <Paperclip className="h-4 w-4" />
            <span>{text || 'Ver Documento'}</span>
          </a>
        );
        break;
      case 'audio':
         mediaElement = (
            <audio controls src={mediaUrl} className="max-w-[250px] w-full">
              Seu navegador não suporta o elemento de áudio.
            </audio>
         );
         break;
      default:
        break;
    }
  }
  
  if (mediaElement) {
      return (
          <div className="flex flex-col gap-1 w-full">
              {mediaElement}
              {text && mediaType !== 'audio' && <p className="text-sm whitespace-pre-wrap mt-1 text-left">{text}</p>}
          </div>
      );
  }

  // Render text only if no media
  if (text) {
    return <p className="whitespace-pre-wrap">{text}</p>;
  }

  return null;
};


const QuotedMessagePreview = ({ msg, contact }: { msg: Message, contact: Contact | null }) => {
    let senderName = '';
    if (msg.sender === 'operator') {
        senderName = msg.operatorName || 'Operador';
    } else if (msg.sender === 'bot') {
        senderName = 'Bot';
    } else {
        senderName = contact?.name || 'Usuário';
    }

    const previewText = msg.text && msg.text.length > 50 ? `${msg.text.substring(0, 50)}...` : msg.text;

    return (
        <div className="bg-muted/50 p-2 rounded-t-md border-l-4 border-primary">
            <p className="font-bold text-sm text-primary">{senderName}</p>
            <p className="text-sm text-muted-foreground truncate">{previewText}</p>
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
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    const quotedMessageData = replyingTo ? {
        id: replyingTo.id,
        text: replyingTo.text || '',
        sender: replyingTo.sender,
        senderName: replyingTo.sender === 'user' ? contact?.name || 'User' : (replyingTo.operatorName || 'System'),
      } : undefined;
    
    setNewMessage('');
    setReplyingTo(null);

    try {
      await addMessage(contactId, {
        text: newMessage,
        sender: 'operator',
        operatorName: operatorName,
        tempId: tempId,
        quotedMessage: quotedMessageData
      });
      
      await fetchMessages(contactId, true);
    } catch (error: any) {
      console.error('Falha ao enviar mensagem:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao Enviar',
        description: error.message || 'Não foi possível enviar a mensagem. Por favor, tente novamente.',
      });
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  const sendFileMessage = async (file: File) => {
    if (!file || isUploadingFile) return;

    setIsUploadingFile(true);

    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const mediaUrl = reader.result as string;
            const mediaType = file.type.startsWith('image/') ? 'image' : 'document';

            await addMessage(contactId, {
                mediaUrl,
                mediaType,
                mimetype: file.type,
                fileName: file.name,
                sender: 'operator',
                operatorName,
                tempId: `temp_${Date.now()}`,
                text: newMessage,
            });

            setNewMessage('');
            await fetchMessages(contactId, true);
        };
        reader.onerror = (error) => {
            console.error("Erro ao ler o arquivo:", error);
            throw new Error("Não foi possível processar o arquivo selecionado.");
        };

    } catch (error: any) {
        console.error('Falha ao enviar arquivo:', error);
        toast({
            variant: 'destructive',
            title: 'Erro de Envio',
            description: error.message || 'Não foi possível enviar o arquivo.',
        });
    } finally {
        setIsUploadingFile(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        sendFileMessage(file);
    }
    event.target.value = ''; // Reset input
  };
  
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData.items;
    for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
                sendFileMessage(file);
            }
            return;
        }
    }
  };
  
  const handleStartReply = (message: Message) => {
    setReplyingTo(message);
    textareaRef.current?.focus();
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    textareaRef.current?.focus();
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
      case 'bot':
        return 'rounded-br-none bg-primary text-primary-foreground';
      default:
        return 'rounded-bl-none bg-background';
    }
  };

  const getMessageAlignment = (sender: Message['sender']) => {
     switch (sender) {
      case 'user':
        return 'mr-auto';
      case 'operator':
      case 'bot':
        return 'ml-auto flex-row-reverse';
      default:
        return 'mr-auto';
    }
  }

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
                <div key={msg.id}
                  className={cn(
                  'group relative flex items-end gap-3 w-fit',
                  getMessageAlignment(msg.sender)
                  )}
                >
                  <Avatar className="h-8 w-8">
                  {msg.sender === 'operator' ? (
                      <AvatarFallback>{operatorName.charAt(0)}</AvatarFallback>
                  ) : msg.sender === 'bot' ? (
                      <AvatarImage src={msg.botAvatarUrl || "/logo.svg"} alt="Bot Logo" />
                  ) : (
                      <>
                      <AvatarImage src={contact?.avatar} alt={contact?.name || ''} />
                      <AvatarFallback>{contact?.name.charAt(0)}</AvatarFallback>
                      </>
                  )}
                  </Avatar>
                  <div
                  className={cn(
                      'max-w-xl rounded-lg px-4 py-2 text-sm shadow-sm flex flex-col',
                      getMessageStyle(msg.sender)
                  )}
                  >
                  {msg.sender === 'bot' && (
                      <p className="text-xs font-bold mb-1">BOT</p>
                  )}
                  {msg.sender === 'operator' && msg.operatorName && (
                      <span className="font-bold text-xs mb-1">{msg.operatorName}</span>
                  )}
                  
                  {msg.quotedMessage && (
                      <div className="bg-background/20 p-2 rounded-md mb-2 border-l-2 border-primary-foreground/50">
                          <p className="font-bold text-xs">{msg.quotedMessage.senderName}</p>
                          <p className="text-xs opacity-90 truncate">{msg.quotedMessage.text}</p>
                      </div>
                  )}

                  <MediaMessage msg={msg} onImageClick={setImagePreviewUrl} />

                  <div className="flex items-center justify-end mt-1 text-xs opacity-60 self-end">
                      <span>{new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.sender === 'operator' && msg.status && <MessageStatusIndicator status={msg.status} />}
                  </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("absolute top-0 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity",
                          msg.sender === 'user' ? "right-[-2.5rem]" : "left-[-2.5rem]"
                        )}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleStartReply(msg)}>
                            <CornerUpLeft className="mr-2 h-4 w-4" />
                            <span>Responder</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
            ))
          )}
        </div>
      </ScrollArea>
      
       <Dialog open={!!imagePreviewUrl} onOpenChange={(isOpen) => !isOpen && setImagePreviewUrl(null)}>
        <DialogContent className="max-w-4xl p-2 bg-transparent border-none shadow-none">
          {imagePreviewUrl && (
             // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePreviewUrl} alt="Visualização de Imagem" className="w-full h-auto rounded-lg object-contain" />
          )}
        </DialogContent>
      </Dialog>
      
      <footer className="border-t bg-background p-4">
        {replyingTo && (
            <div className="relative mb-2">
                <QuotedMessagePreview msg={replyingTo} contact={contact} />
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={handleCancelReply}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        )}
        <div className="relative flex items-center gap-2">
          <Textarea
            ref={textareaRef}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Digite uma mensagem ou cole uma imagem..."
            className="min-h-[48px] resize-none pr-24"
            disabled={isSending || isUploadingFile}
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/*,application/pdf"
            disabled={isUploadingFile}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
             <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingFile || isSending}
                aria-label="Anexar arquivo"
              >
                {isUploadingFile ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
              </Button>
            <Button
              type="button"
              size="icon"
              onClick={() => handleSendMessage()}
              disabled={!newMessage.trim() || isSending}
              aria-label="Enviar Texto"
            >
              {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
