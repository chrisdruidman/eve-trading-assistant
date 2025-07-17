import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { UserService } from './services/userService';
import { UserRepository } from './models/userRepository';
import { UserPreferencesRepository } from './models/userPreferencesRepository';
import { userRoutes } from './routes/userRoutes';
import { authMiddleware } from './plugins/authMiddleware';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

async function start() {
  try {
    // Register security plugins
    await fastify.register(helmet);
    await fastify.register(cors, {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
    });

    // Rate limiting
    await fastify.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
    });

    // Initialize repositories
    const userRepository = new UserRepository();
    const userPreferencesRepository = new UserPreferencesRepository();

    // Initialize services
    const userService = new UserService(userRepository, userPreferencesRepository);

    // Register auth middleware
    await fastify.register(authMiddleware);

    // Register routes
    await fastify.register(userRoutes, { userService });

    // Health check
    fastify.get('/health', async () => {
      return { status: 'ok', service: 'user-service', timestamp: new Date().toISOString() };
    });

    // Start server
    const port = parseInt(process.env.PORT || '3002', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`🚀 User service running on http://${host}:${port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down user service...');
  await fastify.close();
  process.exit(0);
});

start();
