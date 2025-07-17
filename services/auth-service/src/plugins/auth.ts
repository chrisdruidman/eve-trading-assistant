import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { TokenService } from '../services/tokenService';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
    };
  }
}

export interface AuthPluginOptions {
  tokenService: TokenService;
}

async function authPlugin(fastify: FastifyInstance, options: AuthPluginOptions) {
  const { tokenService } = options;

  // Authentication decorator
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({
          error: 'Missing authorization header',
        });
      }

      if (!authorization.startsWith('Bearer ')) {
        return reply.code(401).send({
          error: 'Invalid authorization format',
        });
      }

      const token = authorization.replace('Bearer ', '');
      const payload = await tokenService.validateAccessToken(token);

      if (!payload) {
        return reply.code(401).send({
          error: 'Invalid or expired token',
        });
      }

      // Add user info to request
      request.user = {
        userId: payload.userId,
      };
    } catch (error) {
      return reply.code(401).send({
        error: 'Authentication failed',
      });
    }
  });

  // Optional authentication decorator (doesn't fail if no token)
  fastify.decorate('optionalAuth', async function (request: FastifyRequest, _reply: FastifyReply) {
    try {
      const authorization = request.headers.authorization;

      if (authorization && authorization.startsWith('Bearer ')) {
        const token = authorization.replace('Bearer ', '');
        const payload = await tokenService.validateAccessToken(token);

        if (payload) {
          request.user = {
            userId: payload.userId,
          };
        }
      }
    } catch {
      // Ignore errors for optional auth
    }
  });
}

export default fp(authPlugin, {
  name: 'auth-plugin',
});
