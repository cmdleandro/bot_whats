
'use server';

import { createClient } from 'redis';
import type { Contact, RedisMessage, Message, User } from './data';
import { initialUsers } from './data';
import { formatRelative, fromUnixTime } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
    
    // Tenta fazer um segundo parse se o texto ainda for uma string JSON.
    if (typeof parsed.texto === 'string' && parsed.texto.startsWith('"') && parsed.texto.endsWith('"')) {
        try {
            parsed.texto = JSON.parse(parsed.texto);
        } catch (e) {
            // se o segundo parse falhar, mantem o texto como esta
        }
    }
    
    return {
      texto: parsed.texto || '',
      tipo: parsed.tipo || 'user',
      timestamp: parsed.timestamp || Math.floor(Date.now() / 1000).toString(),
      contactName: parsed.contactName,
      operatorName: parsed.operatorName,
      contactPhotoUrl: parsed.contactPhotoUrl,
      instance: parsed.instance
    };
  } catch (e) {
    // Se o parse inicial falhar, retorna a string como texto de um usuário.
    return { 
        texto: cleanedString, 
        tipo: 'user', 
        timestamp: Math.floor(Date.now() / 1000).toString() 
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
    const contactKeys = [];
    for await (const key of client.scanIterator({ MATCH: 'chat:*', COUNT: 100 })) {
      contactKeys.push(key);
    }

    if (contactKeys.length === 0) {
      return [];
    }
    
    const contacts: Contact[] = await Promise.all(
      contactKeys.map(async (key) => {
        const contactId = key.replace(/^chat:/, '').trim();
        const allMessagesJson = await client.lRange(key, 0, -1);
        
        let lastMessageText = 'Nenhuma mensagem ainda.';
        let timestamp = Date.now();
        let contactName = contactId.split('@')[0];
        let avatar = `https://placehold.co/40x40.png`;
        let needsAttention = false;

        if (allMessagesJson.length > 0) {
            const lastMsg = parseRedisMessage(allMessagesJson[0]); // Pega a mais recente
            lastMessageText = lastMsg.texto;
            timestamp = lastMsg.timestamp ? parseInt(lastMsg.timestamp, 10) * 1000 : Date.now();
            
            // Verifica se a última mensagem é do BOT e contém a palavra-chave de transferência.
            if (lastMsg.tipo === 'bot') {
                needsAttention = checkNeedsAttention(lastMsg.texto);
            }
        }
        
        for (const msgJson of allMessagesJson) {
            const msg = parseRedisMessage(msgJson);
            if (msg.tipo === 'user' && msg.contactName) contactName = msg.contactName;
            if (msg.tipo === 'user' && msg.contactPhotoUrl) avatar = msg.contactPhotoUrl;
            if (contactName !== contactId.split('@')[0] && avatar !== `https://placehold.co/40x40.png`) break;
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
        const dateB = new Date(b.timestamp.startsWith('hoje') || b.timestamp.startsWith('ontem') ? new Date() : b.timestamp);
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
    const key = `chat:${contactId.trim()}`;
    const messagesJson = await client.lRange(key, 0, -1);

    if (!messagesJson || messagesJson.length === 0) {
      return [];
    }
    
    messagesJson.reverse();

    return messagesJson.map((jsonString, index) => {
      const redisMsg = parseRedisMessage(jsonString);
      const timestamp = redisMsg.timestamp ? parseInt(redisMsg.timestamp, 10) * 1000 : Date.now();
      
      const sender: Message['sender'] = ['user', 'bot', 'operator'].includes(redisMsg.tipo) ? redisMsg.tipo : 'user';

      return {
        id: `m-${contactId}-${index}`,
        contactId: contactId,
        text: redisMsg.texto,
        sender: sender,
        operatorName: redisMsg.operatorName,
        timestamp: new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        botAvatarUrl: sender === 'bot' ? redisMsg.contactPhotoUrl : undefined,
      };
    });

  } catch (error) {
    console.error(`Falha ao buscar mensagens para ${contactId} do Redis:`, error);
    return [];
  }
}

export async function addMessage(contactId: string, message: { text: string; sender: 'operator', operatorName: string }): Promise<void> {
  try {
    const client = await getClient();
    const historyKey = `chat:${contactId.trim()}`;
    const channelName = 'fila_envio_whatsapp';
    
    // 1. Busca o nome da instância no histórico de mensagens
    let instanceName = 'default'; // Fallback
    const recentMessages = await client.lRange(historyKey, 0, 10); // Procura nas últimas 10 mensagens
    for (const msgJson of recentMessages) {
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
    
    const redisMessageForHistory: RedisMessage = {
      texto: message.text,
      tipo: message.sender,
      timestamp: Math.floor(Date.now() / 1000).toString(),
      operatorName: message.operatorName,
      instance: instanceName
    };

    // Formata a mensagem para o WhatsApp com nome do operador em negrito
    const formattedText = `*${message.operatorName}*\n${message.text}`;
    
    const messageForQueue = {
        instance: instanceName,
        remoteJid: contactId.trim(),
        text: formattedText,
    };

    // 2. Salva a mensagem no histórico do chat
    await client.lPush(historyKey, JSON.stringify(redisMessageForHistory));
    
    // 3. Publica a mensagem no canal para o n8n ouvir
    await client.publish(channelName, JSON.stringify(messageForQueue));
    
    console.log(`Mensagem para ${contactId} com instância ${instanceName} publicada no canal ${channelName}.`);

  } catch (error) {
    console.error(`Falha ao adicionar mensagem para ${contactId} no Redis:`, error);
    throw error;
  }
}


// User Management Functions
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
        return initialUsers; // Fallback para dados iniciais em caso de erro
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
