
'use server';

import { createClient } from 'redis';
import type { Contact, RedisMessage, Message, User, StoredContact } from './data';
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


function parseRedisMessage(jsonString: string): RedisMessage {
  const cleanedString = jsonString.trim();
  try {
    const parsed = JSON.parse(cleanedString);
    
    if (typeof parsed.texto === 'string' && parsed.texto.startsWith('"') && parsed.texto.endsWith('"')) {
        try {
            parsed.texto = JSON.parse(parsed.texto);
        } catch (e) {
            // se o segundo parse falhar, mantem o texto como esta
        }
    }
    
    const needsAttention = parsed.tipo === 'bot' && checkNeedsAttention(parsed.texto || '');

    return {
      id: parsed.id || `temp-${Date.now()}`,
      texto: parsed.texto || '',
      tipo: parsed.tipo || 'user',
      timestamp: parsed.timestamp || Math.floor(Date.now() / 1000).toString(),
      contactName: parsed.contactName,
      operatorName: parsed.operatorName,
      contactPhotoUrl: parsed.contactPhotoUrl,
      instance: parsed.instance,
      needsAttention: parsed.needsAttention === true || needsAttention,
      status: parsed.status,
    };
  } catch (e) {
    return { 
        id: `temp-err-${Date.now()}`,
        texto: cleanedString, 
        tipo: 'user', 
        timestamp: Math.floor(Date.now() / 1000).toString(),
        needsAttention: false,
    };
  }
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
        const lastMessageId = await client.lIndex(key, 0);
        
        let lastMessageText = 'Nenhuma mensagem ainda.';
        let timestamp = Date.now();
        let needsAttention = false;
        
        if(lastMessageId) {
            const lastMessageJson = await client.get(`message:${lastMessageId}`);
            if (lastMessageJson) {
                const lastMsg = parseRedisMessage(lastMessageJson);
                lastMessageText = lastMsg.texto;
                timestamp = lastMsg.timestamp ? parseInt(lastMsg.timestamp, 10) * 1000 : Date.now();
                needsAttention = lastMsg.needsAttention === true;
            }
        }
        
        let contactName = storedContactsMap.get(contactId) || contactId.split('@')[0];
        let avatar = `https://placehold.co/40x40.png`;

        if (!storedContactsMap.has(contactId)) {
            const messageIds = await client.lRange(key, 0, 5); // check last 5 messages for info
            if(messageIds.length > 0) {
                 const messagesJson = await client.mGet(messageIds.map(id => `message:${id}`));
                 for(const msgJson of messagesJson) {
                     if(msgJson) {
                         const msg = parseRedisMessage(msgJson);
                         if (msg.tipo === 'user') {
                            if (msg.contactName) contactName = msg.contactName;
                            if (msg.contactPhotoUrl) avatar = msg.contactPhotoUrl;
                            if (contactName !== contactId.split('@')[0] && avatar !== `https://placehold.co/40x40.png`) break;
                         }
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
        const dateA = new Date(a.timestamp.startsWith('hoje') || a.timestamp.startsWith('ontem') ? new Date() : a.timestamp);
        const dateB = new Date(b.timestamp.startsWith('hoje') || b.timestamp.startsWith('ontem') ? new Date() : a.timestamp);
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
    const historyKey = `chat:${contactId.trim()}`;
    const messageIds = await client.lRange(historyKey, 0, -1);

    if (!messageIds || messageIds.length === 0) {
      return [];
    }
    
    const messagesJson = await client.mGet(messageIds.map(id => `message:${id}`));

    const messages = messagesJson
      .filter((jsonString): jsonString is string => jsonString !== null)
      .map((jsonString) => {
        const redisMsg = parseRedisMessage(jsonString);
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
        const recentMessagesJson = await client.mGet(recentMessageIds.map(id => `message:${id}`));
        for (const msgJson of recentMessagesJson) {
            if (msgJson) {
                try {
                    const parsedMsg = parseRedisMessage(msgJson);
                    if (parsedMsg.instance) {
                        instanceName = parsedMsg.instance;
                        break;
                    }
                } catch (e) {
                    console.warn("Could not parse message from history:", msgJson);
                }
            }
        }
    }
    
    // The temporary ID sent from the frontend will be used to create the message object
    const redisMessageForHistory: RedisMessage = {
      id: message.tempId, // Use the temporary ID from the frontend
      texto: message.text,
      tipo: message.sender,
      timestamp: Math.floor(Date.now() / 1000).toString(),
      operatorName: message.operatorName,
      instance: instanceName,
      needsAttention: false, 
      status: 'sent',
    };
    
    const messageKey = `message:${message.tempId}`;
    const messageForQueue = {
        instance: instanceName,
        remoteJid: contactId.trim(),
        text: `*${message.operatorName}*\n${message.text}`,
        messageId: message.tempId // Pass tempId so n8n can use it
    };

    // Use a transaction to ensure both operations succeed
    const transaction = client.multi();
    transaction.set(messageKey, JSON.stringify(redisMessageForHistory));
    transaction.lPush(historyKey, message.tempId);
    transaction.publish(channelName, JSON.stringify(messageForQueue));
    
    await transaction.exec();
    
    console.log(`Mensagem ${message.tempId} para ${contactId} com instância ${instanceName} publicada no canal ${channelName}.`);

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
    const lastMessageJson = await client.get(messageKey);

    if (!lastMessageJson) return;

    let lastMessage: RedisMessage = parseRedisMessage(lastMessageJson);
    
    if (lastMessage.needsAttention) {
      const updatedMessage = { ...lastMessage, needsAttention: false };
      await client.set(messageKey, JSON.stringify(updatedMessage));
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

