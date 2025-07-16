
'use server';

import { createClient } from 'redis';
import type { Contact, Message, StoredMessage, User } from './data';
import { initialUsers } from './data';
import { formatDistanceToNow, fromUnixTime } from 'date-fns';
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

function parseJsonMessage(jsonString: string): StoredMessage | null {
  try {
    if (!jsonString) return null;
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Erro ao fazer parse da mensagem JSON do Redis:', jsonString, error);
    return null;
  }
}

export async function getContacts(): Promise<Contact[]> {
  const client = await getClient();
  const contacts: Contact[] = [];

  for await (const key of client.scanIterator({ MATCH: 'chat:*', COUNT: 100 })) {
    const contactId = key.replace(/^chat:/, '');
    const lastMessageString = await client.lIndex(key, 0);

    let contact: Partial<Contact> = { 
        id: contactId, 
        name: contactId.split('@')[0], 
        avatar: `https://placehold.co/40x40.png` 
    };

    if (lastMessageString) {
      const lastMsg = parseJsonMessage(lastMessageString);
      
      if (lastMsg) {
        const timestamp = lastMsg.timestamp ? parseInt(lastMsg.timestamp, 10) : 0;
        contact = {
          ...contact,
          name: lastMsg.contactName || contact.name,
          lastMessage: lastMsg.texto || 'Mensagem sem texto.',
          timestamp: timestamp ? formatDistanceToNow(fromUnixTime(timestamp), { addSuffix: true, locale: ptBR }) : 'Data desconhecida',
          needsAttention: lastMsg.needsAttention || false,
          avatar: lastMsg.contactPhotoUrl || `https://placehold.co/40x40.png`,
        };
      }
    }

    contacts.push({
      id: contact.id!,
      name: contact.name!,
      avatar: contact.avatar!,
      lastMessage: contact.lastMessage || 'Nenhuma mensagem ainda.',
      timestamp: contact.timestamp || '',
      unreadCount: 0,
      needsAttention: contact.needsAttention || false,
    });
  }

  return contacts.sort((a, b) => {
    if (a.needsAttention && !b.needsAttention) return -1;
    if (!a.needsAttention && b.needsAttention) return 1;
    return b.id.localeCompare(a.id);
  });
}

export async function getMessages(contactId: string): Promise<Message[]> {
  try {
    const client = await getClient();
    const historyKey = `chat:${contactId.trim()}`;
    const messageStrings = await client.lRange(historyKey, 0, -1);

    if (!messageStrings || messageStrings.length === 0) {
      return [];
    }
    
    const messages = messageStrings
      .map((msgString, index) => {
        const storedMsg = parseJsonMessage(msgString);
        if (!storedMsg) return null;

        const timestamp = storedMsg.timestamp ? parseInt(storedMsg.timestamp, 10) * 1000 : Date.now();
        const sender: Message['sender'] = ['user', 'bot', 'operator'].includes(storedMsg.tipo) ? storedMsg.tipo : 'user';
        
        const uniqueId = storedMsg.id || storedMsg.messageId || `${timestamp}-${index}`;

        return {
          id: uniqueId,
          contactId: contactId,
          text: storedMsg.texto,
          sender: sender,
          operatorName: storedMsg.operatorName,
          timestamp: new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          botAvatarUrl: sender === 'bot' ? storedMsg.contactPhotoUrl : undefined,
          status: storedMsg.status,
        };
      })
      .filter((msg): msg is Message => msg !== null)
      .reverse();

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
    const firstMessageString = await client.lIndex(historyKey, 0);
    if (firstMessageString) {
        const parsedMsg = parseJsonMessage(firstMessageString);
        if (parsedMsg && parsedMsg.instance) {
            instanceName = parsedMsg.instance;
        }
    }
    
    const messageObject: StoredMessage = {
      id: message.tempId,
      texto: message.text,
      tipo: message.sender,
      timestamp: Math.floor(Date.now() / 1000).toString(),
      operatorName: message.operatorName,
      instance: instanceName,
      needsAttention: false,
      status: 'sent',
    };

    const messageForQueue = {
        instance: instanceName,
        remoteJid: contactId.trim(),
        text: `*${message.operatorName}*\n${message.text}`,
        messageId: message.tempId
    };

    const transaction = client.multi();
    transaction.lPush(historyKey, JSON.stringify(messageObject));
    transaction.publish(channelName, JSON.stringify(messageForQueue));
    
    await transaction.exec();
    
    console.log(`Mensagem ${message.tempId} para ${contactId} (String JSON) publicada no canal ${channelName}.`);

  } catch (error) {
    console.error(`Falha ao adicionar mensagem para ${contactId} no Redis:`, error);
    throw error;
  }
}

export async function dismissAttention(contactId: string): Promise<void> {
  try {
    const client = await getClient();
    const key = `chat:${contactId.trim()}`;
    const lastMessageString = await client.lIndex(key, 0); 

    if (!lastMessageString) return;
    
    const message = parseJsonMessage(lastMessageString);

    if (message && message.needsAttention) {
      const updatedMessage = { ...message, needsAttention: false };
      await client.lSet(key, 0, JSON.stringify(updatedMessage));
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

    