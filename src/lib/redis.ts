
'use server';

import { createClient } from 'redis';
import type { Contact, Message, StoredMessage, User, StoredContact } from './data';
import { initialUsers } from './data';
import { formatDistanceToNow, fromUnixTime } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getStoredContacts, saveStoredContacts } from '@/actions/contact-actions';

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
  const storedContacts = await getStoredContacts();
  const storedContactsMap = new Map(storedContacts.map(c => [c.id, c]));
  let hasNewContactsToSave = false;

  const activeContacts: (Contact & { rawTimestamp: number })[] = [];

  for await (const key of client.scanIterator({ MATCH: 'chat:*', COUNT: 100 })) {
    const contactId = key.replace(/^chat:/, '');
    const lastMessageString = await client.lIndex(key, 0);

    if (!lastMessageString) continue;

    const lastMsg = parseJsonMessage(lastMessageString);
    if (!lastMsg) continue;
    
    if (!storedContactsMap.has(contactId) && lastMsg.contactName) {
        const newContact: StoredContact = { id: contactId, name: lastMsg.contactName };
        storedContacts.push(newContact);
        storedContactsMap.set(contactId, newContact);
        hasNewContactsToSave = true;
    }
    
    const storedContactInfo = storedContactsMap.get(contactId);
    
    const timestamp = lastMsg.timestamp ? parseInt(lastMsg.timestamp, 10) : 0;
    
    const contact: Partial<Contact> & { rawTimestamp: number } = {
      id: contactId,
      name: storedContactInfo?.name || lastMsg.contactName || contactId.split('@')[0],
      avatar: lastMsg.contactPhotoUrl || `https://placehold.co/40x40.png`,
      rawTimestamp: timestamp,
      lastMessage: lastMsg.texto || 'Mensagem sem texto.',
      timestamp: timestamp ? formatDistanceToNow(fromUnixTime(timestamp), { addSuffix: true, locale: ptBR }) : 'Data desconhecida',
      unreadCount: 0,
      needsAttention: lastMsg.needsAttention || false,
    };
    
    if (storedContactInfo && lastMsg.contactName && storedContactInfo.name !== lastMsg.contactName) {
        storedContactInfo.name = lastMsg.contactName;
        hasNewContactsToSave = true;
    }

    activeContacts.push(contact as Contact & { rawTimestamp: number });
  }

  if (hasNewContactsToSave) {
      await saveStoredContacts(storedContacts);
  }

  return activeContacts.sort((a, b) => {
    if (a.needsAttention && !b.needsAttention) return -1;
    if (!a.needsAttention && b.needsAttention) return 1;
    return b.rawTimestamp - a.rawTimestamp;
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

        const timestampInMs = storedMsg.timestamp ? (parseInt(storedMsg.timestamp, 10) * 1000) : Date.now();
        const sender: Message['sender'] = ['user', 'bot', 'operator'].includes(storedMsg.tipo) ? storedMsg.tipo : 'user';
        
        const uniqueId = storedMsg.id || storedMsg.messageId || `${timestampInMs}-${index}`;

        return {
          id: uniqueId,
          contactId: contactId,
          text: storedMsg.texto,
          sender: sender,
          operatorName: storedMsg.operatorName,
          timestamp: timestampInMs,
          botAvatarUrl: sender === 'bot' ? '/logo.svg' : undefined,
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
        options: {
          messageId: message.tempId
        }
    };
    
    await client.lPush(historyKey, JSON.stringify(messageObject));
    // Publishes the payload directly as a JSON string
    await client.publish(channelName, JSON.stringify(messageForQueue));
    
    console.log(`Mensagem ${message.tempId} para ${contactId} publicada no formato JSON no canal ${channelName}.`);

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
