import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { createClient, RedisClientType } from 'redis';
import fp from 'fastify-plugin';
import { CacheStrategy } from '../../../../shared/src/types';

declare module 'fastify' {
  interface FastifyInstance {
    redis: {
      client: RedisClientType;
      get: (key: string) => Promise<string | null>;
      set: (key: string, value: string, ttl?: number) => Promise<void>;
      del: (key: string) => Promise<void>;
      exists: (key: string) => Promise<boolean>;
      setWithStrategy: (key: string, value: string, strategy: CacheStrategy) => Promise<void>;
      getWithFreshness: (key: string) => Promise<{ value: string | null; isStale: boolean }>;
    };
  }
}

const setupRedis: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: retries => Math.min(retries * 50, 500),
    },
  });

  client.on('error', err => {
    fastify.log.error('Redis client error:', err);
  });

  client.on('connect', () => {
    fastify.log.info('Redis client connected');
  });

  client.on('ready', () => {
    fastify.log.info('Redis client ready');
  });

  await client.connect();

  // Add Redis methods to fastify instance
  fastify.decorate('redis', {
    client,

    get: async (key: string): Promise<string | null> => {
      try {
        return await client.get(key);
      } catch (err) {
        fastify.log.error({ key, error: err }, 'Redis GET failed');
        return null;
      }
    },

    set: async (key: string, value: string, ttl?: number): Promise<void> => {
      try {
        if (ttl) {
          await client.setEx(key, ttl, value);
        } else {
          await client.set(key, value);
        }
      } catch (err) {
        fastify.log.error({ key, error: err }, 'Redis SET failed');
        throw err;
      }
    },

    del: async (key: string): Promise<void> => {
      try {
        await client.del(key);
      } catch (err) {
        fastify.log.error({ key, error: err }, 'Redis DEL failed');
        throw err;
      }
    },

    exists: async (key: string): Promise<boolean> => {
      try {
        const result = await client.exists(key);
        return result === 1;
      } catch (err) {
        fastify.log.error({ key, error: err }, 'Redis EXISTS failed');
        return false;
      }
    },

    setWithStrategy: async (key: string, value: string, strategy: CacheStrategy): Promise<void> => {
      try {
        const metadata = {
          cachedAt: Date.now(),
          ttl: strategy.ttl,
          refreshThreshold: strategy.refreshThreshold,
          maxStaleTime: strategy.maxStaleTime,
        };

        const cacheData = {
          value,
          metadata,
        };

        await client.setEx(key, strategy.ttl, JSON.stringify(cacheData));
      } catch (err) {
        fastify.log.error({ key, error: err }, 'Redis setWithStrategy failed');
        throw err;
      }
    },

    getWithFreshness: async (key: string): Promise<{ value: string | null; isStale: boolean }> => {
      try {
        const cached = await client.get(key);
        if (!cached) {
          return { value: null, isStale: false };
        }

        const cacheData = JSON.parse(cached);
        const now = Date.now();
        const age = now - cacheData.metadata.cachedAt;
        const refreshThresholdMs =
          cacheData.metadata.ttl * 1000 * (cacheData.metadata.refreshThreshold / 100);

        const isStale = age > refreshThresholdMs;

        return {
          value: cacheData.value,
          isStale,
        };
      } catch (err) {
        fastify.log.error({ key, error: err }, 'Redis getWithFreshness failed');
        return { value: null, isStale: false };
      }
    },
  });

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing Redis connection');
    await client.quit();
  });
};

export { setupRedis };
export default fp(setupRedis);
