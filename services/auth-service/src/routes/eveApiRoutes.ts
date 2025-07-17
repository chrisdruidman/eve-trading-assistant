import { FastifyInstance } from 'fastify';
import { EveApiController } from '../controllers/eveApiController';

export async function eveApiRoutes(fastify: FastifyInstance) {
  const eveApiController = fastify.diContainer.resolve('eveApiController') as EveApiController;

  // EVE Online OAuth and setup routes
  fastify.get(
    '/eve/auth-url',
    {
      schema: {
        description: 'Get EVE Online OAuth authorization URL',
        tags: ['EVE API'],
        querystring: {
          type: 'object',
          properties: {
            state: { type: 'string', description: 'CSRF protection state parameter' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  authUrl: { type: 'string' },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    eveApiController.getAuthUrl.bind(eveApiController)
  );

  fastify.get(
    '/eve/scopes',
    {
      schema: {
        description: 'Get recommended EVE Online API scopes',
        tags: ['EVE API'],
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'object',
                properties: {
                  scopes: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    eveApiController.getRecommendedScopes.bind(eveApiController)
  );

  // Character management routes (require authentication)
  fastify.register(async function (fastify) {
    // Add authentication hook for these routes
    fastify.addHook('preHandler', async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    });

    fastify.post(
      '/eve/characters',
      {
        schema: {
          description: 'Add a new EVE character with API key',
          tags: ['EVE Characters'],
          security: [{ bearerAuth: [] }],
          body: {
            type: 'object',
            required: ['accessToken'],
            properties: {
              accessToken: { type: 'string', description: 'EVE Online access token' },
              refreshToken: { type: 'string', description: 'EVE Online refresh token (optional)' },
            },
          },
          response: {
            201: {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    characterId: { type: 'number' },
                    characterName: { type: 'string' },
                    corporationId: { type: 'number' },
                    allianceId: { type: 'number' },
                    scopes: {
                      type: 'array',
                      items: { type: 'string' },
                    },
                    lastSync: { type: 'string', format: 'date-time' },
                  },
                },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      eveApiController.addApiKey.bind(eveApiController)
    );

    fastify.get(
      '/eve/characters',
      {
        schema: {
          description: 'Get all characters for the authenticated user',
          tags: ['EVE Characters'],
          security: [{ bearerAuth: [] }],
          response: {
            200: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      characterId: { type: 'number' },
                      characterName: { type: 'string' },
                      corporationId: { type: 'number' },
                      allianceId: { type: 'number' },
                      scopes: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                      lastSync: { type: 'string', format: 'date-time' },
                    },
                  },
                },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      eveApiController.getUserCharacters.bind(eveApiController)
    );

    fastify.post(
      '/eve/characters/:characterId/validate',
      {
        schema: {
          description: "Validate a character's API key",
          tags: ['EVE Characters'],
          security: [{ bearerAuth: [] }],
          params: {
            type: 'object',
            properties: {
              characterId: { type: 'string', pattern: '^[0-9]+$' },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    isValid: { type: 'boolean' },
                    character: {
                      type: 'object',
                      properties: {
                        characterId: { type: 'number' },
                        characterName: { type: 'string' },
                        corporationId: { type: 'number' },
                        allianceId: { type: 'number' },
                      },
                    },
                    error: { type: 'string' },
                  },
                },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      eveApiController.validateApiKey.bind(eveApiController)
    );

    fastify.post(
      '/eve/characters/:characterId/refresh',
      {
        schema: {
          description: 'Refresh character information from EVE Online',
          tags: ['EVE Characters'],
          security: [{ bearerAuth: [] }],
          params: {
            type: 'object',
            properties: {
              characterId: { type: 'string', pattern: '^[0-9]+$' },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    characterId: { type: 'number' },
                    characterName: { type: 'string' },
                    corporationId: { type: 'number' },
                    allianceId: { type: 'number' },
                    lastSync: { type: 'string', format: 'date-time' },
                  },
                },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      eveApiController.refreshCharacter.bind(eveApiController)
    );

    fastify.delete(
      '/eve/characters/:characterId',
      {
        schema: {
          description: 'Remove a character and its API key',
          tags: ['EVE Characters'],
          security: [{ bearerAuth: [] }],
          params: {
            type: 'object',
            properties: {
              characterId: { type: 'string', pattern: '^[0-9]+$' },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                message: { type: 'string' },
              },
            },
          },
        },
      },
      eveApiController.removeCharacter.bind(eveApiController)
    );

    fastify.get(
      '/eve/characters/:characterId/scopes',
      {
        schema: {
          description: 'Check if character has required scopes for trading',
          tags: ['EVE Characters'],
          security: [{ bearerAuth: [] }],
          params: {
            type: 'object',
            properties: {
              characterId: { type: 'string', pattern: '^[0-9]+$' },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    hasRequiredScopes: { type: 'boolean' },
                  },
                },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      eveApiController.checkScopes.bind(eveApiController)
    );
  });

  // Admin routes for monitoring and notifications
  fastify.register(async function (fastify) {
    // Add admin authentication hook
    fastify.addHook('preHandler', async (request, reply) => {
      try {
        await request.jwtVerify();
        // In a real implementation, check if user has admin role
        // const user = request.user;
        // if (!user.isAdmin) throw new Error('Admin access required');
      } catch (err) {
        reply.send(err);
      }
    });

    fastify.get(
      '/eve/admin/expiring-keys',
      {
        schema: {
          description: 'Get characters with expiring API keys (admin only)',
          tags: ['EVE Admin'],
          security: [{ bearerAuth: [] }],
          querystring: {
            type: 'object',
            properties: {
              days: {
                type: 'string',
                pattern: '^[0-9]+$',
                description: 'Days ahead to check (default: 7)',
              },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      characterId: { type: 'number' },
                      characterName: { type: 'string' },
                      corporationId: { type: 'number' },
                      lastSync: { type: 'string', format: 'date-time' },
                    },
                  },
                },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      eveApiController.getExpiringKeys.bind(eveApiController)
    );

    fastify.post(
      '/eve/admin/check-notifications',
      {
        schema: {
          description: 'Trigger notification check for expiring API keys (admin only)',
          tags: ['EVE Admin'],
          security: [{ bearerAuth: [] }],
          response: {
            200: {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    totalNotifications: { type: 'number' },
                    expiringSoon: { type: 'number' },
                    expired: { type: 'number' },
                    invalid: { type: 'number' },
                  },
                },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      eveApiController.checkNotifications.bind(eveApiController)
    );
  });
}
