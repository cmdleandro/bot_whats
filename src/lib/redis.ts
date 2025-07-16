
'use server';

import { createClient } from 'redis';
import type { Contact, Message, StoredMessage, User, StoredContact, GlobalSettings } from './data';
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
  const storedContactsMap = new Map(storedContacts.map(c => [c.id, c.name]));
  let hasNewContactsToSave = false;

  const activeContacts: (Contact & { rawTimestamp: number })[] = [];

  for await (const key of client.scanIterator({ MATCH: 'chat:*', COUNT: 100 })) {
    const contactId = key.replace(/^chat:/, '');
    const lastMessageString = await client.lIndex(key, 0);

    if (!lastMessageString) continue;

    const lastMsg = parseJsonMessage(lastMessageString);
    if (!lastMsg) continue;
    
    const contactNameFromMessage = lastMsg.contactName || contactId.split('@')[0];
    const existingStoredName = storedContactsMap.get(contactId);

    // Prioritize stored name, but update it if it's just the default number
    let finalContactName = existingStoredName || contactNameFromMessage;
    if (!existingStoredName && contactNameFromMessage) {
       const newContact: StoredContact = { id: contactId, name: contactNameFromMessage };
       storedContacts.push(newContact);
       storedContactsMap.set(contactId, contactNameFromMessage);
       hasNewContactsToSave = true;
    }

    const timestamp = lastMsg.timestamp ? parseInt(lastMsg.timestamp, 10) : 0;
    
    const contact: Partial<Contact> & { rawTimestamp: number } = {
      id: contactId,
      name: finalContactName,
      avatar: lastMsg.contactPhotoUrl || `https://placehold.co/40x40.png`,
      rawTimestamp: timestamp,
      lastMessage: lastMsg.texto || 'Mensagem sem texto.',
      timestamp: timestamp ? formatDistanceToNow(fromUnixTime(timestamp), { addSuffix: true, locale: ptBR }) : 'Data desconhecida',
      unreadCount: 0,
      needsAttention: lastMsg.needsAttention || false,
    };
    
    if (existingStoredName && existingStoredName !== finalContactName) {
        const existingStored = storedContacts.find(c => c.id === contactId);
        if (existingStored) {
            existingStored.name = finalContactName;
            hasNewContactsToSave = true;
        }
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
    
    let instanceName = '';
    
    // 1. Check for existing conversation to get instance
    const lastMessageResult = await client.lRange(historyKey, 0, 0);
    const lastMessageString = lastMessageResult[0];

    if (lastMessageString) {
      const parsedMsg = parseJsonMessage(lastMessageString);
      if (parsedMsg && parsedMsg.instance) {
        instanceName = parsedMsg.instance;
      }
    }
    
    // 2. If it's a new conversation, get instance from Global Settings
    if (!instanceName) {
      const settings = await getGlobalSettings();
      if (settings && settings.defaultInstance) {
        instanceName = settings.defaultInstance; 
      }
    }

    // 3. If no instance could be determined, fail loudly.
    if (!instanceName) {
        const errorMsg = `Nenhuma instância pôde ser determinada para o contato ${contactId}. Verifique se uma instância padrão está definida nas Configurações Globais.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }
    
    // 4. Create BOTH message objects using the determined instance name
    const messageObjectToStore: StoredMessage = {
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
      text: `*${message.operatorName}*\\n${message.text}`,
      options: {
        messageId: message.tempId
      }
    };
    
    // 5. Persist and publish
    await client.lPush(historyKey, JSON.stringify(messageObjectToStore));
    await client.publish(channelName, JSON.stringify(messageForQueue));
    
    console.log(`Mensagem ${message.tempId} para ${contactId} (instância: ${instanceName}) publicada no canal ${channelName}.`);

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

const GLOBAL_SETTINGS_KEY = 'chatview:settings';

export async function getGlobalSettings(): Promise<GlobalSettings> {
    try {
        const client = await getClient();
        const settingsJson = await client.get(GLOBAL_SETTINGS_KEY);
        if (settingsJson) {
            return JSON.parse(settingsJson);
        }
        return { defaultInstance: '' }; // Default empty state
    } catch (error) {
        console.error('Falha ao buscar configurações globais do Redis:', error);
        return { defaultInstance: '' };
    }
}

export async function saveGlobalSettings(settings: GlobalSettings): Promise<void> {
    try {
        const client = await getClient();
        await client.set(GLOBAL_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
        console.error('Falha ao salvar configurações globais no Redis:', error);
        throw error;
    }
}
