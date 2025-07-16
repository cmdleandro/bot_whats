
'use server';

import { createClient } from 'redis';
import type { Contact, RedisMessage, Message, User, StoredContact, RedisHash } from './data';
import { initialUsers } from './data';
import { formatRelative, fromUnixTime } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getStoredContacts } from '@/actions/contact-actions';

let redisClient: ReturnType<typeof createClient> | null = null;

const BOT_ATTENTION_KEYWORDS = [
    "transferindo para um de nossos atendentes",
    "estou te transferindo para um especialista",
    "vou te passar para um técnico",
    "aguarde o nosso próximo agente",
    "encaminhando sua conversa para o setor responsável",
    "passando para um técnico",
    "vou acionar um técnico humano pra te ajudar melhor"
];


export async function getClient() {
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }

    const url = process.env.REDIS_URL;
    if (!url) {
        console.error('A variável de ambiente REDIS_URL não está definida.');
        throw new Error('A variável de ambiente REDIS_URL não está definida. Por favor, configure-a no arquivo .env ou no painel do seu ambiente de produção.');
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

// Updated parser for HGETALL result
function parseRedisHash(hash: RedisHash | null): RedisMessage | null {
  if (!hash || !hash.id) return null;

  return {
    id: hash.id,
    texto: hash.texto || '',
    tipo: (hash.tipo as RedisMessage['tipo']) || 'user',
    timestamp: hash.timestamp || Math.floor(Date.now() / 1000).toString(),
    contactName: hash.contactName,
    operatorName: hash.operatorName,
    contactPhotoUrl: hash.contactPhotoUrl,
    instance: hash.instance,
    needsAttention: hash.needsAttention, // Stored as a string 'true' or 'false'
    status: hash.status as MessageStatus,
  };
}


function checkNeedsAttention(message: string): boolean {
    const lowerCaseMessage = message.toLowerCase();
    return BOT_ATTENTION_KEYWORDS.some(keyword => lowerCaseMessage.includes(keyword));
}

export async function getContacts(): Promise<Contact[]> {
  try {
    const client = await getClient();
    const [storedContacts, contactKeys] = await Promise.all([
        getStoredContacts(),
        client.keys('chat:*')
    ]);
    const storedContactsMap = new Map(storedContacts.map(c => [c.id, c.name]));


    if (contactKeys.length === 0) {
      return [];
    }
    
    const contacts: Contact[] = await Promise.all(
      contactKeys.map(async (key) => {
        const contactId = key.replace(/^chat:/, '').trim();
        // LINDEX returns a single element, which is the latest message ID
        const lastMessageId = await client.lIndex(key, 0); 
        
        let lastMessageText = 'Nenhuma mensagem ainda.';
        let timestamp = Date.now();
        let needsAttention = false;
        
        if(lastMessageId) {
            const lastMessageHash = await client.hGetAll(`message:${lastMessageId}`);
            const lastMsg = parseRedisHash(lastMessageHash);
            if (lastMsg && lastMsg.texto) { // Ensure there is text
                lastMessageText = lastMsg.texto;
                timestamp = lastMsg.timestamp ? parseInt(lastMsg.timestamp, 10) * 1000 : Date.now();
                needsAttention = lastMsg.needsAttention === 'true';
            }
        }
        
        let contactName = storedContactsMap.get(contactId) || contactId.split('@')[0];
        let avatar = `https://placehold.co/40x40.png`;

        if (!storedContactsMap.has(contactId)) {
            const messageIds = await client.lRange(key, 0, 5);
            if(messageIds.length > 0) {
                 const multi = client.multi();
                 messageIds.forEach(id => multi.hGetAll(`message:${id}`));
                 const messagesHashes = (await multi.exec()) as RedisHash[];

                 for(const msgHash of messagesHashes) {
                     const msg = parseRedisHash(msgHash);
                     if (msg && msg.tipo === 'user') {
                        if (msg.contactName) contactName = msg.contactName;
                        if (msg.contactPhotoUrl) avatar = msg.contactPhotoUrl;
                        if (contactName !== contactId.split('@')[0] && avatar !== `https://placehold.co/40x40.png`) break;
                     }
                 }
            }
        }
        
        return {
          id: contactId,
          name: contactName,
          avatar: avatar || `https://placehold.co/40x40.png`,
          lastMessage: lastMessageText,
          timestamp: formatRelative(fromUnixTime(timestamp / 1000), new Date(), { locale: ptBR }),
          unreadCount: 0,
          needsAttention,
        };
      })
    );
    
    const validContacts = contacts.filter(c => c.id && !c.id.includes('$json'));
    return validContacts.sort((a, b) => {
        if (a.needsAttention && !b.needsAttention) return -1;
        if (!a.needsAttention && b.needsAttention) return 1;
        // Simple sort by timestamp as fetching relative time is complex here
        return b.timestamp.localeCompare(a.timestamp);
    });

  } catch (error) {
    console.error("Falha ao buscar contatos do Redis:", error);
    return [];
  }
}

export async function getMessages(contactId: string): Promise<Message[]> {
  try {
    const client = await getClient();
    const historyKey = `chat:${contactId.trim()}`;
    const messageIds = await client.lRange(historyKey, 0, -1);

    if (!messageIds || messageIds.length === 0) {
      return [];
    }
    
    const multi = client.multi();
    messageIds.forEach(id => multi.hGetAll(`message:${id}`));
    const messagesHashes = (await multi.exec()) as (RedisHash | null)[];

    const messages = messagesHashes
      .map((hash) => {
        if (!hash) return null; // Handle case where a message hash might be missing
        const redisMsg = parseRedisHash(hash);
        if (!redisMsg) return null;

        const timestamp = redisMsg.timestamp ? parseInt(redisMsg.timestamp, 10) * 1000 : Date.now();
        const sender: Message['sender'] = ['user', 'bot', 'operator'].includes(redisMsg.tipo) ? redisMsg.tipo : 'user';

        return {
          id: redisMsg.id,
          contactId: contactId,
          text: redisMsg.texto,
          sender: sender,
          operatorName: redisMsg.operatorName,
          timestamp: new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          botAvatarUrl: sender === 'bot' ? redisMsg.contactPhotoUrl : undefined,
          status: redisMsg.status,
        };
      })
      .filter((msg): msg is Message => msg !== null);

    return messages.sort((a, b) => {
        const timeA = a.timestamp;
        const timeB = b.timestamp;
        if(timeA < timeB) return -1;
        if(timeA > timeB) return 1;
        return 0;
    });

  } catch (error) {
    console.error(`Falha ao buscar mensagens para ${contactId} do Redis:`, error);
    return [];
  }
}

export async function addMessage(contactId: string, message: { text: string; sender: 'operator', operatorName: string, tempId: string }): Promise<void> {
  try {
    const client = await getClient();
    const historyKey = `chat:${contactId.trim()}`;
    const channelName = 'fila_envio_whatsapp';
    
    let instanceName = 'default';
    const recentMessageIds = await client.lRange(historyKey, 0, 10);
     if (recentMessageIds.length > 0) {
        const firstMessageHash = await client.hGetAll(`message:${recentMessageIds[0]}`);
        const parsedMsg = parseRedisHash(firstMessageHash);
        if (parsedMsg && parsedMsg.instance) {
            instanceName = parsedMsg.instance;
        }
    }
    
    const redisMessageForHistory: RedisHash = {
      id: message.tempId,
      texto: message.text,
      tipo: message.sender,
      timestamp: Math.floor(Date.now() / 1000).toString(),
      operatorName: message.operatorName,
      instance: instanceName,
      needsAttention: 'false',
      status: 'sent',
    };
    
    const messageKey = `message:${message.tempId}`;
    const messageForQueue = {
        instance: instanceName,
        remoteJid: contactId.trim(),
        text: `*${message.operatorName}*\n${message.text}`,
        messageId: message.tempId
    };

    const transaction = client.multi();
    transaction.hSet(messageKey, redisMessageForHistory);
    transaction.lPush(historyKey, message.tempId);
    transaction.publish(channelName, JSON.stringify(messageForQueue));
    
    await transaction.exec();
    
    console.log(`Mensagem ${message.tempId} para ${contactId} (Hash) publicada no canal ${channelName}.`);

  } catch (error) {
    console.error(`Falha ao adicionar mensagem para ${contactId} no Redis:`, error);
    throw error;
  }
}

export async function dismissAttention(contactId: string): Promise<void> {
  try {
    const client = await getClient();
    const key = `chat:${contactId.trim()}`;
    const lastMessageId = await client.lIndex(key, 0); 

    if (!lastMessageId) return;
    
    const messageKey = `message:${lastMessageId}`;
    const needsAttention = await client.hGet(messageKey, 'needsAttention');
    
    if (needsAttention === 'true') {
      await client.hSet(messageKey, 'needsAttention', 'false');
      console.log(`Alarme para o contato ${contactId} foi desativado.`);
    }
  } catch (error) {
    console.error(`Falha ao desativar o alarme para ${contactId}:`, error);
  }
}

const USERS_KEY = 'chatview:users';

export async function getUsers(): Promise<User[]> {
    try {
        const client = await getClient();
        let usersJson = await client.get(USERS_KEY);

        if (!usersJson) {
            await client.set(USERS_KEY, JSON.stringify(initialUsers));
            usersJson = JSON.stringify(initialUsers);
        }

        return JSON.parse(usersJson);
    } catch (error) {
        console.error('Falha ao buscar usuários do Redis:', error);
        return initialUsers;
    }
}

export async function saveUsers(users: User[]): Promise<void> {
    try {
        const client = await getClient();
        await client.set(USERS_KEY, JSON.stringify(users));
    } catch (error) {
        console.error('Falha ao salvar usuários no Redis:', error);
        throw error;
    }
}
