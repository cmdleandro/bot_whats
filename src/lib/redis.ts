// Adicionar 'use server' para que essas funções possam ser chamadas de componentes de cliente
'use server';

import { createClient } from 'redis';
import type { Contact, RedisMessage, Message } from './data';
import { formatRelative, fromUnixTime } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// O cliente Redis será criado apenas uma vez e reutilizado.
let redisClient: ReturnType<typeof createClient> | null = null;

async function getClient() {
  if (!redisClient) {
    const url = process.env.REDIS_URL;
    if (!url) {
      console.error('A variável de ambiente REDIS_URL não está definida.');
      // Retornar um objeto mock ou lançar um erro mais informativo
      throw new Error('A variável de ambiente REDIS_URL não está definida.');
    }
    
    try {
      const client = createClient({ url });
      client.on('error', (err) => console.error('Erro no Cliente Redis', err));
      await client.connect();
      redisClient = client;
    } catch (e) {
      console.error('Falha ao conectar ao Redis:', e);
      throw e; // Lança o erro para a função que chamou saber que falhou
    }
  }
  return redisClient;
}

// Busca a lista de contatos a partir das chaves do Redis
export async function getContacts(): Promise<Contact[]> {
  try {
    const client = await getClient();
    const contactKeys = [];
    // O scan é mais seguro para produção do que o KEYS
    for await (const key of client.scanIterator({ MATCH: 'chat:*', COUNT: 100 })) {
      contactKeys.push(key);
    }

    if (contactKeys.length === 0) {
      return [];
    }

    const contacts: Contact[] = await Promise.all(
      contactKeys.map(async (key) => {
        const lastMessageJson = await client.lRange(key, -1, -1);
        const contactId = key.replace('chat:', '');
        
        let lastMessageText = 'Nenhuma mensagem ainda.';
        let timestamp = Date.now();

        if (lastMessageJson.length > 0) {
          try {
            const lastMessage: RedisMessage = JSON.parse(lastMessageJson[0]);
            lastMessageText = lastMessage.texto || 'Mensagem sem texto';
            timestamp = lastMessage.timestamp ? parseInt(lastMessage.timestamp) * 1000 : Date.now();
          } catch (e) {
            console.error(`Falha ao parsear a última mensagem para a chave ${key}:`, lastMessageJson[0]);
          }
        }
        
        return {
          id: contactId,
          name: contactId.split('@')[0], // Usa o número como nome
          avatar: `https://placehold.co/40x40.png`,
          lastMessage: lastMessageText,
          timestamp: formatRelative(fromUnixTime(timestamp / 1000), new Date(), { locale: ptBR }),
          unreadCount: 0, // Não temos essa info do Redis
        };
      })
    );
    
    // Ordena os contatos pela mensagem mais recente
    return contacts.sort((a, b) => {
        // Esta é uma ordenação simples, uma mais robusta exigiria parsing das datas relativas
        return b.timestamp.localeCompare(a.timestamp);
    });

  } catch (error) {
    console.error("Falha ao buscar contatos do Redis:", error);
    return []; // Retorna um array vazio em caso de erro.
  }
}

// Busca todas as mensagens de um contato específico
export async function getMessages(contactId: string): Promise<Message[]> {
  try {
    const client = await getClient();
    const key = `chat:${contactId}`;
    // LRange(key, 0, -1) busca todos os elementos da lista
    const messagesJson = await client.lRange(key, 0, -1);

    if (!messagesJson) {
      return [];
    }
    
    return messagesJson.map((jsonString, index) => {
      try {
        const redisMsg: RedisMessage = JSON.parse(jsonString);
        const timestamp = redisMsg.timestamp ? parseInt(redisMsg.timestamp) * 1000 : Date.now();
        
        return {
          id: `m-${contactId}-${index}`,
          contactId: contactId,
          text: redisMsg.texto,
          sender: redisMsg.tipo, // 'user' ou 'bot'
          timestamp: new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
      } catch (e) {
        console.error(`Falha ao parsear mensagem para o contato ${contactId}:`, jsonString);
        return {
          id: `m-error-${index}`,
          contactId: contactId,
          text: 'Erro ao carregar esta mensagem',
          sender: 'bot',
          timestamp: 'agora'
        };
      }
    }).reverse(); // As mensagens são adicionadas no final, então invertemos para exibir na ordem correta
  } catch (error) {
    console.error(`Falha ao buscar mensagens para ${contactId} do Redis:`, error);
    return [];
  }
}
