import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { MarketDataRepository } from '../models/marketDataRepository';
import { CacheManager } from '../utils/cacheManager';

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
});

const MarketDataResponse = Type.Object({
  data: Type.Any(),
  cached: Type.Boolean(),
  stale: Type.Boolean(),
  lastUpdated: Type.String({ format: 'date-time' }),
});

const HistoricalDataResponse = Type.Object({
  data: Type.Array(Type.Any()),
  cached: Type.Boolean(),
  stale: Type.Boolean(),
  days: Type.Number(),
});

export const marketDataRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const marketDataRepo = new MarketDataRepository(fastify);
  const cacheManager = new CacheManager(fastify);

  // Get market data for a specific item in a region
  fastify.get<{
    Params: { regionId: number; typeId: number };
    Reply: typeof MarketDataResponse;
  }>(
    '/data/:regionId/:typeId',
    {
      schema: {
        params: GetMarketDataParams,
        response: {
          200: MarketDataResponse,
        },
      },
    },
    async (request, reply) => {
      const { regionId, typeId } = request.params;

      try {
        // Try to get from cache first
        const cached = await cacheManager.getCachedMarketData(regionId, typeId);

        if (cached.data) {
          return {
            data: cached.data,
            cached: true,
            stale: cached.isStale,
            lastUpdated: cached.data.lastUpdated.toISOString(),
          };
        }

        // If not in cache, get from database
        const marketData = await marketDataRepo.getMarketData(regionId, typeId);

        if (!marketData) {
          return reply.status(404).send({
            code: 'MARKET_DATA_NOT_FOUND',
            message: `No market data found for type ${typeId} in region ${regionId}`,
            retryable: false,
            userMessage: 'Market data not available for this item and region',
            timestamp: new Date(),
          });
        }

        // Cache the data for future requests
        await cacheManager.cacheMarketData(regionId, typeId, marketData);

        return {
          data: marketData,
          cached: false,
          stale: false,
          lastUpdated: marketData.lastUpdated.toISOString(),
        };
      } catch (error) {
        fastify.log.error({ regionId, typeId, error }, 'Failed to get market data');
        throw error;
      }
    }
  );

  // Get historical price data
  fastify.get<{
    Params: { regionId: number; typeId: number };
    Querystring: { days?: number };
    Reply: typeof HistoricalDataResponse;
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
      const days = request.query.days || 30;

      try {
        // Try to get from cache first
        const cached = await cacheManager.getCachedHistoricalData(regionId, typeId, days);

        if (cached.data) {
          return {
            data: cached.data,
            cached: true,
            stale: cached.isStale,
            days,
          };
        }

        // If not in cache, get from database
        const historicalData = await marketDataRepo.getHistoricalData(regionId, typeId, days);

        // Cache the data for future requests
        await cacheManager.cacheHistoricalData(regionId, typeId, days, historicalData);

        return {
          data: historicalData,
          cached: false,
          stale: false,
          days,
        };
      } catch (error) {
        fastify.log.error({ regionId, typeId, days, error }, 'Failed to get historical data');
        throw error;
      }
    }
  );

  // Get cache statistics (for monitoring)
  fastify.get('/cache/stats', async (request, reply) => {
    try {
      const stats = await cacheManager.getCacheStats();
      return stats;
    } catch (error) {
      fastify.log.error({ error }, 'Failed to get cache stats');
      throw error;
    }
  });

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
        throw error;
      }
    }
  );
};
