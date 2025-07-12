import { createClient } from 'redis';

// O cliente Redis será criado apenas uma vez e reutilizado.
let redisClient: ReturnType<typeof createClient> | null = null;

async function getClient() {
  if (!redisClient) {
    // A URL de conexão é pega das variáveis de ambiente.
    // Configure-a no seu ambiente de desenvolvimento (.env.local) e no Easypanel.
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error('A variável de ambiente REDIS_URL não está definida.');
    }
    
    const client = createClient({ url });

    client.on('error', (err) => console.error('Erro no Cliente Redis', err));

    await client.connect();
    redisClient = client;
  }
  return redisClient;
}

// Exemplo de como você pode buscar os contatos do Redis.
// Supondo que o n8n salvou os contatos como uma lista de JSONs na chave 'contacts'.
export async function getContactsFromRedis() {
  const client = await getClient();
  try {
    const contactsJson = await client.get('contacts');
    if (!contactsJson) {
      console.log('Nenhum contato encontrado no Redis.');
      return [];
    }
    return JSON.parse(contactsJson);
  } catch (error) {
    console.error("Falha ao buscar contatos do Redis:", error);
    return []; // Retorna um array vazio em caso de erro.
  }
}

// Você pode adicionar mais funções aqui para buscar mensagens de um contato específico, etc.
// Exemplo:
// export async function getMessagesFromRedis(contactId: string) { ... }
