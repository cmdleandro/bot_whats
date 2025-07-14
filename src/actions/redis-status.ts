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
        status.error = e.message || 'An unknown error occurred during the Redis check.';
        console.error("Error in Redis status check:", e);
    }
    return status;
}

export async function checkRedisConnection(): Promise<RedisStatus> {
    try {
        // Reduzido para 5 segundos para falhar mais rápido
        return await withTimeout(performRedisCheck(), 5000); 
    } catch (error: any) {
        console.error("Redis connection check timed out or failed:", error);
        return {
            connected: false,
            error: "The Redis connection check timed out after 5 seconds or failed. Please check your network/firewall settings and REDIS_URL.",
            sampleKeys: [],
            firstKeyContent: null,
        };
    }
}
