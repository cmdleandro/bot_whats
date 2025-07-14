'use server';

import { createClient } from 'redis';
import type { Contact, RedisMessage, Message } from './data';
import { formatRelative, fromUnixTime } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// O cliente Redis será criado apenas uma vez e reutilizado.
let redisClient: ReturnType<typeof createClient> | null = null;

// Função para obter o cliente Redis.
// Ela garante que a conexão seja estabelecida apenas uma vez.
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
                connectTimeout: 5000 // Timeout de conexão de 5 segundos
            }
        });

        client.on('error', (err) => {
            console.error('Erro no Cliente Redis', err);
            redisClient = null; // Invalida o cliente para permitir uma nova tentativa de conexão
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

// Função auxiliar para parsear mensagens de forma segura
function parseRedisMessage(jsonString: string): RedisMessage | null {
  try {
    const data = JSON.parse(jsonString);
    // Garante que o objeto tenha a estrutura esperada
    if (data && data.texto && data.tipo) {
        return data;
    }
    return null;
  } catch (e) {
      // Se não for um JSON válido, trata como uma mensagem de texto simples do usuário.
      return {
          texto: jsonString,
          tipo: 'user', 
          timestamp: Math.floor(Date.now() / 1000).toString(),
      };
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
    
    // Agrupa chaves pelo mesmo ID de contato normalizado para evitar duplicatas
    const groupedKeys: { [key: string]: string[] } = {};
    contactKeys.forEach(key => {
      // Remove o prefixo 'chat:' e espaços em branco para obter o ID limpo
      const contactId = key.replace(/^chat:/, '').trim();
      if (!groupedKeys[contactId]) {
        groupedKeys[contactId] = [];
      }
      groupedKeys[contactId].push(key);
    });

    const uniqueContactIds = Object.keys(groupedKeys);

    const contacts: Contact[] = await Promise.all(
      uniqueContactIds.map(async (contactId) => {
        // Usa a primeira chave encontrada para esse ID, já que todas apontam para a mesma conversa
        const representativeKey = groupedKeys[contactId][0];
        const allMessagesJson = await client.lRange(representativeKey, 0, -1);
        
        let lastMessageText = 'Nenhuma mensagem ainda.';
        let timestamp = Date.now();
        let contactName = contactId.split('@')[0]; // Fallback name
        const avatar = `https://placehold.co/40x40.png`;

        if (allMessagesJson.length > 0) {
          const lastMessageJson = allMessagesJson[allMessagesJson.length - 1];
          const lastMessage = parseRedisMessage(lastMessageJson);
          
          if (lastMessage) {
              lastMessageText = lastMessage.texto || 'Mensagem sem texto';
              timestamp = lastMessage.timestamp ? parseInt(lastMessage.timestamp, 10) * 1000 : Date.now();
              
              // Tenta encontrar o nome do contato em qualquer mensagem
              for (const msgJson of allMessagesJson) {
                const msg = parseRedisMessage(msgJson);
                if (msg?.contactName) {
                  contactName = msg.contactName;
                  break; // Para no primeiro nome que encontrar
                }
              }
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
    
    // Filtra contatos sem ID válido e ordena
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

// Busca todas as mensagens de um contato específico
export async function getMessages(contactId: string): Promise<Message[]> {
  try {
    const client = await getClient();
    const key = `chat:${contactId.trim()}`;
    const messagesJson = await client.lRange(key, 0, -1);

    if (!messagesJson || messagesJson.length === 0) {
      return [];
    }
    
    const parsedMessages = messagesJson.map((jsonString, index) => {
      const redisMsg = parseRedisMessage(jsonString);

      if (!redisMsg) {
        return null;
      }

      const timestamp = redisMsg.timestamp ? parseInt(redisMsg.timestamp, 10) * 1000 : Date.now();
      
      return {
        id: `m-${contactId}-${index}`,
        contactId: contactId,
        text: redisMsg.texto || '',
        sender: redisMsg.tipo,
        operatorName: redisMsg.operatorName,
        timestamp: new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
    }).filter((msg): msg is Message => msg !== null);
    
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
    const key = `chat:${contactId.trim()}`;
    
    const redisMessage = {
      texto: message.text,
      tipo: message.sender,
      timestamp: Math.floor(Date.now() / 1000).toString(),
      operatorName: message.operatorName,
    };
    
    await client.rPush(key, JSON.stringify(redisMessage));

  } catch (error) {
    console.error(`Falha ao adicionar mensagem para ${contactId} no Redis:`, error);
    throw error;
  }
}