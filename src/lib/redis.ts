
'use server';

import { createClient } from 'redis';
import type { Contact, Message, StoredMessage, User, StoredContact, GlobalSettings, MediaType, QuotedMessage, MessageStatus } from './data';
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

function parseJsonMessage(jsonString: string): Partial<StoredMessage> | null {
  try {
    if (!jsonString) return null;
    let parsed = JSON.parse(jsonString);
    
    // Compatibility for older message formats
    if (parsed.id && !parsed.messageId) {
        parsed.messageId = parsed.id;
    }
    if (parsed.message && !parsed.texto) {
       parsed.texto = parsed.message
    }
    if (parsed.mimeType && !parsed.mimetype) {
        parsed.mimetype = parsed.mimeType;
    }

    return parsed;

  } catch (error) {
    console.warn('Falha ao fazer parse da mensagem JSON:', jsonString, error);
    return null;
  }
}

function mapMessageTypeToMediaType(messageType?: string): MediaType | undefined {
    if (!messageType) return undefined;
    if (messageType.includes('imageMessage')) {
        return 'image';
    }
    if (messageType.includes('videoMessage')) {
        return 'video';
    }
    if (messageType.includes('audioMessage') || messageType.includes('audio/ogg')) {
        return 'audio';
    }
    if (messageType.includes('documentMessage')) {
        return 'document';
    }
    return undefined;
}


function getLastMessageText(msg: Partial<StoredMessage>): string {
  if (msg.quotedMessage) {
    return `↩️ ${msg.texto || msg.caption || ''}`
  }
  const mediaType = mapMessageTypeToMediaType(msg.messageType);
  
  if (mediaType) {
      if (mediaType === 'audio') {
          return '🎵 Mensagem de áudio';
      }
      const typeMap: Record<string, string> = {
        image: '📷 Imagem',
        video: '🎬 Vídeo',
        document: '📄 Documento',
      };
      const mediaText = typeMap[mediaType] || 'Arquivo de mídia';
      return msg.caption ? `${mediaText}: ${msg.caption}` : mediaText;
  }
  
  return msg.texto || 'Mensagem sem texto.';
}

const ATTENTION_PHRASES = [
  'tecnico humano',
  'acionar um tecnico',
  'falar com um atendente',
  'transferindo para um atendente',
  'ajuda humana'
];

