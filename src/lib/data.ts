export type Message = {
  id: string;
  contactId: string;
  text: string;
  sender: 'user' | 'bot' | 'operator';
  operatorName?: string;
  timestamp: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
};

export type Contact = {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
};

export const contacts: Contact[] = [
  { id: '1', name: 'Maria Silva', avatar: 'https://placehold.co/40x40.png', lastMessage: 'Olá, preciso de ajuda com meu pedido.', timestamp: '10:40 AM', unreadCount: 2 },
  { id: '2', name: 'João Pereira', avatar: 'https://placehold.co/40x40.png', lastMessage: 'Obrigado pela resposta rápida!', timestamp: '10:35 AM', unreadCount: 0 },
  { id: '3', name: 'Ana Costa', avatar: 'https://placehold.co/40x40.png', lastMessage: 'Qual o status do meu ticket?', timestamp: '9:12 AM', unreadCount: 1 },
  { id: '4', name: 'Carlos Souza', avatar: 'https://placehold.co/40x40.png', lastMessage: 'Isso não resolveu meu problema.', timestamp: 'Ontem', unreadCount: 0 },
  { id: '5', name: 'Beatriz Lima', avatar: 'https://placehold.co/40x40.png', lastMessage: 'Tudo funcionando perfeitamente, ótimo serviço!', timestamp: 'Ontem', unreadCount: 0 },
];

export const messages: Message[] = [
  { id: 'm1', contactId: '1', text: 'Olá, preciso de ajuda com meu pedido 12345.', sender: 'user', timestamp: '10:38 AM', sentiment: 'neutral' },
  { id: 'm2', contactId: '1', text: 'BOT: Olá! Para qual pedido você precisa de ajuda? Por favor, informe o número.', sender: 'bot', timestamp: '10:39 AM' },
  { id: 'm3', contactId: '1', text: 'O número é 12345.', sender: 'user', timestamp: '10:40 AM', sentiment: 'neutral' },

  { id: 'm4', contactId: '2', text: 'Minha dúvida foi resolvida, muito obrigado!', sender: 'user', timestamp: '10:34 AM', sentiment: 'positive' },
  { id: 'm5', contactId: '2', text: 'BOT: Fico feliz em ajudar! Se precisar de mais alguma coisa, é só chamar.', sender: 'bot', timestamp: '10:35 AM' },

  { id: 'm6', contactId: '3', text: 'Qual o status do meu ticket?', sender: 'user', timestamp: '9:12 AM', sentiment: 'neutral' },
  { id: 'm7', contactId: '3', text: 'BOT: Para verificar o status do seu ticket, preciso do número de protocolo.', sender: 'bot', timestamp: '9:13 AM' },

  { id: 'm8', contactId: '4', text: 'A instrução que você passou não funcionou. Estou muito frustrado com isso.', sender: 'user', timestamp: 'Ontem', sentiment: 'negative' },
  { id: 'm9', contactId: '4', text: 'BOT: Peço desculpas pelo inconveniente. Estou transferindo você para um de nossos operadores para que possamos resolver seu problema.', sender: 'bot', timestamp: 'Ontem' },

  { id: 'm10', contactId: '5', text: 'Tudo funcionando perfeitamente, ótimo serviço!', sender: 'user', timestamp: 'Ontem', sentiment: 'positive' },
];
