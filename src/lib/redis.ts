'use server';

import { createClient } from 'redis';
import type { Contact, RedisMessage, Message } from './data';
import { formatRelative, fromUnixTime } from 'date-fns';
import { ptBR } from 'date-fns/locale';

let redisClient: ReturnType<typeof createClient> | null = null;

export async function getClient() {
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }

    const url = process.env.REDIS_URL;
    if (!url) {
        console.error('A variável de ambiente REDIS_URL não está definida.');
        throw new Error('A variável de ambiente REDIS_URL não está definida. Por favor, configure-a no painel do seu ambiente de produção.');
    }
    
    try {
        const client = createClient({ 
            url,
            socket: {
                connectTimeout: 5000
            }
        });

        client.on('error', (err) => {
            console.error('Erro no Cliente Redis', err);
            redisClient = null;
        });

        await client.connect();
        console.log('Cliente Redis conectado com sucesso.');
        redisClient = client;
        return redisClient;
    } catch (e) {
        console.error('Falha ao conectar ao Redis:', e);
        redisClient = null;
        throw e;
    }
}

function parseRedisMessage(jsonString: string): RedisMessage | null {
  try {
    const data = JSON.parse(jsonString);
    // Basic validation to ensure it's a message object we expect
    if (data && typeof data.texto === 'string' && typeof data.tipo === 'string') {
        return data;
    }
    return null;
  } catch (e) {
    console.warn(`Could not parse message from Redis: "${jsonString}"`, e);
    return null;
  }
}

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
        const contactId = key.replace(/^chat:/, '').trim();
        const allMessagesJson = await client.lRange(key, 0, -1);
        
        let lastMessageText = 'Nenhuma mensagem ainda.';
        let timestamp = Date.now();
        let contactName = contactId.split('@')[0];
        let avatar = `https://placehold.co/40x40.png`;

        if (allMessagesJson.length > 0) {
          const lastMessageJson = allMessagesJson[0]; // Redis lPush makes index 0 the latest
          const lastMessage = parseRedisMessage(lastMessageJson);
          
          if (lastMessage) {
              lastMessageText = lastMessage.texto || 'Mensagem sem texto';
              timestamp = lastMessage.timestamp ? parseInt(lastMessage.timestamp, 10) * 1000 : Date.now();
          }
        }
        
        // Loop through all messages to find the latest contact name and photo
        for (const msgJson of allMessagesJson) {
            const msg = parseRedisMessage(msgJson);
            if (msg?.contactName) {
                contactName = msg.contactName;
            }
            if (msg?.contactPhotoUrl) {
                avatar = msg.contactPhotoUrl;
            }
        }
        
        return {
          id: contactId,
          name: contactName,
          avatar: avatar,
          lastMessage: lastMessageText,
          timestamp: formatRelative(fromUnixTime(timestamp / 1000), new Date(), { locale: ptBR }),
          unreadCount: 0,
        };
      })
    );
    
    const validContacts = contacts.filter(c => c.id && !c.id.includes('$json'));
    return validContacts.sort((a, b) => {
        const dateA = new Date(a.timestamp.startsWith('hoje') || a.timestamp.startsWith('ontem') ? new Date() : a.timestamp);
        const dateB = new Date(b.timestamp.startsWith('hoje') || b.timestamp.startsWith('ontem') ? new Date() : b.timestamp);
        return dateB.getTime() - dateA.getTime();
    });

  } catch (error) {
    console.error("Falha ao buscar contatos do Redis:", error);
    return [];
  }
}

export async function getMessages(contactId: string): Promise<Message[]> {
  try {
    const client = await getClient();
    const key = `chat:${contactId.trim()}`;
    const messagesJson = await client.lRange(key, 0, -1);

    if (!messagesJson || messagesJson.length === 0) {
      return [];
    }
    
    // Reverse the array to get chronological order (oldest first)
    messagesJson.reverse();

    const parsedMessages = messagesJson.map((jsonString, index) => {
      const redisMsg = parseRedisMessage(jsonString);

      if (redisMsg) {
        const timestamp = redisMsg.timestamp ? parseInt(redisMsg.timestamp, 10) * 1000 : Date.now();
        return {
          id: `m-${contactId}-${index}`,
          contactId: contactId,
          text: redisMsg.texto,
          sender: redisMsg.tipo,
          operatorName: redisMsg.operatorName,
          timestamp: new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
      }
      // If parsing fails, we return null and filter it out later.
      return null;
    });
    
    // Filter out any messages that failed to parse
    return parsedMessages.filter((msg): msg is Message => msg !== null);

  } catch (error) {
    console.error(`Falha ao buscar mensagens para ${contactId} do Redis:`, error);
    return [];
  }
}

export async function addMessage(contactId: string, message: { text: string; sender: 'operator', operatorName: string }): Promise<void> {
  try {
    const client = await getClient();
    const key = `chat:${contactId.trim()}`;
    
    const redisMessage: RedisMessage = {
      texto: message.text,
      tipo: message.sender,
      timestamp: Math.floor(Date.now() / 1000).toString(),
      operatorName: message.operatorName,
    };
    
    // LPUSH adds to the head of the list (index 0)
    await client.lPush(key, JSON.stringify(redisMessage));

  } catch (error) {
    console.error(`Falha ao adicionar mensagem para ${contactId} no Redis:`, error);
    throw error;
  }
}
