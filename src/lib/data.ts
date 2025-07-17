
export type User = {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'Operador' | 'Admin';
  createdAt: string;
};

export type MessageStatus = 'sent' | 'delivered' | 'read';
export type MediaType = 'image' | 'video' | 'audio' | 'document';

// Este tipo representa o objeto JSON que está dentro da string na lista do Redis
export type StoredMessage = {
  id?: string; // id pode não estar presente nos dados do webhook
  texto: string;
  tipo: 'user' | 'bot' | 'operator';
  timestamp: string; // Unix timestamp as a string
  contactName?: string;
  operatorName?: string;
  contactPhotoUrl?: string;
  instance?: string;
  needsAttention?: boolean;
  status?: MessageStatus;
  fromMe?: string; // Campo booleano como string, vindo do webhook
  messageId?: string; // ID da mensagem vindo do webhook
  mediaUrl?: string;
  messageType?: string; // e.g., 'imageMessage', 'videoMessage' from webhook
  caption?: string;
  jpegThumbnail?: string; // Base64 encoded thumbnail
};


// Representa a mensagem após ser processada para uso na UI.
export type Message = {
  id: string;
  contactId: string;
  text: string;
  sender: 'user' | 'bot' | 'operator';
  operatorName?: string;
  timestamp: number; // O timestamp UNIX original (em milissegundos) para ser formatado no cliente
  botAvatarUrl?: string;
  status?: MessageStatus;
  mediaUrl?: string;
  mediaType?: MediaType;
  jpegThumbnail?: string;
};

export type Contact = {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string; // Formatado para exibição (ex: "há 2 horas")
  unreadCount: number;
  needsAttention?: boolean;
};

export type StoredContact = {
  name: string;
  id: string; // The phone number, e.g., 5511999998888@c.us
};

export type GlobalSettings = {
  defaultInstance: string;
};


export const initialUsers: User[] = [
    { id: '1', name: 'Leandro', email: 'leandro@email.com', password: '123', role: 'Admin', createdAt: '2023-01-15' },
    { id: '2', name: 'Alice', email: 'alice@email.com', password: '123', role: 'Operador', createdAt: '2023-02-20' },
];
