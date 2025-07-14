'use server';

import { getClient } from '@/lib/redis';

export interface RedisStatus {
  connected: boolean;
  error: string | null;
  sampleKeys: string[];
  firstKeyContent: string | null;
}

// Helper function for timeout
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Promise timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (res) => {
        clearTimeout(timeoutId);
        resolve(res);
      },
      (err) => {
        clearTimeout(timeoutId);
        reject(err);
      }
    );
  });
}

async function performRedisCheck(): Promise<RedisStatus> {
    const status: RedisStatus = {
        connected: false,
        error: null,
        sampleKeys: [],
        firstKeyContent: null,
    };

    try {
        const client = await getClient();
        const pingResponse = await client.ping();
        if (pingResponse !== 'PONG') {
            throw new Error(`Redis PING command returned: ${pingResponse}`);
        }
        status.connected = true;

        const keys = [];
        for await (const key of client.scanIterator({ MATCH: 'chat:*', COUNT: 5 })) {
            keys.push(key);
        }
        status.sampleKeys = keys;

        if (keys.length > 0) {
            const rawContent = await client.lRange(keys[0], 0, -1);
            status.firstKeyContent = JSON.stringify(rawContent, null, 2);
        }
    } catch (e: any) {
        status.connected = false;
        status.error = e.message || 'Ocorreu um erro desconhecido durante a verificação do Redis.';
        console.error("Erro na verificação de status do Redis:", e);
    }
    return status;
}

export async function checkRedisConnection(): Promise<RedisStatus> {
    try {
        // Usa o Promise.race para competir a verificação do Redis com um timer de 10 segundos
        return await withTimeout(performRedisCheck(), 10000);
    } catch (error: any) {
        console.error("Redis connection check timed out or failed:", error);
        return {
            connected: false,
            error: "A verificação da conexão com o Redis demorou muito para responder (timeout de 10 segundos) ou falhou. Verifique as configurações de rede e a REDIS_URL.",
            sampleKeys: [],
            firstKeyContent: null,
        };
    }
}