function normalizeText(text: string): string {
    if (!text) return '';
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function shouldTriggerAttention(message: Partial<StoredMessage>): boolean {
    if (message.needsAttention === true) {
        return true;
    }
    const textToCheck = message.texto || '';
    if (message.tipo === 'bot' && textToCheck) {
        const normalizedText = normalizeText(textToCheck);
        return ATTENTION_PHRASES.some(phrase => normalizedText.includes(phrase));
    }
    return false;
}

export async function getContacts(): Promise<Contact[]> {
  const client = await getClient();
  const storedContacts = await getStoredContacts();
  const storedContactsMap = new Map(storedContacts.map(c => [c.id, c.name]));

  const activeContacts: (Contact & { rawTimestamp: number })[] = [];

  for await (const key of client.scanIterator({ MATCH: 'chat:*', COUNT: 100 })) {
    const contactId = key.replace(/^chat:/, '');
    const messageHistory = await client.lRange(key, 0, 10);

    if (!messageHistory || messageHistory.length === 0) continue;
    
    const dismissedKey = `attention-dismissed:${contactId}`;
    const isDismissed = await client.exists(dismissedKey);

    let hasAttentionFlag = false;
    if (!isDismissed) {
        for (const msgString of messageHistory) {
            const msg = parseJsonMessage(msgString);
            if (msg && shouldTriggerAttention(msg)) {
                hasAttentionFlag = true;
                break;
            }
        }
    }


    const lastMessageString = messageHistory[0];
    const lastMsg = parseJsonMessage(lastMessageString);
    if (!lastMsg) continue;

    let contactName: string | undefined;
    let contactPhotoUrl: string | undefined;

    for (const msgString of messageHistory) {
        const msg = parseJsonMessage(msgString);
        if (!msg) continue;
        if (!contactName && msg.contactName) {
            contactName = msg.contactName;
            if (msg.contactPhotoUrl) {
                contactPhotoUrl = msg.contactPhotoUrl;
            }
        }
        if (contactName) {
            break; 
        }
    }

    const existingStoredName = storedContactsMap.get(contactId);

    const finalContactName = contactName || existingStoredName || contactId.split('@')[0];
    const finalAvatar = contactPhotoUrl || `https://placehold.co/40x40.png`;

    const timestamp = lastMsg.timestamp ? parseInt(lastMsg.timestamp, 10) : 0;
    
    const contact: Partial<Contact> & { rawTimestamp: number } = {
      id: contactId,
      name: finalContactName,
      rawTimestamp: timestamp,
      timestamp: timestamp ? formatDistanceToNow(fromUnixTime(timestamp), { addSuffix: true, locale: ptBR }) : 'Data desconhecida',
      unreadCount: 0,
      needsAttention: hasAttentionFlag,
      lastMessage: getLastMessageText(lastMsg),
    };

    activeContacts.push(contact as Contact & { rawTimestamp: number });
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
    const messageStrings = await client.lRange(historyKey, 0, 49);

    if (!messageStrings || messageStrings.length === 0) {
      return [];
    }
    
    const storedMessages = messageStrings.map(parseJsonMessage).filter((msg): msg is Partial<StoredMessage> => msg !== null);
    
    const messagePromises = storedMessages.map(async (storedMsg, index) => {
        const timestampInMs = storedMsg.timestamp ? (parseInt(storedMsg.timestamp, 10) * 1000) : Date.now();
        const uniqueId = `${storedMsg.messageId || `msg_${timestampInMs}`}_${index}`;
        
        let sender: Message['sender'];
        let finalStatus: MessageStatus | undefined = storedMsg.status;

        if (storedMsg.fromMe === 'true' || storedMsg.tipo === 'operator' || storedMsg.tipo === 'bot') {
            sender = storedMsg.tipo === 'bot' ? 'bot' : 'operator';
            if (storedMsg.messageId) {
                const statusData = await client.hGet(`message:${storedMsg.messageId}`, 'status');
                if (statusData) {
                    finalStatus = statusData as MessageStatus;
                }
            }
        } else {
            sender = 'user';
        }
        
        let text: string | null = null;
        let finalMediaUrl: string | undefined = undefined;
        const mediaType = mapMessageTypeToMediaType(storedMsg.messageType || storedMsg.mimetype);
        
        if (mediaType && storedMsg.mediaUrl) {
            if (storedMsg.mediaUrl.startsWith('data:')) {
                finalMediaUrl = storedMsg.mediaUrl;
            } else if (storedMsg.mimetype) {
                finalMediaUrl = `data:${storedMsg.mimetype};base64,${storedMsg.mediaUrl}`;
            }
        }
        
        const mainText = storedMsg.caption || storedMsg.texto;
        if (mainText && mainText.trim() && mainText !== 'null') {
            text = mainText;
        }

        if (mediaType === 'audio') {
            text = null;
        }
        
        return {
          id: uniqueId,
          contactId: contactId,
          text: text,
          sender: sender,
          operatorName: storedMsg.operatorName,
          timestamp: timestampInMs,
          botAvatarUrl: sender === 'bot' ? '/logo.svg' : undefined,
          status: finalStatus,
          mediaUrl: finalMediaUrl,
          mediaType: mediaType,
          mimetype: storedMsg.mimetype,
          jpegThumbnail: storedMsg.jpegThumbnail,
          quotedMessage: storedMsg.quotedMessage
        };
    });

    const messages = await Promise.all(messagePromises);
    return messages.reverse();

  } catch (error) {
    console.error(`Falha ao buscar mensagens para ${contactId} do Redis:`, error);
    return [];
  }
}

export async function addMessage(
  contactId: string, 
  message: { 
    text?: string;
    mediaUrl?: string;
    mediaType?: MediaType;
    mimetype?: string;
    sender: 'operator'; 
    operatorName: string; 
    tempId: string; 
    quotedMessage?: QuotedMessage;
    fileName?: string;
  }
): Promise<void> {
    const client = await getClient();
    const historyKey = `chat:${contactId.trim()}`;
    const channelName = 'fila_envio_whatsapp';
    
    let instanceName = '';

    const lastMessageResult = await client.lRange(historyKey, 0, 0);
    if (lastMessageResult.length > 0) {
      const parsedMsg = parseJsonMessage(lastMessageResult[0]);
      if (parsedMsg && parsedMsg.instance) {
        instanceName = parsedMsg.instance;
      }
    }

    if (!instanceName) {
      const settings = await getGlobalSettings();
      if (settings && settings.defaultInstance) {
        instanceName = settings.defaultInstance;
      }
    }

    if (!instanceName) {
        const errorMsg = `Nenhuma instância pôde ser determinada para o contato ${contactId}. Verifique se uma instância padrão está definida nas Configurações Globais.`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }
    
    const messageObjectToStore: Partial<StoredMessage> = {
      id: message.tempId,
      messageId: message.tempId,
      texto: message.text,
      tipo: message.sender,
      timestamp: Math.floor(Date.now() / 1000).toString(),
      operatorName: message.operatorName,
      instance: instanceName,
      needsAttention: false,
      status: 'sent',
      quotedMessage: message.quotedMessage,
      mediaUrl: message.mediaUrl,
      mimetype: message.mimetype,
      messageType: message.mediaType === 'audio' ? 'audio/ogg' : (message.text ? 'conversation' : undefined),
    };
    
    const messageForQueue: any = {
      instance: instanceName,
      remoteJid: contactId.trim(),
      options: {
        messageId: message.tempId
      }
    };
    
    if (message.mediaUrl && message.mediaType) {
        const fileData = {
          url: message.mediaUrl,
          mimetype: message.mimetype
        }

        if (message.mediaType === 'image') {
            messageForQueue.image = fileData;
            if (message.text) messageForQueue.options.caption = `*${message.operatorName}*\n${message.text}`;
        } else if (message.mediaType === 'audio') {
            messageForQueue.audio = fileData;
        } else if (message.mediaType === 'document') {
            messageForQueue.document = fileData;
            if (message.text) messageForQueue.options.caption = `*${message.operatorName}*\n${message.text}`;
        }
    } else if (message.text) {
        messageForQueue.text = `*${message.operatorName}*\n${message.text}`;
        if (message.mimetype) {
            messageForQueue.options.mimetype = message.mimetype;
        }
    }
    
    if (message.quotedMessage) {
        messageForQueue.options.quoted = {
            key: {
                remoteJid: contactId.trim(),
                id: message.quotedMessage.id,
                fromMe: message.quotedMessage.sender !== 'user',
            },
            message: {
                conversation: message.quotedMessage.text
            }
        };
    }
    
    await client.lPush(historyKey, JSON.stringify(messageObjectToStore));
    
    if (messageForQueue.text || messageForQueue.image || messageForQueue.audio || messageForQueue.document) {
      await client.publish(channelName, JSON.stringify(messageForQueue));
      console.log(`Mensagem ${message.tempId} para ${contactId} (instância: ${instanceName}) publicada no canal ${channelName}.`);
    } else {
      console.log(`Mensagem ${message.tempId} para ${contactId} era apenas para armazenamento local e não foi publicada.`);
    }
}

export async function dismissAttention(contactId: string): Promise<void> {
  try {
    const client = await getClient();
    const key = `attention-dismissed:${contactId.trim()}`;
    const TWELVE_HOURS_IN_SECONDS = 12 * 60 * 60;
    
    await client.set(key, 'true', { EX: TWELVE_HOURS_IN_SECONDS });
    console.log(`Marcador de atenção para o contato ${contactId} foi definido e expirará em 12 horas.`);

  } catch (error) {
    console.error(`Falha ao definir o marcador de atenção para ${contactId}:`, error);
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
        return { defaultInstance: '' }; 
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

    
