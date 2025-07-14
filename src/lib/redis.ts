'use server';

import { createClient } from 'redis';
import type { Contact, RedisMessage, Message } from './data';
import { formatRelative, fromUnixTime } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// O cliente Redis será criado apenas uma vez e reutilizado.
let redisClient: ReturnType<typeof createClient> | null = null;
let clientPromise: Promise<ReturnType<typeof createClient>> | null = null;


// Envolve a criação do cliente em uma Promise para lidar com conexões concorrentes.
function connectToRedis() {
    if (clientPromise) {
        return clientPromise;
    }
    clientPromise = (async () => {
        const url = process.env.REDIS_URL;
        if (!url) {
            console.error('A variável de ambiente REDIS_URL não está definida.');
            throw new Error('A variável de ambiente REDIS_URL não está definida. Por favor, configure-a no Easypanel.');
        }
        
        try {
            const client = createClient({ 
                url,
                socket: {
                    connectTimeout: 5000 // Timeout de conexão de 5 segundos
                }
            });
            client.on('error', (err) => {
                console.error('Erro no Cliente Redis', err);
                redisClient = null; // Invalida o cliente em caso de erro
                clientPromise = null; // Permite uma nova tentativa de conexão
            });
            await client.connect();
            console.log('Cliente Redis conectado com sucesso.');
            redisClient = client;
            return client;
        } catch (e) {
            console.error('Falha ao conectar ao Redis:', e);
            redisClient = null;
            clientPromise = null;
            throw e;
        }
    })();
    return clientPromise;
}

export async function getClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }
  return connectToRedis();
}

// Função auxiliar para parsear mensagens de forma segura
function parseRedisMessage(jsonString: string, key: string): RedisMessage | null {
  try {
    const data = JSON.parse(jsonString);
    if (typeof data === 'string') {
        return JSON.parse(data);
    }
    return data;
  } catch (e) {
      console.error(`Falha ao parsear mensagem para a chave ${key}. Conteúdo:`, jsonString, 'Erro:', e);
      return null;
  }
}


// Busca a lista de contatos a partir das chaves do Redis
export async function getContacts(): Promise<Contact[]> {
  try {
    const client = await getClient();
    const contactKeys = [];
    for await (const key of client.scanIterator({ MATCH: 'chat:*', COUNT: 100 })) {
      contactKeys.push(key);
    }

    if (contactKeys.length === 0) {
      return [];
    }

    const contacts: Contact[] = await Promise.all(
      contactKeys.map(async (key) => {
        const lastMessageJsonArray = await client.lRange(key, -1, -1);
        const contactId = key.replace('chat:', '');
        
        let lastMessageText = 'Nenhuma mensagem ainda.';
        let timestamp = Date.now();

        if (lastMessageJsonArray.length > 0) {
          const lastMessage = parseRedisMessage(lastMessageJsonArray[0], key);
          if (lastMessage) {
              lastMessageText = lastMessage.texto || 'Mensagem sem texto';
              timestamp = lastMessage.timestamp ? parseInt(lastMessage.timestamp, 10) * 1000 : Date.now();
          }
        }
        
        return {
          id: contactId,
          name: contactId.split('@')[0],
          avatar: `https://placehold.co/40x40.png`,
          lastMessage: lastMessageText,
          timestamp: formatRelative(fromUnixTime(timestamp / 1000), new Date(), { locale: ptBR }),
          unreadCount: 0,
        };
      })
    );
    
    return contacts.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  } catch (error) {
    console.error("Falha ao buscar contatos do Redis:", error);
    return [];
  }
}

// Busca todas as mensagens de um contato específico
export async function getMessages(contactId: string): Promise<Message[]> {
  try {
    const client = await getClient();
    const key = `chat:${contactId}`;
    const messagesJson = await client.lRange(key, 0, -1);

    if (!messagesJson || messagesJson.length === 0) {
      return [];
    }
    
    const parsedMessages = messagesJson.map((jsonString, index) => {
      const redisMsg = parseRedisMessage(jsonString, key);

      if (!redisMsg) {
        return {
          id: `m-error-${contactId}-${index}`,
          contactId: contactId,
          text: 'Erro ao carregar esta mensagem',
          sender: 'bot',
          timestamp: 'agora'
        };
      }

      const timestamp = redisMsg.timestamp ? parseInt(redisMsg.timestamp, 10) * 1000 : Date.now();
      
      return {
        id: `m-${contactId}-${index}`,
        contactId: contactId,
        text: redisMsg.texto || '',
        sender: redisMsg.tipo,
        operatorName: redisMsg.tipo === 'operator' ? 'Operador' : undefined,
        timestamp: new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
    });

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
      timestamp: Math.floor(Date.now() / 1000).toString(),
      operatorName: message.operatorName,
    };
    
    const messageString = JSON.stringify(JSON.stringify(redisMessage));
    
    await client.rPush(key, messageString);

  } catch (error) {
    console.error(`Falha ao adicionar mensagem para ${contactId} no Redis:`, error);
    throw error;
  }
}
