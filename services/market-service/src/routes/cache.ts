import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CacheManager } from '../utils/cacheManager';
import { DataRefreshScheduler } from '../services/dataRefreshScheduler';

interface CacheInvalidateRequest {
  Body: {
    regionId?: number;
    typeId?: number;
    pattern?: string;
  };
}

interface CacheWarmupRequest {
  Body: {
    items: Array<{ regionId: number; typeId: number }>;
  };
}

interface RefreshRequest {
  Body: {
    maxAgeMinutes?: number;
    force?: boolean;
  };
}

export async function cacheRoutes(fastify: FastifyInstance) {
  const cacheManager = new CacheManager(fastify);
  const refreshScheduler = new DataRefreshScheduler(fastify);

  // Get cache statistics and metrics
  fastify.get('/cache/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await cacheManager.getCacheStats();

      reply.send({
        success: true,
        data: stats,
      });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to get cache stats');
      reply.status(500).send({
        success: false,
        error: 'Failed to retrieve cache statistics',
      });
    }
  });

  // Get cache metrics only
  fastify.get('/cache/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = cacheManager.getMetrics();

      reply.send({
        success: true,
        data: metrics,
      });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to get cache metrics');
      reply.status(500).send({
        success: false,
        error: 'Failed to retrieve cache metrics',
      });
    }
  });

  // Invalidate cache entries
  fastify.post<CacheInvalidateRequest>(
    '/cache/invalidate',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            regionId: { type: 'number' },
            typeId: { type: 'number' },
            pattern: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<CacheInvalidateRequest>, reply: FastifyReply) => {
      try {
        const { regionId, typeId, pattern } = request.body;

        if (pattern) {
          // Invalidate by pattern
          const count = await cacheManager.invalidateByPattern(pattern);
          reply.send({
            success: true,
            data: {
              invalidated: count,
              pattern,
            },
          });
        } else if (regionId !== undefined && typeId !== undefined) {
          // Invalidate specific market data
          await cacheManager.invalidateMarketData(regionId, typeId);
          reply.send({
            success: true,
            data: {
              invalidated: 1,
              regionId,
              typeId,
            },
          });
        } else {
          reply.status(400).send({
            success: false,
            error: 'Either pattern or both regionId and typeId must be provided',
          });
        }
      } catch (error) {
        fastify.log.error({ error, body: request.body }, 'Failed to invalidate cache');
        reply.status(500).send({
          success: false,
          error: 'Failed to invalidate cache entries',
        });
      }
    }
  );

  // Warm up cache with specific items
  fastify.post<CacheWarmupRequest>(
    '/cache/warmup',
    {
      schema: {
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                required: ['regionId', 'typeId'],
                properties: {
                  regionId: { type: 'number' },
                  typeId: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<CacheWarmupRequest>, reply: FastifyReply) => {
      try {
        const { items } = request.body;

        if (!items || items.length === 0) {
          reply.status(400).send({
            success: false,
            error: 'Items array cannot be empty',
          });
          return;
        }

        if (items.length > 100) {
          reply.status(400).send({
            success: false,
            error: 'Cannot warm up more than 100 items at once',
          });
          return;
        }

        // Import MarketDataFetcher here to avoid circular dependency
        const { MarketDataFetcher } = await import('../services/marketDataFetcher');
        const fetcher = new MarketDataFetcher(fastify);

        const result = await cacheManager.warmupCache(items, async (regionId, typeId) => {
          const fetchResult = await fetcher.getMarketData(regionId, typeId, { forceRefresh: true });
          return fetchResult.data;
        });

        reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        fastify.log.error({ error, body: request.body }, 'Failed to warm up cache');
        reply.status(500).send({
          success: false,
          error: 'Failed to warm up cache',
        });
      }
    }
  );

  // Get refresh scheduler status
  fastify.get('/cache/refresh/status', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = refreshScheduler.getStatus();

      reply.send({
        success: true,
        data: status,
      });
    } catch (error) {
      fastify.log.error({ error }, 'Failed to get refresh scheduler status');
      reply.status(500).send({
        success: false,
        error: 'Failed to retrieve refresh scheduler status',
      });
    }
  });

  // Force refresh stale data
  fastify.post<RefreshRequest>(
    '/cache/refresh',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            maxAgeMinutes: { type: 'number', minimum: 0 },
            force: { type: 'boolean' },
          },
        },
      },
    },
    async (request: FastifyRequest<RefreshRequest>, reply: FastifyReply) => {
      try {
        const { maxAgeMinutes, force } = request.body || {};

        const result = await refreshScheduler.forceRefresh(force ? 0 : maxAgeMinutes);

        reply.send({
          success: true,
          data: result,
        });
      } catch (error) {
        fastify.log.error({ error, body: request.body }, 'Failed to force refresh');
        reply.status(500).send({
          success: false,
          error: 'Failed to force refresh cache data',
        });
      }
    }
  );

  // Update refresh strategy
  fastify.put(
    '/cache/refresh/strategy/:strategyName',
    {
      schema: {
        params: {
          type: 'object',
          required: ['strategyName'],
          properties: {
            strategyName: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            intervalMinutes: { type: 'number', minimum: 1 },
            maxAgeMinutes: { type: 'number', minimum: 1 },
            enabled: { type: 'boolean' },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { strategyName: string };
        Body: {
          intervalMinutes?: number;
          maxAgeMinutes?: number;
          enabled?: boolean;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { strategyName } = request.params;
        const updates = request.body;

        const success = refreshScheduler.updateStrategy(strategyName, updates);

        if (success) {
          reply.send({
            success: true,
            data: {
              strategyName,
              updates,
            },
          });
        } else {
          reply.status(404).send({
            success: false,
            error: `Strategy '${strategyName}' not found`,
          });
        }
      } catch (error) {
        fastify.log.error(
          { error, params: request.params, body: request.body },
          'Failed to update refresh strategy'
        );
        reply.status(500).send({
          success: false,
          error: 'Failed to update refresh strategy',
        });
      }
    }
  );
}
