import { FastifyInstance } from 'fastify';
import { EsiClient } from '../clients/esiClient';
import { MarketDataRepository } from '../models/marketDataRepository';
import { CacheManager } from '../utils/cacheManager';
import { MarketData, PriceHistory, CacheStrategy } from '../../../../shared/src/types';

interface FetchOptions {
  forceRefresh?: boolean;
  maxStaleTime?: number;
  cacheStrategy?: CacheStrategy;
}

interface FetchResult<T> {
  data: T;
  fromCache: boolean;
  isStale: boolean;
  lastUpdated: Date;
}

export class MarketDataFetcher {
  private fastify: FastifyInstance;
  private esiClient: EsiClient;
  private repository: MarketDataRepository;
  private cacheManager: CacheManager;

  // Default cache strategies for different data types
  private readonly marketDataCacheStrategy: CacheStrategy = {
    ttl: 300, // 5 minutes - ESI market data updates every 5 minutes
    refreshThreshold: 80, // Refresh when 80% of TTL has passed (4 minutes)
    maxStaleTime: 900, // Serve stale data for up to 15 minutes if ESI is down
  };

  private readonly historicalDataCacheStrategy: CacheStrategy = {
    ttl: 3600, // 1 hour - Historical data doesn't change frequently
    refreshThreshold: 90, // Refresh when 90% of TTL has passed
    maxStaleTime: 7200, // Serve stale historical data for up to 2 hours
  };

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.esiClient = new EsiClient(fastify);
    this.repository = new MarketDataRepository(fastify);
    this.cacheManager = new CacheManager(fastify);
  }

  async getMarketData(
    regionId: number,
    typeId: number,
    options: FetchOptions = {}
  ): Promise<FetchResult<MarketData>> {
    const cacheStrategy = options.cacheStrategy || this.marketDataCacheStrategy;

    // Check cache first unless force refresh is requested
    if (!options.forceRefresh) {
      const cached = await this.cacheManager.getCachedMarketData(regionId, typeId);

      if (cached.data) {
        const age = Date.now() - cached.data.lastUpdated.getTime();
        const maxStaleTime = (options.maxStaleTime || cacheStrategy.maxStaleTime) * 1000;

        // Return cached data if it's fresh enough or if we allow stale data
        if (!cached.isStale || age < maxStaleTime) {
          this.fastify.log.debug(
            {
              regionId,
              typeId,
              age: age / 1000,
              isStale: cached.isStale,
            },
            'Returning cached market data'
          );

          return {
            data: cached.data,
            fromCache: true,
            isStale: cached.isStale,
            lastUpdated: cached.data.lastUpdated,
          };
        }
      }
    }

    // Fetch fresh data from ESI
    try {
      const freshData = await this.fetchFreshMarketData(regionId, typeId);

      // Cache the fresh data
      await this.cacheManager.cacheMarketData(regionId, typeId, freshData, cacheStrategy);

      // Store in database for persistence
      await this.repository.saveMarketData(freshData);

      this.fastify.log.info(
        {
          regionId,
          typeId,
          orderCount: freshData.buyOrders.length + freshData.sellOrders.length,
        },
        'Successfully fetched and cached fresh market data'
      );

      return {
        data: freshData,
        fromCache: false,
        isStale: false,
        lastUpdated: freshData.lastUpdated,
      };
    } catch (error) {
      this.fastify.log.error(
        {
          regionId,
          typeId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to fetch fresh market data from ESI'
      );

      // Try to return stale cached data as fallback
      const cached = await this.cacheManager.getCachedMarketData(regionId, typeId);
      if (cached.data) {
        this.fastify.log.warn(
          {
            regionId,
            typeId,
            age: (Date.now() - cached.data.lastUpdated.getTime()) / 1000,
          },
          'Returning stale cached data due to ESI error'
        );

        return {
          data: cached.data,
          fromCache: true,
          isStale: true,
          lastUpdated: cached.data.lastUpdated,
        };
      }

      // Try database as last resort
      const dbData = await this.repository.getMarketData(regionId, typeId);
      if (dbData) {
        this.fastify.log.warn(
          {
            regionId,
            typeId,
            age: (Date.now() - dbData.lastUpdated.getTime()) / 1000,
          },
          'Returning database data as last resort'
        );

        return {
          data: dbData,
          fromCache: false,
          isStale: true,
          lastUpdated: dbData.lastUpdated,
        };
      }

      throw error;
    }
  }

  private async fetchFreshMarketData(regionId: number, typeId: number): Promise<MarketData> {
    const orders = await this.esiClient.getMarketOrders(regionId, typeId);

    // Set regionId for all orders (ESI doesn't include it in the response)
    orders.forEach(order => {
      order.regionId = regionId;
    });

    const buyOrders = orders.filter(order => order.isBuyOrder);
    const sellOrders = orders.filter(order => !order.isBuyOrder);

    // Calculate volume and average price
    const totalVolume = orders.reduce((sum, order) => sum + order.volume, 0);
    const weightedPriceSum = orders.reduce((sum, order) => sum + order.price * order.volume, 0);
    const averagePrice = totalVolume > 0 ? weightedPriceSum / totalVolume : 0;

    return {
      typeId,
      regionId,
      buyOrders,
      sellOrders,
      lastUpdated: new Date(),
      volume: totalVolume,
      averagePrice,
    };
  }

  async getHistoricalData(
    regionId: number,
    typeId: number,
    days: number = 30,
    options: FetchOptions = {}
  ): Promise<FetchResult<PriceHistory[]>> {
    const cacheStrategy = options.cacheStrategy || this.historicalDataCacheStrategy;

    // Check cache first unless force refresh is requested
    if (!options.forceRefresh) {
      const cached = await this.cacheManager.getCachedHistoricalData(regionId, typeId, days);

      if (cached.data && cached.data.length > 0) {
        const latestEntry = cached.data[0]; // Assuming sorted by date DESC
        const age = Date.now() - latestEntry.date.getTime();
        const maxStaleTime = (options.maxStaleTime || cacheStrategy.maxStaleTime) * 1000;

        // Return cached data if it's fresh enough
        if (!cached.isStale || age < maxStaleTime) {
          this.fastify.log.debug(
            {
              regionId,
              typeId,
              days,
              entryCount: cached.data.length,
              isStale: cached.isStale,
            },
            'Returning cached historical data'
          );

          return {
            data: cached.data,
            fromCache: true,
            isStale: cached.isStale,
            lastUpdated: latestEntry.date,
          };
        }
      }
    }

    // Fetch fresh data from ESI
    try {
      const freshData = await this.esiClient.getMarketHistory(regionId, typeId);

      // Filter to requested number of days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const filteredData = freshData.filter(entry => entry.date >= cutoffDate);

      // Cache the fresh data
      await this.cacheManager.cacheHistoricalData(
        regionId,
        typeId,
        days,
        filteredData,
        cacheStrategy
      );

      // Store in database for persistence
      for (const entry of filteredData) {
        await this.repository.savePriceHistory(entry);
      }

      this.fastify.log.info(
        {
          regionId,
          typeId,
          days,
          entryCount: filteredData.length,
        },
        'Successfully fetched and cached fresh historical data'
      );

      const lastUpdated = filteredData.length > 0 ? filteredData[0]!.date : new Date();

      return {
        data: filteredData,
        fromCache: false,
        isStale: false,
        lastUpdated,
      };
    } catch (error) {
      this.fastify.log.error(
        {
          regionId,
          typeId,
          days,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to fetch fresh historical data from ESI'
      );

      // Try to return cached data as fallback
      const cached = await this.cacheManager.getCachedHistoricalData(regionId, typeId, days);
      if (cached.data && cached.data.length > 0) {
        this.fastify.log.warn(
          {
            regionId,
            typeId,
            days,
            entryCount: cached.data.length,
          },
          'Returning stale cached historical data due to ESI error'
        );

        return {
          data: cached.data,
          fromCache: true,
          isStale: true,
          lastUpdated: cached.data[0].date,
        };
      }

      // Try database as last resort
      const dbData = await this.repository.getHistoricalData(regionId, typeId, days);
      if (dbData.length > 0) {
        this.fastify.log.warn(
          {
            regionId,
            typeId,
            days,
            entryCount: dbData.length,
          },
          'Returning database historical data as last resort'
        );

        return {
          data: dbData,
          fromCache: false,
          isStale: true,
          lastUpdated: dbData[0]!.date,
        };
      }

      throw error;
    }
  }

  async refreshStaleData(maxAgeMinutes: number = 10): Promise<{
    refreshed: number;
    failed: number;
    errors: string[];
  }> {
    const staleItems = await this.repository.getStaleMarketData(maxAgeMinutes);
    let refreshed = 0;
    let failed = 0;
    const errors: string[] = [];

    this.fastify.log.info(
      {
        staleCount: staleItems.length,
        maxAgeMinutes,
      },
      'Starting stale data refresh'
    );

    for (const item of staleItems) {
      try {
        await this.getMarketData(item.regionId, item.typeId, { forceRefresh: true });
        refreshed++;

        // Add small delay to respect rate limits
        await this.sleep(100);
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
          'Failed to refresh stale market data'
        );
      }
    }

    this.fastify.log.info(
      {
        refreshed,
        failed,
        total: staleItems.length,
      },
      'Completed stale data refresh'
    );

    return { refreshed, failed, errors };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getEsiStatus(): Promise<{
    connected: boolean;
    rateLimit: {
      remain: number;
      resetIn: number;
    };
    circuitBreaker: {
      isOpen: boolean;
      failures: number;
      resetIn?: number;
    };
  }> {
    const connected = await this.esiClient.validateConnection();
    const rateLimit = this.esiClient.getRateLimitStatus();
    const circuitBreaker = this.esiClient.getCircuitBreakerStatus();

    return {
      connected,
      rateLimit: {
        remain: rateLimit.remain,
        resetIn: rateLimit.reset,
      },
      circuitBreaker: {
        isOpen: circuitBreaker.isOpen,
        failures: circuitBreaker.failures,
        ...(circuitBreaker.resetIn !== undefined && { resetIn: circuitBreaker.resetIn }),
      },
    };
  }
}
