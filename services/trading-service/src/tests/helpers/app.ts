import Fastify, { FastifyInstance } from 'fastify';
import { tradingRoutes } from '../../routes/tradingRoutes';

export async function build(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Disable logging in tests
  });

  // Register routes
  await app.register(tradingRoutes);

  return app;
}

export default build;
