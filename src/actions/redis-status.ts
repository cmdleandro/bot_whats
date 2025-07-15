'use server';

import { getClient } from '@/lib/redis';

export interface RedisStatus {
  connected: boolean;
  error: string | null;
  sampleKeys: string[];
}

// Helper function para timeout
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutError: Error): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(timeoutError);
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
    };

    let client;
    try {
        client = await getClient();
        
        const pingResponse = await client.ping();
        if (pingResponse !== 'PONG') {
            throw new Error(`Redis PING command returned an unexpected response: ${pingResponse}`);
        }
        status.connected = true;

        const keys = [];
        for await (const key of client.scanIterator({ MATCH: 'chat:*', COUNT: 5 })) {
            keys.push(key);
        }
        status.sampleKeys = keys;

    } catch (e: any) {
        status.connected = false;
        // Captura o erro específico para exibir na UI.
        status.error = e.message || 'An unknown error occurred during the Redis check.';
        console.error("Error in Redis status check:", e);
    }
    return status;
}

export async function checkRedisConnection(): Promise<RedisStatus> {
    try {
        // Envolve a verificação com um timeout para evitar que a aplicação fique travada.
        return await withTimeout(
            performRedisCheck(), 
            5000, // Timeout de 5 segundos
            new Error("The Redis connection check timed out after 5 seconds. This could be due to network latency or egress firewall rules on the hosting platform.")
        ); 
    } catch (error: any) {
        console.error("Redis connection check timed out or failed:", error);
        return {
            connected: false,
            // Exibe a mensagem de erro do timeout ou outra falha.
            error: error.message,
            sampleKeys: [],
        };
    }
}
