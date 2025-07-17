import Fastify from 'fastify';
import { AuthService } from './services/authService';
import { TokenService } from './services/tokenService';
import { SessionService } from './services/sessionService';
import { UserRepository } from './models/userRepository';
import { EveCharacterRepository } from './models/eveCharacterRepository';
import { EveEsiService } from './services/eveEsiService';
import { EveApiKeyService } from './services/eveApiKeyService';
import { ApiKeyNotificationService } from './services/apiKeyNotificationService';
import { AuthController } from './controllers/authController';
import { EveApiController } from './controllers/eveApiController';
import securityPlugin from './plugins/security';
import authPlugin from './plugins/auth';
import { authRoutes } from './routes/authRoutes';
import { eveApiRoutes } from './routes/eveApiRoutes';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

async function start() {
  try {
    // Initialize repositories
    const userRepository = new UserRepository();
    const eveCharacterRepository = new EveCharacterRepository();

    // Initialize services
    const tokenService = new TokenService();
    const sessionService = new SessionService();
    const authService = new AuthService(tokenService, userRepository, sessionService);
    const eveEsiService = new EveEsiService();
    const eveApiKeyService = new EveApiKeyService(eveCharacterRepository, eveEsiService);
    const apiKeyNotificationService = new ApiKeyNotificationService(
      eveApiKeyService,
      userRepository
    );

    // Initialize controllers
    const authController = new AuthController(authService);
    const eveApiController = new EveApiController(eveApiKeyService, apiKeyNotificationService);

    // Create simple DI container
    const diContainer = {
      resolve: (name: string) => {
        const services: Record<string, any> = {
          authController,
          eveApiController,
          tokenService,
          authService,
          eveApiKeyService,
          apiKeyNotificationService,
        };
        return services[name];
      },
    };

    // Register plugins
    await fastify.register(securityPlugin);
    await fastify.register(authPlugin, { tokenService });

    // Add DI container to fastify instance
    fastify.decorate('diContainer', diContainer);

    // Register routes
    await fastify.register(authRoutes, { prefix: '/auth' });
    await fastify.register(eveApiRoutes, { prefix: '/api/v1' });

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
