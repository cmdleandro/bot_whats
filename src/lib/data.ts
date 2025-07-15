
export type User = {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'Operador' | 'Admin';
  createdAt: string;
};

export type RedisMessage = {
  texto: string;
  tipo: 'user' | 'bot' | 'operator'; 
  timestamp: string; 
  contactName?: string;
  operatorName?: string;
  contactPhotoUrl?: string; 
  instance?: string;
  needsAttention?: boolean;
};

export type Message = {
  id: string;
  contactId: string;
  text: string; 
  sender: 'user' | 'bot' | 'operator'; 
  operatorName?: string;
  timestamp: string;
  botAvatarUrl?: string;
};

export type Contact = {
  id: string; 
  name: string; 
  avatar: string; 
  lastMessage: string;
  timestamp: string;
  unreadCount: number; 
  needsAttention?: boolean;
};

export type StoredContact = {
  name: string;
  id: string; // The phone number, e.g., 5511999998888@c.us
};


export const initialUsers: User[] = [
    { id: '1', name: 'Leandro', email: 'leandro@email.com', password: '123', role: 'Admin', createdAt: '2023-01-15' },
    { id: '2', name: 'Alice', email: 'alice@email.com', password: '123', role: 'Operador', createdAt: '2023-02-20' },
];
