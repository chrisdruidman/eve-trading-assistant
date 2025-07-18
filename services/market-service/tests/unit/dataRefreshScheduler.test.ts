import { FastifyInstance } from 'fastify';
import { DataRefreshScheduler } from '../../src/services/dataRefreshScheduler';

const mockFastify = {
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
} as unknown as FastifyInstance;

// Mock MarketDataFetcher
const mockMarketDataFetcher = {
  refreshStaleData: jest.fn(),
};

// Mock CacheManager
const mockCacheManager = {
  getMetrics: jest.fn(),
};

// Mock the imports
jest.mock('../../src/services/marketDataFetcher', () => ({
  MarketDataFetcher: jest.fn().mockImplementation(() => mockMarketDataFetcher),
}));

jest.mock('../../src/utils/cacheManager', () => ({
  CacheManager: jest.fn().mockImplementation(() => mockCacheManager),
}));

describe('DataRefreshScheduler', () => {
  let scheduler: DataRefreshScheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    scheduler = new DataRefreshScheduler(mockFastify);

    // Reset mock implementations
    mockMarketDataFetcher.refreshStaleData.mockResolvedValue({
      refreshed: 5,
      failed: 1,
      errors: ['10000002:34 - ESI error'],
    });

    mockCacheManager.getMetrics.mockReturnValue({
      hits: 100,
      misses: 20,
      totalRequests: 120,
      hitRate: 83.33,
    });
  });

  afterEach(() => {
    scheduler.stop();
    jest.useRealTimers();
  });

  describe('start and stop', () => {
    it('should start the scheduler successfully', () => {
      expect(scheduler.getStatus().isRunning).toBe(false);

      scheduler.start(5);

      expect(scheduler.getStatus().isRunning).toBe(true);
      expect(mockFastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          intervalMinutes: 5,
          strategies: expect.any(Array),
        }),
        'Starting intelligent data refresh scheduler'
      );
    });

    it('should not start if already running', () => {
      scheduler.start(5);
      const firstCallCount = (mockFastify.log.info as jest.Mock).mock.calls.length;

      scheduler.start(5);

      expect(mockFastify.log.warn).toHaveBeenCalledWith(
        'Data refresh scheduler is already running'
      );
      // Should not have called info again
      expect((mockFastify.log.info as jest.Mock).mock.calls.length).toBe(firstCallCount);
    });

    it('should stop the scheduler successfully', () => {
      scheduler.start(5);
      expect(scheduler.getStatus().isRunning).toBe(true);

      scheduler.stop();

      expect(scheduler.getStatus().isRunning).toBe(false);
      expect(mockFastify.log.info).toHaveBeenCalledWith('Stopping data refresh scheduler');
    });

    it('should handle stop when not running', () => {
      expect(scheduler.getStatus().isRunning).toBe(false);

      scheduler.stop(); // Should not throw

      expect(scheduler.getStatus().isRunning).toBe(false);
    });
  });

  describe('scheduled refresh execution', () => {
    it('should execute refresh after initial delay', async () => {
      scheduler.start(5);

      // Fast-forward past the initial 30-second delay
      jest.advanceTimersByTime(31000);

      // Wait for async operations to complete
      await new Promise(resolve => setImmediate(resolve));

      expect(mockMarketDataFetcher.refreshStaleData).toHaveBeenCalled();
      expect(mockFastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshed: 5,
          failed: 1,
          errorCount: 1,
          duration: expect.any(Number),
        }),
        'Completed intelligent scheduled data refresh'
      );
    });

    it('should execute refresh on interval', async () => {
      scheduler.start(1); // 1 minute interval

      // Fast-forward past initial delay
      jest.advanceTimersByTime(31000);
      await new Promise(resolve => setImmediate(resolve));

      expect(mockMarketDataFetcher.refreshStaleData).toHaveBeenCalledTimes(1);

      // Fast-forward by interval
      jest.advanceTimersByTime(60000); // 1 minute
      await new Promise(resolve => setImmediate(resolve));

      expect(mockMarketDataFetcher.refreshStaleData).toHaveBeenCalledTimes(2);
    });

    it('should handle refresh errors gracefully', async () => {
      mockMarketDataFetcher.refreshStaleData.mockRejectedValue(new Error('Refresh failed'));

      scheduler.start(5);

      // Fast-forward past the initial delay
      jest.advanceTimersByTime(31000);
      await new Promise(resolve => setImmediate(resolve));

      expect(mockFastify.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Refresh failed',
          duration: expect.any(Number),
        }),
        'Intelligent scheduled data refresh failed'
      );
    });

    it('should log warnings for refresh errors', async () => {
      mockMarketDataFetcher.refreshStaleData.mockResolvedValue({
        refreshed: 3,
        failed: 2,
        errors: ['10000002:34 - ESI error', '10000002:35 - Timeout'],
      });

      scheduler.start(5);

      // Fast-forward past the initial delay
      jest.advanceTimersByTime(31000);
      await new Promise(resolve => setImmediate(resolve));

      expect(mockFastify.log.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: ['10000002:34 - ESI error', '10000002:35 - Timeout'],
          totalErrors: 2,
        }),
        'Some items failed to refresh during scheduled refresh'
      );
    });
  });

  describe('metrics tracking', () => {
    it('should track successful refresh metrics', async () => {
      scheduler.start(5);

      // Fast-forward past the initial delay
      jest.advanceTimersByTime(31000);
      await new Promise(resolve => setImmediate(resolve));

      const metrics = scheduler.getMetrics();
      expect(metrics.totalRefreshes).toBe(1);
      expect(metrics.successfulRefreshes).toBe(1);
      expect(metrics.failedRefreshes).toBe(0);
      expect(metrics.itemsRefreshed).toBe(5);
      expect(metrics.itemsFailed).toBe(1);
      expect(metrics.lastRefreshAt).toBeInstanceOf(Date);
      expect(metrics.averageRefreshTime).toBeGreaterThan(0);
    });

    it('should track failed refresh metrics', async () => {
      mockMarketDataFetcher.refreshStaleData.mockRejectedValue(new Error('Refresh failed'));

      scheduler.start(5);

      // Fast-forward past the initial delay
      jest.advanceTimersByTime(31000);
      await new Promise(resolve => setImmediate(resolve));

      const metrics = scheduler.getMetrics();
      expect(metrics.totalRefreshes).toBe(1);
      expect(metrics.successfulRefreshes).toBe(0);
      expect(metrics.failedRefreshes).toBe(1);
      expect(metrics.itemsRefreshed).toBe(0);
      expect(metrics.itemsFailed).toBe(0);
    });
  });

  describe('strategy management', () => {
    it('should update strategy successfully', () => {
      const result = scheduler.updateStrategy('high-priority', {
        intervalMinutes: 2,
        enabled: false,
      });

      expect(result).toBe(true);
      expect(mockFastify.log.info).toHaveBeenCalledWith(
        {
          strategyName: 'high-priority',
          updates: {
            intervalMinutes: 2,
            enabled: false,
          },
        },
        'Updated refresh strategy'
      );
    });

    it('should return false for non-existent strategy', () => {
      const result = scheduler.updateStrategy('non-existent', {
        intervalMinutes: 2,
      });

      expect(result).toBe(false);
    });

    it('should return current status with strategies', () => {
      const status = scheduler.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.strategies).toHaveLength(3);
      expect(status.strategies[0]?.name).toBe('high-priority');
      expect(status.strategies[1]?.name).toBe('medium-priority');
      expect(status.strategies[2]?.name).toBe('low-priority');
      expect(status.metrics).toBeDefined();
    });
  });

  describe('forceRefresh', () => {
    it('should execute forced refresh successfully', async () => {
      const result = await scheduler.forceRefresh(15);

      expect(mockMarketDataFetcher.refreshStaleData).toHaveBeenCalledWith(15);
      expect(result.refreshed).toBe(5);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should use maxAge 0 when not specified', async () => {
      await scheduler.forceRefresh();

      expect(mockMarketDataFetcher.refreshStaleData).toHaveBeenCalledWith(0);
    });

    it('should handle forced refresh errors', async () => {
      mockMarketDataFetcher.refreshStaleData.mockRejectedValue(new Error('Force refresh failed'));

      await expect(scheduler.forceRefresh()).rejects.toThrow('Force refresh failed');

      expect(mockFastify.log.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Force refresh failed',
          duration: expect.any(Number),
        }),
        'Forced data refresh failed'
      );
    });
  });

  describe('metrics logging', () => {
    it('should log metrics periodically', async () => {
      scheduler.start(5);

      // Fast-forward past metrics interval (5 minutes)
      jest.advanceTimersByTime(300000);
      await new Promise(resolve => setImmediate(resolve));

      expect(mockCacheManager.getMetrics).toHaveBeenCalled();
      expect(mockFastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          refreshMetrics: expect.any(Object),
          cacheMetrics: expect.any(Object),
        }),
        'Data refresh and cache metrics'
      );
    });
  });
});
