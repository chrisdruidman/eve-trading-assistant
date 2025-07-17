import { FastifyInstance } from 'fastify';
import { MarketData, CacheStrategy } from '../../../../shared/src/types';

export class CacheManager {
  private defaultStrategy: CacheStrategy = {
    ttl: 300, // 5 minutes
    refreshThreshold: 80, // Refresh when 80% of TTL has passed
    maxStaleTime: 900, // Serve stale data for up to 15 minutes
  };

  constructor(private fastify: FastifyInstance) {}

  private getMarketDataKey(regionId: number, typeId: number): string {
    return `market:${regionId}:${typeId}`;
  }

  private getHistoricalDataKey(regionId: number, typeId: number, days: number): string {
    return `history:${regionId}:${typeId}:${days}`;
  }

  async cacheMarketData(
    regionId: number,
    typeId: number,
    data: MarketData,
    strategy?: CacheStrategy
  ): Promise<void> {
    const key = this.getMarketDataKey(regionId, typeId);
    const cacheStrategy = strategy || this.defaultStrategy;

    try {
      await this.fastify.redis.setWithStrategy(key, JSON.stringify(data), cacheStrategy);

      this.fastify.log.debug({ key, ttl: cacheStrategy.ttl }, 'Market data cached');
    } catch (error) {
      this.fastify.log.error({ key, error }, 'Failed to cache market data');
    }
  }

  async getCachedMarketData(
    regionId: number,
    typeId: number
  ): Promise<{ data: MarketData | null; isStale: boolean }> {
    const key = this.getMarketDataKey(regionId, typeId);

    try {
      const result = await this.fastify.redis.getWithFreshness(key);

      if (!result.value) {
        return { data: null, isStale: false };
      }

      const data = JSON.parse(result.value) as MarketData;

      // Convert date strings back to Date objects
      data.lastUpdated = new Date(data.lastUpdated);
      data.buyOrders.forEach(order => {
        order.issued = new Date(order.issued);
      });
      data.sellOrders.forEach(order => {
        order.issued = new Date(order.issued);
      });

      return { data, isStale: result.isStale };
    } catch (error) {
      this.fastify.log.error({ key, error }, 'Failed to get cached market data');
      return { data: null, isStale: false };
    }
  }

  async cacheHistoricalData(
    regionId: number,
    typeId: number,
    days: number,
    data: any[],
    strategy?: CacheStrategy
  ): Promise<void> {
    const key = this.getHistoricalDataKey(regionId, typeId, days);
    const cacheStrategy = strategy || {
      ...this.defaultStrategy,
      ttl: 3600, // Historical data can be cached longer (1 hour)
    };

    try {
      await this.fastify.redis.setWithStrategy(key, JSON.stringify(data), cacheStrategy);

      this.fastify.log.debug({ key, ttl: cacheStrategy.ttl }, 'Historical data cached');
    } catch (error) {
      this.fastify.log.error({ key, error }, 'Failed to cache historical data');
    }
  }

  async getCachedHistoricalData(
    regionId: number,
    typeId: number,
    days: number
  ): Promise<{ data: any[] | null; isStale: boolean }> {
    const key = this.getHistoricalDataKey(regionId, typeId, days);

    try {
      const result = await this.fastify.redis.getWithFreshness(key);

      if (!result.value) {
        return { data: null, isStale: false };
      }

      const data = JSON.parse(result.value);

      // Convert date strings back to Date objects
      data.forEach((item: any) => {
        if (item.date) {
          item.date = new Date(item.date);
        }
      });

      return { data, isStale: result.isStale };
    } catch (error) {
      this.fastify.log.error({ key, error }, 'Failed to get cached historical data');
      return { data: null, isStale: false };
    }
  }

  async invalidateMarketData(regionId: number, typeId: number): Promise<void> {
    const key = this.getMarketDataKey(regionId, typeId);

    try {
      await this.fastify.redis.del(key);
      this.fastify.log.debug({ key }, 'Market data cache invalidated');
    } catch (error) {
      this.fastify.log.error({ key, error }, 'Failed to invalidate market data cache');
    }
  }

  async invalidateHistoricalData(regionId: number, typeId: number, days?: number): Promise<void> {
    if (days) {
      const key = this.getHistoricalDataKey(regionId, typeId, days);
      try {
        await this.fastify.redis.del(key);
        this.fastify.log.debug({ key }, 'Historical data cache invalidated');
      } catch (error) {
        this.fastify.log.error({ key, error }, 'Failed to invalidate historical data cache');
      }
    } else {
      // Invalidate all historical data for this type/region
      const pattern = `history:${regionId}:${typeId}:*`;
      try {
        // Note: In production, you might want to use SCAN instead of KEYS for better performance
        const keys = await this.fastify.redis.client.keys(pattern);
        if (keys.length > 0) {
          await this.fastify.redis.client.del(keys);
          this.fastify.log.debug(
            { pattern, count: keys.length },
            'Historical data caches invalidated'
          );
        }
      } catch (error) {
        this.fastify.log.error({ pattern, error }, 'Failed to invalidate historical data caches');
      }
    }
  }

  async getCacheStats(): Promise<{
    totalKeys: number;
    marketDataKeys: number;
    historicalDataKeys: number;
    memoryUsage?: string;
  }> {
    try {
      const allKeys = await this.fastify.redis.client.keys('*');
      const marketDataKeys = allKeys.filter(key => key.startsWith('market:')).length;
      const historicalDataKeys = allKeys.filter(key => key.startsWith('history:')).length;

      // Get memory usage if available
      let memoryUsage: string | undefined;
      try {
        const info = await this.fastify.redis.client.info('memory');
        const memoryMatch = info.match(/used_memory_human:(.+)/);
        if (memoryMatch && memoryMatch[1]) {
          memoryUsage = memoryMatch[1].trim();
        }
      } catch (error) {
        // Memory info not available
      }

      const result: {
        totalKeys: number;
        marketDataKeys: number;
        historicalDataKeys: number;
        memoryUsage?: string;
      } = {
        totalKeys: allKeys.length,
        marketDataKeys,
        historicalDataKeys,
      };

      if (memoryUsage) {
        result.memoryUsage = memoryUsage;
      }

      return result;
    } catch (error) {
      this.fastify.log.error({ error }, 'Failed to get cache stats');
      return {
        totalKeys: 0,
        marketDataKeys: 0,
        historicalDataKeys: 0,
      };
    }
  }
}
