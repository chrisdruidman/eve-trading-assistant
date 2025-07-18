import { FastifyInstance } from 'fastify';
import { MarketData, CacheStrategy } from '../../../../shared/src/types';

interface CacheMetrics {
  hits: number;
  misses: number;
  staleHits: number;
  freshHits: number;
  invalidations: number;
  errors: number;
  totalRequests: number;
  hitRate: number;
  staleRate: number;
  lastReset: Date;
}

interface CacheStats {
  totalKeys: number;
  marketDataKeys: number;
  historicalDataKeys: number;
  memoryUsage?: string;
  metrics: CacheMetrics;
}

export class CacheManager {
  private defaultStrategy: CacheStrategy = {
    ttl: 300, // 5 minutes
    refreshThreshold: 80, // Refresh when 80% of TTL has passed
    maxStaleTime: 900, // Serve stale data for up to 15 minutes
  };

  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    staleHits: 0,
    freshHits: 0,
    invalidations: 0,
    errors: 0,
    totalRequests: 0,
    hitRate: 0,
    staleRate: 0,
    lastReset: new Date(),
  };

  constructor(private fastify: FastifyInstance) {
    // Reset metrics every hour to prevent overflow and provide fresh stats
    setInterval(() => {
      this.resetMetrics();
    }, 3600000); // 1 hour
  }

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
    this.metrics.totalRequests++;

    try {
      const result = await this.fastify.redis.getWithFreshness(key);

      if (!result.value) {
        this.metrics.misses++;
        this.updateMetrics();
        return { data: null, isStale: false };
      }

      // Track cache hit
      this.metrics.hits++;
      if (result.isStale) {
        this.metrics.staleHits++;
      } else {
        this.metrics.freshHits++;
      }
      this.updateMetrics();

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
      this.metrics.errors++;
      this.updateMetrics();
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
    this.metrics.totalRequests++;

    try {
      const result = await this.fastify.redis.getWithFreshness(key);

      if (!result.value) {
        this.metrics.misses++;
        this.updateMetrics();
        return { data: null, isStale: false };
      }

      // Track cache hit
      this.metrics.hits++;
      if (result.isStale) {
        this.metrics.staleHits++;
      } else {
        this.metrics.freshHits++;
      }
      this.updateMetrics();

      const data = JSON.parse(result.value);

      // Convert date strings back to Date objects
      data.forEach((item: any) => {
        if (item.date) {
          item.date = new Date(item.date);
        }
      });

      return { data, isStale: result.isStale };
    } catch (error) {
      this.metrics.errors++;
      this.updateMetrics();
      this.fastify.log.error({ key, error }, 'Failed to get cached historical data');
      return { data: null, isStale: false };
    }
  }

  async invalidateMarketData(regionId: number, typeId: number): Promise<void> {
    const key = this.getMarketDataKey(regionId, typeId);

    try {
      await this.fastify.redis.del(key);
      this.metrics.invalidations++;
      this.updateMetrics();
      this.fastify.log.debug({ key }, 'Market data cache invalidated');
    } catch (error) {
      this.metrics.errors++;
      this.updateMetrics();
      this.fastify.log.error({ key, error }, 'Failed to invalidate market data cache');
    }
  }

  async invalidateHistoricalData(regionId: number, typeId: number, days?: number): Promise<void> {
    if (days) {
      const key = this.getHistoricalDataKey(regionId, typeId, days);
      try {
        await this.fastify.redis.del(key);
        this.metrics.invalidations++;
        this.updateMetrics();
        this.fastify.log.debug({ key }, 'Historical data cache invalidated');
      } catch (error) {
        this.metrics.errors++;
        this.updateMetrics();
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
          this.metrics.invalidations += keys.length;
          this.updateMetrics();
          this.fastify.log.debug(
            { pattern, count: keys.length },
            'Historical data caches invalidated'
          );
        }
      } catch (error) {
        this.metrics.errors++;
        this.updateMetrics();
        this.fastify.log.error({ pattern, error }, 'Failed to invalidate historical data caches');
      }
    }
  }

  private updateMetrics(): void {
    if (this.metrics.totalRequests > 0) {
      this.metrics.hitRate = (this.metrics.hits / this.metrics.totalRequests) * 100;
      this.metrics.staleRate = (this.metrics.staleHits / this.metrics.hits) * 100;
    }
  }

  private resetMetrics(): void {
    this.fastify.log.info(
      {
        previousMetrics: { ...this.metrics },
      },
      'Resetting cache metrics'
    );

    this.metrics = {
      hits: 0,
      misses: 0,
      staleHits: 0,
      freshHits: 0,
      invalidations: 0,
      errors: 0,
      totalRequests: 0,
      hitRate: 0,
      staleRate: 0,
      lastReset: new Date(),
    };
  }

  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  async getCacheStats(): Promise<CacheStats> {
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

      const result: CacheStats = {
        totalKeys: allKeys.length,
        marketDataKeys,
        historicalDataKeys,
        metrics: this.getMetrics(),
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
        metrics: this.getMetrics(),
      };
    }
  }

  async invalidateByPattern(pattern: string): Promise<number> {
    try {
      // Use SCAN instead of KEYS for better performance in production
      const keys = await this.fastify.redis.client.keys(pattern);
      if (keys.length > 0) {
        await this.fastify.redis.client.del(keys);
        this.metrics.invalidations += keys.length;
        this.updateMetrics();
        this.fastify.log.debug(
          { pattern, count: keys.length },
          'Cache keys invalidated by pattern'
        );
        return keys.length;
      }
      return 0;
    } catch (error) {
      this.metrics.errors++;
      this.updateMetrics();
      this.fastify.log.error({ pattern, error }, 'Failed to invalidate cache by pattern');
      throw error;
    }
  }

  async warmupCache(
    items: Array<{ regionId: number; typeId: number }>,
    fetchFunction: (regionId: number, typeId: number) => Promise<MarketData>
  ): Promise<{ warmed: number; failed: number; errors: string[] }> {
    let warmed = 0;
    let failed = 0;
    const errors: string[] = [];

    this.fastify.log.info({ itemCount: items.length }, 'Starting cache warmup');

    for (const item of items) {
      try {
        const data = await fetchFunction(item.regionId, item.typeId);
        await this.cacheMarketData(item.regionId, item.typeId, data);
        warmed++;

        // Add small delay to prevent overwhelming the system
        await this.sleep(50);
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${item.regionId}:${item.typeId} - ${errorMessage}`);

        this.fastify.log.warn(
          {
            regionId: item.regionId,
            typeId: item.typeId,
            error: errorMessage,
          },
          'Failed to warm cache for item'
        );
      }
    }

    this.fastify.log.info({ warmed, failed, total: items.length }, 'Completed cache warmup');

    return { warmed, failed, errors };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
