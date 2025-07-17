import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { MarketDataRepository } from '../models/marketDataRepository';
import { CacheManager } from '../utils/cacheManager';
import { MarketDataFetcher } from '../services/marketDataFetcher';

// Request/Response schemas
const GetMarketDataParams = Type.Object({
  regionId: Type.Number({ minimum: 1 }),
  typeId: Type.Number({ minimum: 1 }),
});

const GetHistoricalDataParams = Type.Object({
  regionId: Type.Number({ minimum: 1 }),
  typeId: Type.Number({ minimum: 1 }),
});

const GetHistoricalDataQuery = Type.Object({
  days: Type.Optional(Type.Number({ minimum: 1, maximum: 365, default: 30 })),
  forceRefresh: Type.Optional(Type.Boolean()),
  maxStaleTime: Type.Optional(Type.Number({ minimum: 0 })),
});

const GetMarketDataQuery = Type.Object({
  forceRefresh: Type.Optional(Type.Boolean()),
  maxStaleTime: Type.Optional(Type.Number({ minimum: 0 })),
});

const RefreshQuery = Type.Object({
  maxAgeMinutes: Type.Optional(Type.Number({ minimum: 1, maximum: 60, default: 10 })),
});

const MarketDataResponse = Type.Object({
  data: Type.Object({
    typeId: Type.Number(),
    regionId: Type.Number(),
    buyOrders: Type.Array(Type.Any()),
    sellOrders: Type.Array(Type.Any()),
    lastUpdated: Type.String({ format: 'date-time' }),
    volume: Type.Number(),
    averagePrice: Type.Number(),
  }),
  meta: Type.Object({
    fromCache: Type.Boolean(),
    isStale: Type.Boolean(),
    lastUpdated: Type.String({ format: 'date-time' }),
  }),
});

const HistoricalDataResponse = Type.Object({
  data: Type.Array(Type.Any()),
  meta: Type.Object({
    fromCache: Type.Boolean(),
    isStale: Type.Boolean(),
    days: Type.Number(),
    lastUpdated: Type.String({ format: 'date-time' }),
  }),
});

const RefreshResponse = Type.Object({
  data: Type.Object({
    refreshed: Type.Number(),
    failed: Type.Number(),
    errors: Type.Array(Type.String()),
  }),
});

const EsiStatusResponse = Type.Object({
  data: Type.Object({
    connected: Type.Boolean(),
    rateLimit: Type.Object({
      remain: Type.Number(),
      resetIn: Type.Number(),
    }),
    circuitBreaker: Type.Object({
      isOpen: Type.Boolean(),
      failures: Type.Number(),
      resetIn: Type.Optional(Type.Number()),
    }),
  }),
});

const CacheStatsResponse = Type.Object({
  data: Type.Object({
    totalKeys: Type.Number(),
    marketDataKeys: Type.Number(),
    historicalDataKeys: Type.Number(),
    memoryUsage: Type.Optional(Type.String()),
  }),
});

