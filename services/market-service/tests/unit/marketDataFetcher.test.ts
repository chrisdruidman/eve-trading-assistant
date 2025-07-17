import { MarketDataFetcher } from '../../src/services/marketDataFetcher';
import { EsiClient } from '../../src/clients/esiClient';
import { MarketDataRepository } from '../../src/models/marketDataRepository';
import { CacheManager } from '../../src/utils/cacheManager';
import { FastifyInstance } from 'fastify';
import { MarketData, MarketOrder, PriceHistory } from '../../../../shared/src/types';
import { jest } from '@jest/globals';

// Mock the dependencies
jest.mock('../../src/clients/esiClient');
jest.mock('../../src/models/marketDataRepository');
jest.mock('../../src/utils/cacheManager');

const MockedEsiClient = EsiClient as jest.MockedClass<typeof EsiClient>;
const MockedMarketDataRepository = MarketDataRepository as jest.MockedClass<
  typeof MarketDataRepository
>;
const MockedCacheManager = CacheManager as jest.MockedClass<typeof CacheManager>;

// Mock fastify instance
const mockFastify = {
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
} as unknown as FastifyInstance;

describe('MarketDataFetcher', () => {
  let fetcher: MarketDataFetcher;
  let mockEsiClient: jest.Mocked<EsiClient>;
  let mockRepository: jest.Mocked<MarketDataRepository>;
  let mockCacheManager: jest.Mocked<CacheManager>;

  const mockMarketOrders: MarketOrder[] = [
    {
      orderId: 123456,
      typeId: 34,
      regionId: 10000002,
      locationId: 60003760,
      price: 1000.5,
      volume: 50,
      minVolume: 1,
      duration: 90,
      issued: new Date('2023-01-01T12:00:00Z'),
      isBuyOrder: false,
    },
    {
      orderId: 789012,
      typeId: 34,
      regionId: 10000002,
      locationId: 60003760,
      price: 950.25,
      volume: 150,
      minVolume: 1,
      duration: 30,
      issued: new Date('2023-01-01T10:00:00Z'),
      isBuyOrder: true,
    },
  ];

  const mockMarketData: MarketData = {
    typeId: 34,
    regionId: 10000002,
    buyOrders: [mockMarketOrders[1]!],
    sellOrders: [mockMarketOrders[0]!],
    lastUpdated: new Date('2023-01-01T12:00:00Z'),
    volume: 200,
    averagePrice: 975.375,
  };

  const mockPriceHistory: PriceHistory[] = [
    {
      typeId: 34,
      regionId: 10000002,
      date: new Date('2023-01-01'),
      highest: 1100.0,
      lowest: 900.0,
      average: 1000.0,
      volume: 50000,
      orderCount: 25,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockEsiClient = new MockedEsiClient(mockFastify) as jest.Mocked<EsiClient>;
    mockRepository = new MockedMarketDataRepository(
      mockFastify
    ) as jest.Mocked<MarketDataRepository>;
    mockCacheManager = new MockedCacheManager(mockFastify) as jest.Mocked<CacheManager>;

    fetcher = new MarketDataFetcher(mockFastify);

    // Replace the private instances with our mocks
    (fetcher as any).esiClient = mockEsiClient;
    (fetcher as any).repository = mockRepository;
    (fetcher as any).cacheManager = mockCacheManager;
  });

  describe('getMarketData', () => {
    it('should return cached data when available and fresh', async () => {
      const cachedData = {
        data: mockMarketData,
        isStale: false,
      };

      mockCacheManager.getCachedMarketData.mockResolvedValue(cachedData);

      const result = await fetcher.getMarketData(10000002, 34);

      expect(result.data).toEqual(mockMarketData);
      expect(result.fromCache).toBe(true);
      expect(result.isStale).toBe(false);
      expect(mockEsiClient.getMarketOrders).not.toHaveBeenCalled();
    });

    it('should fetch fresh data when cache is stale and maxStaleTime exceeded', async () => {
      const staleData = {
        data: {
          ...mockMarketData,
          lastUpdated: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
        },
        isStale: true,
      };

      mockCacheManager.getCachedMarketData.mockResolvedValue(staleData);
      mockEsiClient.getMarketOrders.mockResolvedValue(mockMarketOrders);
      mockCacheManager.cacheMarketData.mockResolvedValue();
      mockRepository.saveMarketData.mockResolvedValue();

      const result = await fetcher.getMarketData(10000002, 34, { maxStaleTime: 600 }); // 10 minutes

      expect(result.fromCache).toBe(false);
      expect(result.isStale).toBe(false);
      expect(mockEsiClient.getMarketOrders).toHaveBeenCalledWith(10000002, 34);
      expect(mockCacheManager.cacheMarketData).toHaveBeenCalled();
      expect(mockRepository.saveMarketData).toHaveBeenCalled();
    });

    it('should return stale cached data when ESI fails', async () => {
      const staleData = {
        data: mockMarketData,
        isStale: true,
      };

      mockCacheManager.getCachedMarketData
        .mockResolvedValueOnce({ data: null, isStale: false }) // First call returns no cache
        .mockResolvedValueOnce(staleData); // Second call returns stale data

      mockEsiClient.getMarketOrders.mockRejectedValue(new Error('ESI unavailable'));

      const result = await fetcher.getMarketData(10000002, 34);

      expect(result.data).toEqual(mockMarketData);
      expect(result.fromCache).toBe(true);
      expect(result.isStale).toBe(true);
    });

    it('should return database data as last resort when cache and ESI fail', async () => {
      mockCacheManager.getCachedMarketData.mockResolvedValue({ data: null, isStale: false });
      mockEsiClient.getMarketOrders.mockRejectedValue(new Error('ESI unavailable'));
      mockRepository.getMarketData.mockResolvedValue(mockMarketData);

      const result = await fetcher.getMarketData(10000002, 34);

      expect(result.data).toEqual(mockMarketData);
      expect(result.fromCache).toBe(false);
      expect(result.isStale).toBe(true);
    });

    it('should force refresh when forceRefresh option is true', async () => {
      mockCacheManager.getCachedMarketData.mockResolvedValue({
        data: mockMarketData,
        isStale: false,
      });
      mockEsiClient.getMarketOrders.mockResolvedValue(mockMarketOrders);
      mockCacheManager.cacheMarketData.mockResolvedValue();
      mockRepository.saveMarketData.mockResolvedValue();

      const result = await fetcher.getMarketData(10000002, 34, { forceRefresh: true });

      expect(result.fromCache).toBe(false);
      expect(mockEsiClient.getMarketOrders).toHaveBeenCalled();
      expect(mockCacheManager.getCachedMarketData).not.toHaveBeenCalled();
    });
  });

  describe('getHistoricalData', () => {
    it('should return cached historical data when available and fresh', async () => {
      const cachedData = {
        data: mockPriceHistory,
        isStale: false,
      };

      mockCacheManager.getCachedHistoricalData.mockResolvedValue(cachedData);

      const result = await fetcher.getHistoricalData(10000002, 34, 30);

      expect(result.data).toEqual(mockPriceHistory);
      expect(result.fromCache).toBe(true);
      expect(result.isStale).toBe(false);
      expect(mockEsiClient.getMarketHistory).not.toHaveBeenCalled();
    });

    it('should fetch fresh historical data when cache is stale', async () => {
      mockCacheManager.getCachedHistoricalData.mockResolvedValue({
        data: null,
        isStale: false,
      });
      mockEsiClient.getMarketHistory.mockResolvedValue(mockPriceHistory);
      mockCacheManager.cacheHistoricalData.mockResolvedValue();
      mockRepository.savePriceHistory.mockResolvedValue();

      const result = await fetcher.getHistoricalData(10000002, 34, 30);

      expect(result.fromCache).toBe(false);
      expect(result.isStale).toBe(false);
      expect(mockEsiClient.getMarketHistory).toHaveBeenCalledWith(10000002, 34);
      expect(mockCacheManager.cacheHistoricalData).toHaveBeenCalled();
      expect(mockRepository.savePriceHistory).toHaveBeenCalledTimes(mockPriceHistory.length);
    });
  });

  describe('refreshStaleData', () => {
    it('should refresh stale market data items', async () => {
      const staleItems = [
        { typeId: 34, regionId: 10000002 },
        { typeId: 35, regionId: 10000002 },
      ];

      mockRepository.getStaleMarketData.mockResolvedValue(staleItems);
      mockEsiClient.getMarketOrders.mockResolvedValue(mockMarketOrders);
      mockCacheManager.cacheMarketData.mockResolvedValue();
      mockRepository.saveMarketData.mockResolvedValue();

      const result = await fetcher.refreshStaleData(10);

      expect(result.refreshed).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockRepository.getStaleMarketData).toHaveBeenCalledWith(10);
    });

    it('should handle failures during refresh', async () => {
      const staleItems = [
        { typeId: 34, regionId: 10000002 },
        { typeId: 35, regionId: 10000002 },
      ];

      mockRepository.getStaleMarketData.mockResolvedValue(staleItems);
      mockEsiClient.getMarketOrders
        .mockResolvedValueOnce(mockMarketOrders) // First item succeeds
        .mockRejectedValueOnce(new Error('ESI error')); // Second item fails

      mockCacheManager.cacheMarketData.mockResolvedValue();
      mockRepository.saveMarketData.mockResolvedValue();

      const result = await fetcher.refreshStaleData(10);

      expect(result.refreshed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('10000002:35');
    });
  });

  describe('getEsiStatus', () => {
    it('should return ESI connection and rate limit status', async () => {
      mockEsiClient.validateConnection.mockResolvedValue(true);
      mockEsiClient.getRateLimitStatus.mockReturnValue({
        remain: 95,
        reset: 60,
      });
      mockEsiClient.getCircuitBreakerStatus.mockReturnValue({
        isOpen: false,
        failures: 0,
        maxFailures: 5,
      });

      const result = await fetcher.getEsiStatus();

      expect(result.connected).toBe(true);
      expect(result.rateLimit.remain).toBe(95);
      expect(result.rateLimit.resetIn).toBe(60);
      expect(result.circuitBreaker.isOpen).toBe(false);
      expect(result.circuitBreaker.failures).toBe(0);
    });
  });
});
