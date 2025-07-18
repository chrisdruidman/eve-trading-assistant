import Fastify, { FastifyInstance } from 'fastify';
import { registerRoutes } from '../../src/routes';

/**
 * Build Fastify app for testing
 */
export async function build(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Disable logging in tests
  });

  // Register routes
  await registerRoutes(app);

  return app;
}
