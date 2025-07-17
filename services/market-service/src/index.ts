import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { setupDatabase } from './plugins/database';
import { setupRedis } from './plugins/redis';
import { setupRoutes } from './routes';
import { errorHandler } from './plugins/errorHandler';
import { DataRefreshScheduler } from './services/dataRefreshScheduler';

const fastify = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] || 'info',
    transport:
      process.env['NODE_ENV'] === 'development'
        ? {
            target: 'pino-pretty',
          }
        : undefined,
  },
}).withTypeProvider<TypeBoxTypeProvider>();

async function buildApp() {
  // Security plugins
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  await fastify.register(cors, {
    origin: process.env['ALLOWED_ORIGINS']?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) => ({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests',
      retryAfter: Math.round(context.ttl / 1000),
    }),
  });

  // Database and Redis connections
  await fastify.register(setupDatabase);
  await fastify.register(setupRedis);

  // Error handling
  fastify.setErrorHandler(errorHandler);

  // Routes
  await fastify.register(setupRoutes, { prefix: '/api/v1' });

  // Health check
  fastify.get('/health', async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'market-service',
  }));

  return fastify;
}

async function start() {
  try {
    const app = await buildApp();

    const port = parseInt(process.env['PORT'] || '3002', 10);
    const host = process.env['HOST'] || '0.0.0.0';

    await app.listen({ port, host });
    app.log.info(`Market service listening on ${host}:${port}`);

    // Start the data refresh scheduler
    const scheduler = new DataRefreshScheduler(app);
    const refreshIntervalMinutes = parseInt(process.env['REFRESH_INTERVAL_MINUTES'] || '5', 10);
    scheduler.start(refreshIntervalMinutes);

    // Graceful shutdown
    const shutdown = async () => {
      app.log.info('Shutting down gracefully...');
      scheduler.stop();
      await app.close();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    fastify.log.error('Error starting server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

export { buildApp };
