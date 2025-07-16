
export type User = {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'Operador' | 'Admin';
  createdAt: string;
};

export type MessageStatus = 'sent' | 'delivered' | 'read';

// Representa a estrutura de uma mensagem como um Hash no Redis.
// Todos os valores são strings, como o Redis os armazena.
export type RedisHash = {
  [key: string]: string;
};

// Representa a mensagem após ser processada para uso na UI.
export type Message = {
  id: string;
  contactId: string;
  text: string;
  sender: 'user' | 'bot' | 'operator';
  operatorName?: string;
  timestamp: string; // Formatado para exibição (ex: "14:30")
  botAvatarUrl?: string;
  status?: MessageStatus;
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

// Este tipo representa uma mensagem antes de ser formatada para a UI.
// Os tipos de dados são mais próximos dos originais.
export type RedisMessage = {
  id: string;
  texto: string;
  tipo: 'user' | 'bot' | 'operator';
  timestamp: string; // Unix timestamp as a string
  contactName?: string;
  operatorName?: string;
  contactPhotoUrl?: string;
  instance?: string;
  needsAttention?: boolean;
  status?: MessageStatus;
};


export const initialUsers: User[] = [
    { id: '1', name: 'Leandro', email: 'leandro@email.com', password: '123', role: 'Admin', createdAt: '2023-01-15' },
    { id: '2', name: 'Alice', email: 'alice@email.com', password: '123', role: 'Operador', createdAt: '2023-02-20' },
];
