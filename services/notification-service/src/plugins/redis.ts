import { FastifyPluginAsync } from 'fastify';
import { createClient, RedisClientType } from 'redis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: RedisClientType;
  }
}

export const redisPlugin: FastifyPluginAsync = async fastify => {
  const client = createClient({
    url: process.env['REDIS_URL'] || 'redis://localhost:6379',
  });

  client.on('error', error => {
    fastify.log.error('Redis client error:', error);
  });

  client.on('connect', () => {
    fastify.log.info('Redis client connected');
  });

  await client.connect();

  fastify.decorate('redis', client);

  fastify.addHook('onClose', async () => {
    await client.quit();
  });
};
