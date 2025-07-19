import { FastifyInstance } from 'fastify';
import { WatchlistController } from '../controllers/watchlistController';

export async function watchlistRoutes(fastify: FastifyInstance) {
  const watchlistController = fastify.watchlistController as WatchlistController;

  // Watchlist management routes
  fastify.post(
    '/watchlists',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  name: { type: 'string' },
                  items: { type: 'array' },
                  alerts: { type: 'array' },
                },
              },
            },
          },
        },
      },
    },
    watchlistController.createWatchlist.bind(watchlistController)
  );

  fastify.get(
    '/watchlists',
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    userId: { type: 'string' },
                    name: { type: 'string' },
                    items: { type: 'array' },
                    alerts: { type: 'array' },
                  },
                },
              },
            },
          },
        },
      },
    },
    watchlistController.getUserWatchlists.bind(watchlistController)
  );

  fastify.get(
    '/watchlists/:watchlistId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['watchlistId'],
          properties: {
            watchlistId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    watchlistController.getWatchlist.bind(watchlistController)
  );

  fastify.delete(
    '/watchlists/:watchlistId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['watchlistId'],
          properties: {
            watchlistId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    watchlistController.deleteWatchlist.bind(watchlistController)
  );

  // Watchlist items routes
  fastify.post(
    '/watchlists/:watchlistId/items',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['watchlistId'],
          properties: {
            watchlistId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['typeId', 'regionId'],
          properties: {
            typeId: { type: 'integer', minimum: 1 },
            regionId: { type: 'integer', minimum: 1 },
            targetBuyPrice: { type: 'number', minimum: 0 },
            targetSellPrice: { type: 'number', minimum: 0 },
          },
        },
      },
    },
    watchlistController.addItemToWatchlist.bind(watchlistController)
  );

  fastify.delete(
    '/watchlists/:watchlistId/items/:typeId/:regionId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['watchlistId', 'typeId', 'regionId'],
          properties: {
            watchlistId: { type: 'string', format: 'uuid' },
            typeId: { type: 'string', pattern: '^[0-9]+$' },
            regionId: { type: 'string', pattern: '^[0-9]+$' },
          },
        },
      },
    },
    watchlistController.removeItemFromWatchlist.bind(watchlistController)
  );

  // Alert rules routes
  fastify.post(
    '/watchlists/:watchlistId/alerts',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['watchlistId'],
          properties: {
            watchlistId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['typeId', 'regionId', 'condition', 'threshold'],
          properties: {
            typeId: { type: 'integer', minimum: 1 },
            regionId: { type: 'integer', minimum: 1 },
            condition: {
              type: 'string',
              enum: ['PRICE_ABOVE', 'PRICE_BELOW', 'VOLUME_ABOVE', 'VOLUME_BELOW'],
            },
            threshold: { type: 'number', minimum: 0 },
            isActive: { type: 'boolean', default: true },
          },
        },
      },
    },
    watchlistController.createAlertRule.bind(watchlistController)
  );

  fastify.put(
    '/alerts/:ruleId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['ruleId'],
          properties: {
            ruleId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            threshold: { type: 'number', minimum: 0 },
            isActive: { type: 'boolean' },
          },
        },
      },
    },
    watchlistController.updateAlertRule.bind(watchlistController)
  );

  fastify.delete(
    '/alerts/:ruleId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['ruleId'],
          properties: {
            ruleId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    watchlistController.deleteAlertRule.bind(watchlistController)
  );

  // User alerts routes
  fastify.get(
    '/alerts',
    {
      preHandler: [fastify.authenticate],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'string', pattern: '^[0-9]+$' },
          },
        },
      },
    },
    watchlistController.getUserAlerts.bind(watchlistController)
  );

  fastify.put(
    '/alerts/:alertId/acknowledge',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['alertId'],
          properties: {
            alertId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    watchlistController.acknowledgeAlert.bind(watchlistController)
  );

  // Performance and analysis routes
  fastify.get(
    '/watchlists/:watchlistId/performance',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['watchlistId'],
          properties: {
            watchlistId: { type: 'string', format: 'uuid' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'string', pattern: '^[0-9]+$' },
          },
        },
      },
    },
    watchlistController.getWatchlistPerformance.bind(watchlistController)
  );

  fastify.get(
    '/market-analysis',
    {
      preHandler: [fastify.authenticate],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'string', pattern: '^[0-9]+$' },
          },
        },
      },
    },
    watchlistController.getMarketChangeAnalysis.bind(watchlistController)
  );
}
