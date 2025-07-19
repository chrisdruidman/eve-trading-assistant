import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
    };
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

async function authPlugin(fastify: FastifyInstance) {
  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

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

      try {
        const payload = jwt.verify(token, jwtSecret) as any;

        if (!payload.userId) {
          return reply.code(401).send({
            error: 'Invalid token payload',
          });
        }

        // Add user info to request
        request.user = {
          id: payload.userId,
          email: payload.email || '',
        };
      } catch (jwtError) {
        return reply.code(401).send({
          error: 'Invalid or expired token',
        });
      }
    } catch (error) {
      fastify.log.error('Authentication error:', error);
      return reply.code(401).send({
        error: 'Authentication failed',
      });
    }
  });
}

export default fp(authPlugin, {
  name: 'auth-plugin',
});
