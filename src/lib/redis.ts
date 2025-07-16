
'use server';

import { createClient } from 'redis';
import type { Contact, RedisMessage, Message, User, StoredContact, RedisHash } from './data';
import { initialUsers } from './data';
import { formatRelative, fromUnixTime } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getStoredContacts } from '@/actions/contact-actions';

let redisClient: ReturnType<typeof createClient> | null = null;

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

function parseRedisHash(hash: RedisHash | null): RedisMessage | null {
  if (!hash || typeof hash !== 'object' || Object.keys(hash).length === 0) return null;

  return {
    id: hash.id || '',
    texto: hash.texto || '',
    tipo: (hash.tipo as RedisMessage['tipo']) || 'user',
    timestamp: hash.timestamp || Math.floor(Date.now() / 1000).toString(),
    operatorName: hash.operatorName,
    contactName: hash.contactName,
    contactPhotoUrl: hash.contactPhotoUrl,
    instance: hash.instance,
    needsAttention: hash.needsAttention === 'true',
    status: hash.status as Message['status'],
  };
}

export async function getContacts(): Promise<Contact[]> {
  try {
    const client = await getClient();
    const chatKeys = [];
    for await (const key of client.scanIterator({ MATCH: 'chat:*', COUNT: 100 })) {
        chatKeys.push(key);
    }
    
    if (chatKeys.length === 0) {
      return [];
    }
    
    // Get the latest message ID for each chat
    const multi = client.multi();
    chatKeys.forEach(key => multi.lIndex(key, 0)); 
    const lastMessageIds = await multi.exec() as (string | null)[];

    // Fetch the content of each latest message
    const messagesMulti = client.multi();
    lastMessageIds.forEach(id => {
        if (id) {
            messagesMulti.hGetAll(`message:${id}`);
        } else {
            messagesMulti.hGetAll('non-existent-key-placeholder'); 
        }
    });
    const lastMessagesHashes = await messagesMulti.exec() as (RedisHash | null)[];
    
    const contacts: Contact[] = [];
    for (let i = 0; i < chatKeys.length; i++) {
        const key = chatKeys[i];
        const contactId = key.replace(/^chat:/, '');
        const lastMsgHash = lastMessagesHashes[i];
        const lastMsg = parseRedisHash(lastMsgHash);

        let lastMessageText = 'Nenhuma mensagem ainda.';
        let timestamp = Date.now();
        let needsAttention = false;
        let contactName = contactId.split('@')[0];

        if (lastMsg) {
            lastMessageText = lastMsg.texto || 'Mensagem sem texto.';
            timestamp = lastMsg.timestamp ? parseInt(lastMsg.timestamp, 10) * 1000 : Date.now();
            needsAttention = lastMsg.needsAttention === true;
            if (lastMsg.contactName) {
                contactName = lastMsg.contactName;
            }
        }
        
        contacts.push({
            id: contactId,
            name: contactName,
            avatar: `https://placehold.co/40x40.png`,
            lastMessage: lastMessageText,
            timestamp: formatRelative(fromUnixTime(timestamp / 1000), new Date(), { locale: ptBR }),
            unreadCount: 0, 
            needsAttention,
        });
    }

    // Sort the final list
    return contacts.sort((a, b) => {
      if (a.needsAttention && !b.needsAttention) return -1;
      if (!a.needsAttention && b.needsAttention) return 1;
      
      const aTimestamp = new Date(a.timestamp).getTime();
      const bTimestamp = new Date(b.timestamp).getTime();
      if (!isNaN(aTimestamp) && !isNaN(bTimestamp)) {
          return bTimestamp - aTimestamp;
      }
      return b.id.localeCompare(a.id);
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
        if (!hash) return null; 
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

    return messages;

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
    const firstMessageId = await client.lIndex(historyKey, 0);
     if (firstMessageId) {
        const firstMessageHash = await client.hGetAll(`message:${firstMessageId}`);
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
