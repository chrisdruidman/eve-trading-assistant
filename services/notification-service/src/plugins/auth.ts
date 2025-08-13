import { FastifyPluginAsync } from 'fastify';
import jwt from 'jsonwebtoken';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      userId: string;
      email: string;
      role?: string;
    };
  }

  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}

export const authPlugin: FastifyPluginAsync = async fastify => {
  fastify.decorateRequest('user', null);

  // Authentication decorator for protected routes
  fastify.decorate('authenticate', async (request: any, reply: any) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, process.env['JWT_SECRET'] || 'dev-secret') as any;
      request.user = {
        id: decoded.userId || decoded.id,
        userId: decoded.userId || decoded.id,
        email: decoded.email,
        role: decoded.role || 'user',
      };
    } catch (error) {
      reply.code(401).send({ error: 'Invalid token' });
      return;
    }
  });
};
