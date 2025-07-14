export type User = {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'Operador' | 'Admin';
  createdAt: string;
};

// Tipo para mensagens como são armazenadas no Redis pelo n8n
export type RedisMessage = {
  texto: string;
  tipo: 'user' | 'bot' | 'operator'; // 'tipo' é o campo do Redis
  timestamp: string; // Adicionaremos isso ao buscar
  contactName?: string;
  operatorName?: string;
};

// Tipo para mensagens como são usadas na UI
export type Message = {
  id: string;
  contactId: string;
  text: string; // 'text' é o campo na UI
  sender: 'user' | 'bot' | 'operator'; // 'sender' é o campo na UI
  operatorName?: string;
  timestamp: string;
};

export type Contact = {
  id: string; // Ex: 5511999998888@s.whatsapp.net
  name: string; // Por padrão, será o ID
  avatar: string; // Usaremos placeholder
  lastMessage: string;
  timestamp: string;
  unreadCount: number; // Não temos essa informação do Redis, será 0
};

export const initialUsers: User[] = [
    { id: '1', name: 'Leandro', email: 'leandro@email.com', password: '123', role: 'Admin', createdAt: '2023-01-15' },
    { id: '2', name: 'Alice', email: 'alice@email.com', password: '123', role: 'Operador', createdAt: '2023-02-20' },
];

// Os dados mocados abaixo não serão mais usados para contatos e mensagens
// se a conexão com o Redis for bem-sucedida.
export const contacts: Contact[] = [
  { id: '1', name: 'Maria Silva', avatar: 'https://placehold.co/40x40.png', lastMessage: 'Olá, preciso de ajuda com meu pedido.', timestamp: '10:40 AM', unreadCount: 2 },
  { id: '2', name: 'João Pereira', avatar: 'https://placehold.co/40x40.png', lastMessage: 'Obrigado pela resposta rápida!', timestamp: '10:35 AM', unreadCount: 0 },
];

export const messages: Message[] = [
  { id: 'm1', contactId: '1', text: 'Olá, preciso de ajuda com meu pedido 12345.', sender: 'user', timestamp: '10:38 AM' },
  { id: 'm2', contactId: '1', text: 'BOT: Olá! Para qual pedido você precisa de ajuda? Por favor, informe o número.', sender: 'bot', timestamp: '10:39 AM' },
];