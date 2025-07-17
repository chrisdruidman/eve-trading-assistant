import { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/authController';

export async function authRoutes(fastify: FastifyInstance) {
  const authController = fastify.authController as AuthController;

  // Registration endpoint
  fastify.post(
    '/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password', 'username'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            username: { type: 'string', minLength: 3, maxLength: 30 },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      username: { type: 'string' },
                      createdAt: { type: 'string' },
                    },
                  },
                  tokens: {
                    type: 'object',
                    properties: {
                      accessToken: { type: 'string' },
                      refreshToken: { type: 'string' },
                      expiresAt: { type: 'string' },
                      tokenType: { type: 'string' },
                    },
                  },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    authController.register.bind(authController)
  );

  // Login endpoint
  fastify.post(
    '/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  accessToken: { type: 'string' },
                  refreshToken: { type: 'string' },
                  expiresAt: { type: 'string' },
                  tokenType: { type: 'string' },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    authController.login.bind(authController)
  );

  // Token refresh endpoint
  fastify.post(
    '/refresh',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    authController.refreshToken.bind(authController)
  );

  // Logout endpoint
  fastify.post(
    '/logout',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    authController.logout.bind(authController)
  );

  // Token validation endpoint
  fastify.get(
    '/validate',
    {
      preHandler: [fastify.authenticate],
    },
    authController.validateToken.bind(authController)
  );

  // Protected test endpoint
  fastify.get(
    '/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      reply.send({
        data: {
          userId: request.user?.userId,
        },
        message: 'User authenticated successfully',
      });
    }
  );
}
