import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { routes } from './routes';
import { notificationPlugin } from './plugins/notification';
import { authPlugin } from './plugins/auth';
import { databasePlugin } from './plugins/database';
import { redisPlugin } from './plugins/redis';

const server = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] || 'info',
  },
});

async function start() {
  try {
    // Register security plugins
    await server.register(helmet);
    await server.register(cors, {
      origin: process.env['CORS_ORIGIN'] || 'http://localhost:3000',
      credentials: true,
    });

    // Register rate limiting
    await server.register(rateLimit, {
      max: 100,
      timeWindow: '1 minute',
    });

    // Register WebSocket support
    await server.register(websocket);

    // Register infrastructure plugins
    await server.register(databasePlugin);
    await server.register(redisPlugin);
    await server.register(authPlugin);
    await server.register(notificationPlugin);

    // Register routes
    await server.register(routes, { prefix: '/api/v1' });

    // Health check endpoint
    server.get('/health', async () => {
      return { status: 'ok', service: 'notification-service' };
    });

    const port = parseInt(process.env['PORT'] || '3004', 10);
    const host = process.env['HOST'] || '0.0.0.0';

    await server.listen({ port, host });
    console.log(`Notification service listening on ${host}:${port}`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  try {
    await server.close();
    console.log('Notification service shut down gracefully');
  } catch (error) {
    process.exit(1);
  }
});

start();
