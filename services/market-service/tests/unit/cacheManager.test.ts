import { FastifyInstance } from 'fastify';
import { CacheManager } from '../../src/utils/cacheManager';
import { MarketData, CacheStrategy } from '../../../../shared/src/types';

// Mock Fastify instance
const mockFastify = {
  redis: {
    client: {
      keys: jest.fn(),
      del: jest.fn(),
      info: jest.fn(),
    },
    setWithStrategy: jest.fn(),
    getWithFreshness: jest.fn(),
    del: jest.fn(),
  },
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
} as unknown as FastifyInstance;

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockMarketData: MarketData;

  beforeEach(() => {
    cacheManager = new CacheManager(mockFastify);
    jest.clearAllMocks();

    mockMarketData = {
      typeId: 34,
      regionId: 10000002,
      buyOrders: [
        {
          orderId: 1,
          typeId: 34,
          regionId: 10000002,
          locationId: 60003760,
          price: 100.5,
          volume: 1000,
          minVolume: 1,
          duration: 90,
          issued: new Date('2023-01-01T10:00:00Z'),
          isBuyOrder: true,
        },
      ],
      sellOrders: [
        {
          orderId: 2,
          typeId: 34,
          regionId: 10000002,
          locationId: 60003760,
          price: 105.0,
          volume: 500,
          minVolume: 1,
          duration: 90,
          issued: new Date('2023-01-01T10:00:00Z'),
          isBuyOrder: false,
        },
      ],
      lastUpdated: new Date('2023-01-01T12:00:00Z'),
      volume: 1500,
      averagePrice: 102.0,
    };
  });

  describe('cacheMarketData', () => {
    it('should cache market data with default strategy', async () => {
      await cacheManager.cacheMarketData(10000002, 34, mockMarketData);

      expect(mockFastify.redis.setWithStrategy).toHaveBeenCalledWith(
        'market:10000002:34',
        JSON.stringify(mockMarketData),
        expect.objectContaining({
          ttl: 300,
          refreshThreshold: 80,
          maxStaleTime: 900,
        })
      );
    });

    it('should cache market data with custom strategy', async () => {
      const customStrategy: CacheStrategy = {
        ttl: 600,
        refreshThreshold: 90,
        maxStaleTime: 1800,
      };

      await cacheManager.cacheMarketData(10000002, 34, mockMarketData, customStrategy);

      expect(mockFastify.redis.setWithStrategy).toHaveBeenCalledWith(
        'market:10000002:34',
        JSON.stringify(mockMarketData),
        customStrategy
      );
    });

    it('should handle caching errors gracefully', async () => {
      mockFastify.redis.setWithStrategy = jest.fn().mockRejectedValue(new Error('Redis error'));

      await expect(
        cacheManager.cacheMarketData(10000002, 34, mockMarketData)
      ).resolves.not.toThrow();

      expect(mockFastify.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'market:10000002:34',
          error: expect.any(Error),
        }),
        'Failed to cache market data'
      );
    });
  });

  describe('getCachedMarketData', () => {
    it('should return cached market data and track metrics', async () => {
      const cachedData = JSON.stringify(mockMarketData);
      mockFastify.redis.getWithFreshness = jest.fn().mockResolvedValue({
        value: cachedData,
        isStale: false,
      });

      const result = await cacheManager.getCachedMarketData(10000002, 34);

      expect(result.data).toBeDefined();
      expect(result.data?.typeId).toBe(34);
      expect(result.data?.regionId).toBe(10000002);
      expect(result.isStale).toBe(false);

      // Check that dates are properly converted
      expect(result.data?.lastUpdated).toBeInstanceOf(Date);
      expect(result.data?.buyOrders[0]?.issued).toBeInstanceOf(Date);
      expect(result.data?.sellOrders[0]?.issued).toBeInstanceOf(Date);

      // Check metrics tracking
      const metrics = cacheManager.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.hits).toBe(1);
      expect(metrics.freshHits).toBe(1);
      expect(metrics.staleHits).toBe(0);
    });

    it('should return null for cache miss and track metrics', async () => {
      mockFastify.redis.getWithFreshness = jest.fn().mockResolvedValue({
        value: null,
        isStale: false,
      });

      const result = await cacheManager.getCachedMarketData(10000002, 34);

      expect(result.data).toBeNull();
      expect(result.isStale).toBe(false);

      // Check metrics tracking
      const metrics = cacheManager.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.hits).toBe(0);
    });

    it('should track stale hits correctly', async () => {
      const cachedData = JSON.stringify(mockMarketData);
      mockFastify.redis.getWithFreshness = jest.fn().mockResolvedValue({
        value: cachedData,
        isStale: true,
      });

      const result = await cacheManager.getCachedMarketData(10000002, 34);

      expect(result.data).toBeDefined();
      expect(result.isStale).toBe(true);

      // Check metrics tracking
      const metrics = cacheManager.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.hits).toBe(1);
      expect(metrics.staleHits).toBe(1);
      expect(metrics.freshHits).toBe(0);
    });

    it('should handle errors and track error metrics', async () => {
      mockFastify.redis.getWithFreshness = jest.fn().mockRejectedValue(new Error('Redis error'));

      const result = await cacheManager.getCachedMarketData(10000002, 34);

      expect(result.data).toBeNull();
      expect(result.isStale).toBe(false);

      // Check error metrics tracking
      const metrics = cacheManager.getMetrics();
      expect(metrics.errors).toBe(1);
      expect(mockFastify.log.error).toHaveBeenCalled();
    });
  });

  describe('invalidateMarketData', () => {
    it('should invalidate market data and track metrics', async () => {
      mockFastify.redis.del = jest.fn().mockResolvedValue(1);

      await cacheManager.invalidateMarketData(10000002, 34);

      expect(mockFastify.redis.del).toHaveBeenCalledWith('market:10000002:34');

      // Check metrics tracking
      const metrics = cacheManager.getMetrics();
      expect(metrics.invalidations).toBe(1);
    });

    it('should handle invalidation errors and track error metrics', async () => {
      mockFastify.redis.del = jest.fn().mockRejectedValue(new Error('Redis error'));

      await cacheManager.invalidateMarketData(10000002, 34);

      // Check error metrics tracking
      const metrics = cacheManager.getMetrics();
      expect(metrics.errors).toBe(1);
      expect(mockFastify.log.error).toHaveBeenCalled();
    });
  });

  describe('invalidateByPattern', () => {
    it('should invalidate multiple keys by pattern', async () => {
      const mockKeys = ['market:10000002:34', 'market:10000002:35'];
      mockFastify.redis.client.keys = jest.fn().mockResolvedValue(mockKeys);
      mockFastify.redis.client.del = jest.fn().mockResolvedValue(2);

      const result = await cacheManager.invalidateByPattern('market:10000002:*');

      expect(mockFastify.redis.client.keys).toHaveBeenCalledWith('market:10000002:*');
      expect(mockFastify.redis.client.del).toHaveBeenCalledWith(mockKeys);
      expect(result).toBe(2);

      // Check metrics tracking
      const metrics = cacheManager.getMetrics();
      expect(metrics.invalidations).toBe(2);
    });

    it('should return 0 when no keys match pattern', async () => {
      mockFastify.redis.client.keys = jest.fn().mockResolvedValue([]);

      const result = await cacheManager.invalidateByPattern('nonexistent:*');

      expect(result).toBe(0);
      expect(mockFastify.redis.client.del).not.toHaveBeenCalled();
    });
  });

  describe('getCacheStats', () => {
    it('should return comprehensive cache statistics', async () => {
      const mockKeys = [
        'market:10000002:34',
        'market:10000002:35',
        'history:10000002:34:30',
        'other:key',
      ];
      mockFastify.redis.client.keys = jest.fn().mockResolvedValue(mockKeys);
      mockFastify.redis.client.info = jest.fn().mockResolvedValue('used_memory_human:1.5M\n');

      const stats = await cacheManager.getCacheStats();

      expect(stats.totalKeys).toBe(4);
      expect(stats.marketDataKeys).toBe(2);
      expect(stats.historicalDataKeys).toBe(1);
      expect(stats.memoryUsage).toBe('1.5M');
      expect(stats.metrics).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      mockFastify.redis.client.keys = jest.fn().mockRejectedValue(new Error('Redis error'));

      const stats = await cacheManager.getCacheStats();

      expect(stats.totalKeys).toBe(0);
      expect(stats.marketDataKeys).toBe(0);
      expect(stats.historicalDataKeys).toBe(0);
      expect(mockFastify.log.error).toHaveBeenCalled();
    });
  });

  describe('metrics calculation', () => {
    it('should calculate hit rate correctly', async () => {
      // Simulate cache hits and misses
      mockFastify.redis.getWithFreshness = jest
        .fn()
        .mockResolvedValueOnce({ value: JSON.stringify(mockMarketData), isStale: false })
        .mockResolvedValueOnce({ value: null, isStale: false })
        .mockResolvedValueOnce({ value: JSON.stringify(mockMarketData), isStale: true });

      await cacheManager.getCachedMarketData(10000002, 34); // hit
      await cacheManager.getCachedMarketData(10000002, 35); // miss
      await cacheManager.getCachedMarketData(10000002, 36); // stale hit

      const metrics = cacheManager.getMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(1);
      expect(metrics.freshHits).toBe(1);
      expect(metrics.staleHits).toBe(1);
      expect(metrics.hitRate).toBeCloseTo(66.67, 1); // 2/3 * 100
      expect(metrics.staleRate).toBe(50); // 1/2 * 100
    });
  });

  describe('warmupCache', () => {
    it('should warm up cache with provided items', async () => {
      const items = [
        { regionId: 10000002, typeId: 34 },
        { regionId: 10000002, typeId: 35 },
      ];

      const mockFetchFunction = jest
        .fn()
        .mockResolvedValueOnce(mockMarketData)
        .mockResolvedValueOnce({ ...mockMarketData, typeId: 35 });

      const result = await cacheManager.warmupCache(items, mockFetchFunction);

      expect(result.warmed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockFetchFunction).toHaveBeenCalledTimes(2);
    });

    it('should handle warmup failures gracefully', async () => {
      const items = [
        { regionId: 10000002, typeId: 34 },
        { regionId: 10000002, typeId: 35 },
      ];

      const mockFetchFunction = jest
        .fn()
        .mockResolvedValueOnce(mockMarketData)
        .mockRejectedValueOnce(new Error('Fetch failed'));

      const result = await cacheManager.warmupCache(items, mockFetchFunction);

      expect(result.warmed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('10000002:35 - Fetch failed');
    });
  });
});
