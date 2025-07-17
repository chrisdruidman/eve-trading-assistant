import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      userId: string;
      email?: string;
      roles?: string[];
    };
  }
}

export interface JWTPayload {
  userId: string;
  email?: string;
  roles?: string[];
  iat: number;
  exp: number;
}

async function authMiddleware(fastify: FastifyInstance) {
  // Authentication decorator for protected routes
  fastify.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({
          error: 'UNAUTHORIZED',
          message: 'Missing authorization header',
          code: 'AUTH_MISSING_HEADER',
        });
      }

      if (!authorization.startsWith('Bearer ')) {
        return reply.code(401).send({
          error: 'UNAUTHORIZED',
          message: 'Invalid authorization format. Expected: Bearer <token>',
          code: 'AUTH_INVALID_FORMAT',
        });
      }

      const token = authorization.replace('Bearer ', '');

      if (!token) {
        return reply.code(401).send({
          error: 'UNAUTHORIZED',
          message: 'Missing access token',
          code: 'AUTH_MISSING_TOKEN',
        });
      }

      // Validate JWT token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        fastify.log.error('JWT_SECRET environment variable not set');
        return reply.code(500).send({
          error: 'INTERNAL_SERVER_ERROR',
          message: 'Authentication service configuration error',
          code: 'AUTH_CONFIG_ERROR',
        });
      }

      let payload: JWTPayload;
      try {
        payload = jwt.verify(token, jwtSecret) as JWTPayload;
      } catch (jwtError) {
        if (jwtError instanceof jwt.TokenExpiredError) {
          return reply.code(401).send({
            error: 'UNAUTHORIZED',
            message: 'Access token has expired',
            code: 'AUTH_TOKEN_EXPIRED',
          });
        }

        if (jwtError instanceof jwt.JsonWebTokenError) {
          return reply.code(401).send({
            error: 'UNAUTHORIZED',
            message: 'Invalid access token',
            code: 'AUTH_TOKEN_INVALID',
          });
        }

        throw jwtError;
      }

      if (!payload.userId) {
        return reply.code(401).send({
          error: 'UNAUTHORIZED',
          message: 'Invalid token payload',
          code: 'AUTH_INVALID_PAYLOAD',
        });
      }

      // Add user info to request
      request.user = {
        userId: payload.userId,
        email: payload.email,
        roles: payload.roles || [],
      };
    } catch (error) {
      fastify.log.error('Authentication error:', error);
      return reply.code(500).send({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Authentication service error',
        code: 'AUTH_SERVICE_ERROR',
      });
    }
  });

  // Optional authentication decorator (doesn't fail if no token)
  fastify.decorate('optionalAuth', async function (request: FastifyRequest, _reply: FastifyReply) {
    try {
      const authorization = request.headers.authorization;

      if (authorization && authorization.startsWith('Bearer ')) {
        const token = authorization.replace('Bearer ', '');
        const jwtSecret = process.env.JWT_SECRET;

        if (token && jwtSecret) {
          try {
            const payload = jwt.verify(token, jwtSecret) as JWTPayload;

            if (payload.userId) {
              request.user = {
                userId: payload.userId,
                email: payload.email,
                roles: payload.roles || [],
              };
            }
          } catch {
            // Ignore errors for optional auth
          }
        }
      }
    } catch {
      // Ignore errors for optional auth
    }
  });

  // Role-based authorization decorator
  fastify.decorate('authorize', function (requiredRoles: string[] = []) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      // First authenticate
      await fastify.authenticate(request, reply);

      // Check roles if specified
      if (requiredRoles.length > 0) {
        // For now, we'll implement basic admin role checking
        // In the future, this can be extended with more granular roles
        const userRoles = request.user?.roles || [];

        const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

        if (!hasRequiredRole) {
          return reply.code(403).send({
            error: 'FORBIDDEN',
            message: `Access denied. Required roles: ${requiredRoles.join(', ')}`,
            code: 'INSUFFICIENT_ROLES',
          });
        }
      }
    };
  });

  // Middleware to check if user owns the resource
  fastify.decorate(
    'requireOwnership',
    async function (request: FastifyRequest, reply: FastifyReply) {
      await fastify.authenticate(request, reply);

      const userId = request.params?.userId || request.body?.userId;

      if (!userId) {
        return reply.code(400).send({
          error: 'BAD_REQUEST',
          message: 'User ID is required',
          code: 'MISSING_USER_ID',
        });
      }

      if (request.user?.userId !== userId) {
        return reply.code(403).send({
          error: 'FORBIDDEN',
          message: 'You can only access your own resources',
          code: 'INSUFFICIENT_PERMISSIONS',
        });
      }
    }
  );
}

export default fp(authMiddleware, {
  name: 'auth-middleware',
});