export const marketDataRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const marketDataRepo = new MarketDataRepository(fastify);
  const cacheManager = new CacheManager(fastify);
  const fetcher = new MarketDataFetcher(fastify);

  // Get market data for a specific item in a region
  fastify.get<{
    Params: { regionId: number; typeId: number };
    Querystring: { forceRefresh?: boolean; maxStaleTime?: number };
  }>(
    '/data/:regionId/:typeId',
    {
      schema: {
        params: GetMarketDataParams,
        querystring: GetMarketDataQuery,
        response: {
          200: MarketDataResponse,
        },
      },
    },
    async (request, reply) => {
      const { regionId, typeId } = request.params;
      const { forceRefresh, maxStaleTime } = request.query;

      try {
        const result = await fetcher.getMarketData(regionId, typeId, {
          forceRefresh,
          maxStaleTime,
        });

        return {
          data: result.data,
          meta: {
            fromCache: result.fromCache,
            isStale: result.isStale,
            lastUpdated: result.lastUpdated.toISOString(),
          },
        };
      } catch (error) {
        fastify.log.error({ error, regionId, typeId }, 'Failed to get market data');

        if (error instanceof Error && error.name === 'EsiError') {
          return reply.status(503).send({
            error: 'EVE Online ESI service unavailable',
            code: 'ESI_UNAVAILABLE',
            message: 'Market data service is temporarily unavailable. Please try again later.',
            retryAfter: (error as any).retryAfter,
          });
        }

        return reply.status(500).send({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        });
      }
    }
  );

  // Get historical price data
  fastify.get<{
    Params: { regionId: number; typeId: number };
    Querystring: { days?: number; forceRefresh?: boolean; maxStaleTime?: number };
  }>(
    '/history/:regionId/:typeId',
    {
      schema: {
        params: GetHistoricalDataParams,
        querystring: GetHistoricalDataQuery,
        response: {
          200: HistoricalDataResponse,
        },
      },
    },
    async (request, reply) => {
      const { regionId, typeId } = request.params;
      const { days = 30, forceRefresh, maxStaleTime } = request.query;

      try {
        const result = await fetcher.getHistoricalData(regionId, typeId, days, {
          forceRefresh,
          maxStaleTime,
        });

        return {
          data: result.data,
          meta: {
            fromCache: result.fromCache,
            isStale: result.isStale,
            days,
            lastUpdated: result.lastUpdated.toISOString(),
          },
        };
      } catch (error) {
        fastify.log.error({ error, regionId, typeId, days }, 'Failed to get historical data');

        if (error instanceof Error && error.name === 'EsiError') {
          return reply.status(503).send({
            error: 'EVE Online ESI service unavailable',
            code: 'ESI_UNAVAILABLE',
            message: 'Historical data service is temporarily unavailable. Please try again later.',
            retryAfter: (error as any).retryAfter,
          });
        }

        return reply.status(500).send({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        });
      }
    }
  );

  // Refresh stale market data
  fastify.post<{
    Querystring: { maxAgeMinutes?: number };
  }>(
    '/refresh',
    {
      schema: {
        querystring: RefreshQuery,
        response: {
          200: RefreshResponse,
        },
      },
    },
    async (request, reply) => {
      const { maxAgeMinutes = 10 } = request.query;

      try {
        const result = await fetcher.refreshStaleData(maxAgeMinutes);
        return { data: result };
      } catch (error) {
        fastify.log.error({ error, maxAgeMinutes }, 'Failed to refresh stale data');
        return reply.status(500).send({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        });
      }
    }
  );

  // Get ESI service status
  fastify.get(
    '/esi/status',
    {
      schema: {
        response: {
          200: EsiStatusResponse,
        },
      },
    },
    async (request, reply) => {
      try {
        const status = await fetcher.getEsiStatus();
        return { data: status };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get ESI status');
        return reply.status(500).send({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        });
      }
    }
  );

  // Get cache statistics (for monitoring)
  fastify.get(
    '/cache/stats',
    {
      schema: {
        response: {
          200: CacheStatsResponse,
        },
      },
    },
    async (request, reply) => {
      try {
        const stats = await cacheManager.getCacheStats();
        return { data: stats };
      } catch (error) {
        fastify.log.error({ error }, 'Failed to get cache stats');
        return reply.status(500).send({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        });
      }
    }
  );

  // Invalidate cache for specific market data
  fastify.delete<{
    Params: { regionId: number; typeId: number };
  }>(
    '/cache/:regionId/:typeId',
    {
      schema: {
        params: GetMarketDataParams,
      },
    },
    async (request, reply) => {
      const { regionId, typeId } = request.params;

      try {
        await cacheManager.invalidateMarketData(regionId, typeId);
        await cacheManager.invalidateHistoricalData(regionId, typeId);

        return {
          message: 'Cache invalidated successfully',
          regionId,
          typeId,
        };
      } catch (error) {
        fastify.log.error({ regionId, typeId, error }, 'Failed to invalidate cache');
        return reply.status(500).send({
          error: 'Failed to invalidate cache',
          code: 'CACHE_ERROR',
        });
      }
    }
  );
};
