
'use server';

import { createClient } from 'redis';
import type { Contact, RedisMessage, Message, User, RedisHash } from './data';
import { initialUsers } from './data';
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
  const client = await getClient();
  const contacts: Contact[] = [];

  for await (const key of client.scanIterator({ MATCH: 'chat:*', COUNT: 100 })) {
    const contactId = key.replace(/^chat:/, '');
    const lastMessageId = await client.lIndex(key, 0);

    let contact: Partial<Contact> = { id: contactId, name: contactId.split('@')[0] };

    if (lastMessageId) {
      const messageHash = await client.hGetAll(`message:${lastMessageId}`);
      const lastMsg = parseRedisHash(messageHash);
      
      if (lastMsg) {
        contact = {
          ...contact,
          name: lastMsg.contactName || contact.name,
          lastMessage: lastMsg.texto || 'Mensagem sem texto.',
          timestamp: lastMsg.timestamp ? formatRelative(fromUnixTime(parseInt(lastMsg.timestamp, 10)), new Date(), { locale: ptBR }) : 'Data desconhecida',
          needsAttention: lastMsg.needsAttention || false,
        };
      }
    }

    contacts.push({
      id: contact.id!,
      name: contact.name!,
      avatar: `https://placehold.co/40x40.png`,
      lastMessage: contact.lastMessage || 'Nenhuma mensagem ainda.',
      timestamp: contact.timestamp || '',
      unreadCount: 0,
      needsAttention: contact.needsAttention || false,
    });
  }

  return contacts.sort((a, b) => {
    if (a.needsAttention && !b.needsAttention) return -1;
    if (!a.needsAttention && b.needsAttention) return 1;
    // Fallback sort, can be improved with real timestamps
    return b.id.localeCompare(a.id);
  });
}


export async function getMessages(contactId: string): Promise<Message[]> {
  try {
    const client = await getClient();
    const historyKey = `chat:${contactId.trim()}`;
    const messageIds = await client.lRange(historyKey, 0, -1);

    if (!messageIds || messageIds.length === 0) {
      return [];
    }

    const messagePromises = messageIds.map(async (id) => {
      const hash = await client.hGetAll(`message:${id}`);
      if (!hash || Object.keys(hash).length === 0) return null;

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
    });

    const settledMessages = await Promise.all(settledMessages);
    return settledMessages
      .filter((msg): msg is Message => msg !== null && msg !== undefined)
      .sort((a, b) => {
        // Simple time string comparison might not be perfect, but should work for HH:mm
        return a.timestamp.localeCompare(b.timestamp);
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
