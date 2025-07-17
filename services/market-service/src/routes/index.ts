import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { marketDataRoutes } from './marketData';
import { healthRoutes } from './health';

export const setupRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Register route modules
  await fastify.register(marketDataRoutes, { prefix: '/market' });
  await fastify.register(healthRoutes, { prefix: '/health' });
};
