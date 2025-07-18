import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { registerRoutes } from './routes';

/**
 * AI Service Entry Point
 * Fastify server for AI provider orchestration service
 */
async function startServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  try {
    // Register security plugins
    await fastify.register(helmet, {
      contentSecurityPolicy: false,
    });

    await fastify.register(cors, {
      origin: process.env.CORS_ORIGIN || true,
      credentials: true,
    });

    // Register rate limiting
    await fastify.register(rateLimit, {
      max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
    });

    // Register routes
    await registerRoutes(fastify);

    // Error handler
    fastify.setErrorHandler((error, request, reply) => {
      fastify.log.error(error);

      // Handle specific error types
      if (error.statusCode === 429) {
        return reply.status(429).send({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
        });
      }

      if (error.validation) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.validation,
        });
      }

      // Generic error response
      return reply.status(error.statusCode || 500).send({
        error: error.code || 'INTERNAL_ERROR',
        message: error.message || 'An unexpected error occurred',
      });
    });

    // Start server
    const port = parseInt(process.env.PORT || '3003');
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });

    console.log(`🤖 AI Service started on http://${host}:${port}`);
    console.log(`📊 Health check: http://${host}:${port}/health`);
    console.log(`📖 Service info: http://${host}:${port}/info`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server
if (require.main === module) {
  startServer();
}

export { startServer };
