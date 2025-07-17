import Fastify from 'fastify';
import { AuthService } from './services/authService';
import { TokenService } from './services/tokenService';
import { SessionService } from './services/sessionService';
import { UserRepository } from './models/userRepository';
import { AuthController } from './controllers/authController';
import securityPlugin from './plugins/security';
import authPlugin from './plugins/auth';
import { authRoutes } from './routes/authRoutes';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

async function start() {
  try {
    // Initialize services
    const tokenService = new TokenService();
    const userRepository = new UserRepository();
    const sessionService = new SessionService();
    const authService = new AuthService(tokenService, userRepository, sessionService);
    const authController = new AuthController(authService);

    // Register plugins
    await fastify.register(securityPlugin);
    await fastify.register(authPlugin, { tokenService });

    // Add controller to fastify instance
    fastify.decorate('authController', authController);

    // Register routes
    await fastify.register(authRoutes, { prefix: '/auth' });

    // Health check endpoint
    fastify.get('/health', async () => {
      return { status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() };
    });

    // Error handler
    fastify.setErrorHandler((error, _request, reply) => {
      fastify.log.error(error);

      if (error.validation) {
        reply.status(400).send({
          error: 'Validation failed',
          details: error.validation,
        });
        return;
      }

      reply.status(500).send({
        error: 'Internal server error',
      });
    });

    // Start server
    const port = parseInt(process.env.PORT || '3001');
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`Auth service listening on ${host}:${port}`);
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await fastify.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await fastify.close();
  process.exit(0);
});

start();
