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
      // Lança um erro claro para que o desenvolvedor saiba o que configurar.
      throw new Error('A variável de ambiente REDIS_URL não está definida. Por favor, configure-a nas variáveis de ambiente do seu serviço de aplicação.');
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
            // A mensagem do Redis está como uma string JSON, precisa de dois parses.
            const parsedMessageString = JSON.parse(lastMessageJson[0]);
            const lastMessage: RedisMessage = JSON.parse(parsedMessageString);
            
            lastMessageText = lastMessage.texto || 'Mensagem sem texto';
            timestamp = lastMessage.timestamp ? parseInt(lastMessage.timestamp) * 1000 : Date.now();
          } catch (e) {
            // Tentativa de fallback se o primeiro parse já for o objeto
            try {
              const lastMessage: RedisMessage = JSON.parse(lastMessageJson[0]);
              lastMessageText = lastMessage.texto || 'Mensagem sem texto';
              timestamp = lastMessage.timestamp ? parseInt(lastMessage.timestamp) * 1000 : Date.now();
            } catch (e2) {
               console.error(`Falha ao parsear a última mensagem para a chave ${key}:`, lastMessageJson[0]);
            }
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
        // ou usar o timestamp numérico antes de formatar.
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
    
    const parsedMessages = messagesJson.map((jsonString, index) => {
      try {
        // A mensagem pode estar como uma string JSON, precisando de dois parses.
        const parsedString = JSON.parse(jsonString);
        const redisMsg: RedisMessage = JSON.parse(parsedString);

        const timestamp = redisMsg.timestamp ? parseInt(redisMsg.timestamp) * 1000 : Date.now();
        
        return {
          id: `m-${contactId}-${index}`,
          contactId: contactId,
          text: redisMsg.texto,
          sender: redisMsg.tipo, // 'user' ou 'bot'
          operatorName: redisMsg.tipo === 'operator' ? 'Operador' : undefined,
          timestamp: new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
      } catch (e) {
         try {
            // Fallback para caso a string não esteja duplamente encapsulada
            const redisMsg: RedisMessage = JSON.parse(jsonString);
            const timestamp = redisMsg.timestamp ? parseInt(redisMsg.timestamp) * 1000 : Date.now();
            return {
              id: `m-${contactId}-${index}`,
              contactId: contactId,
              text: redisMsg.texto,
              sender: redisMsg.tipo,
              operatorName: redisMsg.tipo === 'operator' ? 'Operador' : undefined,
              timestamp: new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            };
         } catch(e2) {
            console.error(`Falha ao parsear mensagem para o contato ${contactId}:`, jsonString);
            return {
              id: `m-error-${index}`,
              contactId: contactId,
              text: 'Erro ao carregar esta mensagem',
              sender: 'bot',
              timestamp: 'agora'
            };
         }
      }
    });
    // O n8n dá push, então as mais recentes estão no fim. `lrange` busca do início (antigas) ao fim (recentes).
    // Para o chat, queremos a ordem cronológica, então não precisamos reverter.
    return parsedMessages;
  } catch (error) {
    console.error(`Falha ao buscar mensagens para ${contactId} do Redis:`, error);
    return [];
  }
}

// Adiciona uma nova mensagem ao chat no Redis
export async function addMessage(contactId: string, message: { text: string; sender: 'operator', operatorName: string }): Promise<void> {
  try {
    const client = await getClient();
    const key = `chat:${contactId}`;
    
    const redisMessage = {
      texto: message.text,
      tipo: message.sender,
      timestamp: Math.floor(Date.now() / 1000).toString(), // Timestamp em segundos
      operatorName: message.operatorName,
    };

    // O n8n parece estar fazendo um JSON.stringify duplo. Vamos replicar.
    const messageString = JSON.stringify(JSON.stringify(redisMessage));
    
    await client.rPush(key, messageString);

  } catch (error) {
    console.error(`Falha ao adicionar mensagem para ${contactId} no Redis:`, error);
    throw error; // Lança o erro para a UI poder reagir
  }
}
