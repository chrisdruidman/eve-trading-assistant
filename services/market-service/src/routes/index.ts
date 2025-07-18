import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { marketDataRoutes } from './marketData';
import { healthRoutes } from './health';
import { cacheRoutes } from './cache';

export const setupRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Register route modules
  await fastify.register(marketDataRoutes, { prefix: '/market' });
  await fastify.register(healthRoutes, { prefix: '/health' });
  await fastify.register(cacheRoutes, { prefix: '/api/v1' });
};
