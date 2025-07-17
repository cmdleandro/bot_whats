

'use server';

import { createClient } from 'redis';
import type { Contact, Message, StoredMessage, User, StoredContact, GlobalSettings, MediaType, QuotedMessage } from './data';
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

function extractValue(jsonString: string, key: string): string | null {
    const regex = new RegExp(`"${key}"\\s*:\\s*(?:"([^"]*)"|([^",}]+))`);
    const match = jsonString.match(regex);
    if (match) {
        const value = match[1] || match[2];
        return value ? value.trim().replace(/\\"/g, '"') : null;
    }
    return null;
}


function parseJsonMessage(jsonString: string): Partial<StoredMessage> | null {
  try {
    if (!jsonString) return null;
    // Prioriza o parse nativo que é mais rápido e confiável
    const parsed = JSON.parse(jsonString);
    // Garante que o messageId do webhook seja mantido
    if (parsed.id && !parsed.messageId) {
        parsed.messageId = parsed.id;
    }
    return parsed;

  } catch (error) {
    console.warn('Falha ao fazer parse da mensagem JSON. Tentando recuperação manual:', jsonString);
    try {
        const recovered: Partial<StoredMessage> = {
            messageId: extractValue(jsonString, 'messageId') || extractValue(jsonString, 'id'), // Prioriza messageId
            mediaUrl: extractValue(jsonString, 'mediaUrl'),
            caption: extractValue(jsonString, 'caption'),
            messageType: extractValue(jsonString, 'messageType'),
            texto: extractValue(jsonString, 'caption') || extractValue(jsonString, 'texto') || '',
            timestamp: extractValue(jsonString, 'timestamp') || Math.floor(Date.now() / 1000).toString(),
            contactName: extractValue(jsonString, 'contactName'),
            contactPhotoUrl: extractValue(jsonString, 'contactPhotoUrl'),
            fromMe: extractValue(jsonString, 'fromMe') || 'false',
            instance: extractValue(jsonString, 'instance'),
            needsAttention: extractValue(jsonString, 'needsAttention') === 'true',
            status: 'sent',
            jpegThumbnail: extractValue(jsonString, 'jpegThumbnail'),
        };
        
        let tipoExtracted = extractValue(jsonString, 'tipo');
        if (tipoExtracted && ['user', 'bot', 'operator'].includes(tipoExtracted)) {
            recovered.tipo = tipoExtracted as 'user' | 'bot' | 'operator';
        } else {
             recovered.tipo = (recovered.fromMe === 'true') ? 'operator' : 'user';
        }
        
        recovered.quotedMessage = undefined;
        recovered.id = recovered.id || recovered.messageId;


        if (recovered.texto || recovered.mediaUrl) {
            console.log('Mensagem recuperada manualmente:', recovered);
            return recovered;
        }
    } catch (recoveryError) {
        console.error('Falha na recuperação manual:', recoveryError);
    }
    return null;
  }
}

function mapMessageTypeToMediaType(messageType?: string): MediaType | undefined {
    if (!messageType) return undefined;
    if (messageType.includes('image')) return 'image';
    if (messageType.includes('video')) return 'video';
    if (messageType.includes('audio')) return 'audio';
    if (messageType.includes('document')) return 'document';
    return undefined;
}

function getLastMessageText(msg: Partial<StoredMessage>): string {
  if (msg.quotedMessage) {
    return `↩️ ${msg.texto}`
  }
  const mediaType = mapMessageTypeToMediaType(msg.messageType);
  
  if (mediaType || msg.jpegThumbnail) {
    const typeMap: Record<MediaType, string> = {
      image: '📷 Imagem',
      video: '🎬 Vídeo',
      audio: '🎵 Áudio',
      document: '📄 Documento',
    };
    const mediaText = typeMap[mediaType || 'image'] || 'Arquivo de mídia';
    return msg.caption ? `${mediaText}: ${msg.caption}` : mediaText;
  }
  
  return msg.texto || 'Mensagem sem texto.';
}

const ATTENTION_PHRASES = [
  'técnico humano',
  'acionar um técnico',
  'falar com um atendente',
  'transferindo para um atendente',
  'ajuda humana'
];

function shouldTriggerAttention(message: Partial<StoredMessage>): boolean {
    if (message.needsAttention) {
        return true;
    }
    if (message.tipo === 'bot' && message.texto) {
        const lowerCaseText = message.texto.toLowerCase();
        return ATTENTION_PHRASES.some(phrase => lowerCaseText.includes(phrase));
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

    const lastMessageString = messageHistory[0];
    const lastMsg = parseJsonMessage(lastMessageString);
    if (!lastMsg) continue;

    let contactName: string | undefined;
    let contactPhotoUrl: string | undefined;
    let hasAttentionFlag = false;

    for (const msgString of messageHistory) {
        const msg = parseJsonMessage(msgString);
        if (!msg) continue;

        if (!contactName && msg.contactName) {
            contactName = msg.contactName;
            if (msg.contactPhotoUrl) {
                contactPhotoUrl = msg.contactPhotoUrl;
            }
        }
        
        if (shouldTriggerAttention(msg)) {
            hasAttentionFlag = true;
        }

        if (contactName && hasAttentionFlag) {
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
      avatar: finalAvatar,
      rawTimestamp: timestamp,
      lastMessage: getLastMessageText(lastMsg),
      timestamp: timestamp ? formatDistanceToNow(fromUnixTime(timestamp), { addSuffix: true, locale: ptBR }) : 'Data desconhecida',
      unreadCount: 0,
      needsAttention: hasAttentionFlag,
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
    const messageStrings = await client.lRange(historyKey, 0, -1);

    if (!messageStrings || messageStrings.length === 0) {
      return [];
    }
    
    const messages = messageStrings
      .map((msgString, index) => {
        const storedMsg = parseJsonMessage(msgString);
        if (!storedMsg) return null;

        const timestampInMs = storedMsg.timestamp ? (parseInt(storedMsg.timestamp, 10) * 1000) : Date.now();
        
        let sender: Message['sender'];
        
        if (storedMsg.fromMe === 'true' || storedMsg.tipo === 'operator') {
          sender = 'operator';
        } else if (storedMsg.tipo === 'bot') {
            sender = 'bot';
        } else {
            sender = 'user';
        }
        
        // **A CORREÇÃO PRINCIPAL**
        // Prioriza o 'messageId' do webhook. Usa o 'id' legado ou um gerado como fallback.
        const uniqueId = storedMsg.messageId || storedMsg.id || `${timestampInMs}-${index}`;

        return {
          id: uniqueId,
          contactId: contactId,
          text: storedMsg.caption || storedMsg.texto || '',
          sender: sender,
          operatorName: storedMsg.operatorName,
          timestamp: timestampInMs,
          botAvatarUrl: sender === 'bot' ? '/logo.svg' : undefined,
          status: storedMsg.status,
          mediaUrl: storedMsg.mediaUrl,
          mediaType: mapMessageTypeToMediaType(storedMsg.messageType),
          jpegThumbnail: storedMsg.jpegThumbnail,
          quotedMessage: storedMsg.quotedMessage
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

export async function addMessage(contactId: string, message: { text: string; sender: 'operator', operatorName: string, tempId: string, quotedMessage?: QuotedMessage }): Promise<void> {
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
    
    const messageObjectToStore: StoredMessage = {
      id: message.tempId,
      messageId: message.tempId, // Mantém consistência
      texto: message.text,
      tipo: message.sender,
      timestamp: Math.floor(Date.now() / 1000).toString(),
      operatorName: message.operatorName,
      instance: instanceName,
      needsAttention: false,
      status: 'sent',
      quotedMessage: message.quotedMessage
    };
    
    const messageForQueue: any = {
      instance: instanceName,
      remoteJid: contactId.trim(),
      text: `*${message.operatorName}*\n${message.text}`,
      options: {
        messageId: message.tempId
      }
    };
    
    if (message.quotedMessage) {
        messageForQueue.options.quoted = {
            key: {
                remoteJid: contactId.trim(),
                id: message.quotedMessage.id, // O ID REAL da mensagem a ser respondida
                fromMe: message.quotedMessage.sender !== 'user',
            },
            message: {
                conversation: message.quotedMessage.text
            }
        };
    }
    
    await client.lPush(historyKey, JSON.stringify(messageObjectToStore));
    await client.publish(channelName, JSON.stringify(messageForQueue));
    
    console.log(`Mensagem ${message.tempId} para ${contactId} (instância: ${instanceName}) publicada no canal ${channelName}.`);
}

export async function dismissAttention(contactId: string): Promise<void> {
  try {
    const client = await getClient();
    const key = `chat:${contactId.trim()}`;
    
    const messageStrings = await client.lRange(key, 0, -1);
    let updated = false;

    for (let i = 0; i < messageStrings.length; i++) {
        const msgString = messageStrings[i];
        const message = parseJsonMessage(msgString);

        if (message && shouldTriggerAttention(message)) {
            const updatedMessage = { ...message, needsAttention: false };
            await client.lSet(key, i, JSON.stringify(updatedMessage));
            updated = true;
        }
    }

    if (updated) {
        console.log(`Alarme para o contato ${contactId} foi desativado em todas as mensagens relevantes.`);
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
