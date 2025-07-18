import { AICacheManager } from '../../../src/cache/aiCache';
import { AIResponse } from '../../../../../shared/src/types';

// Mock Redis client
const mockRedis = {
  isOpen: false,
  connect: jest.fn(),
  get: jest.fn(),
  setEx: jest.fn(),
  keys: jest.fn(),
  del: jest.fn(),
  ttl: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedis),
}));

describe('AICacheManager', () => {
  let cache: AICacheManager;
  let mockResponse: AIResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new AICacheManager();

    mockResponse = {
      content: 'Test AI response content',
      confidence: 0.8,
      provider: 'test-provider',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      cached: false,
    };
  });

  describe('initialize', () => {
    it('should connect to Redis when not already connected', async () => {
      mockRedis.isOpen = false;
      await cache.initialize();
      expect(mockRedis.connect).toHaveBeenCalled();
    });

    it('should not connect when already connected', async () => {
      mockRedis.isOpen = true;
      await cache.initialize();
      expect(mockRedis.connect).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should return cached response when available', async () => {
      const cachedData = JSON.stringify(mockResponse);
      mockRedis.get.mockResolvedValue(cachedData);

      const result = await cache.get('test prompt', {}, 'test-provider');

      expect(result).toEqual({
        ...mockResponse,
        cached: true,
      });
      expect(mockRedis.get).toHaveBeenCalledWith(expect.any(String));
    });

    it('should return null when no cache entry exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cache.get('test prompt', {}, 'test-provider');

      expect(result).toBeNull();
    });

    it('should return null on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await cache.get('test prompt', {}, 'test-provider');

      expect(result).toBeNull();
    });

    it('should generate consistent cache keys for same input', async () => {
      mockRedis.get.mockResolvedValue(null);

      await cache.get('same prompt', { key: 'value' }, 'provider');
      await cache.get('same prompt', { key: 'value' }, 'provider');

      expect(mockRedis.get).toHaveBeenCalledTimes(2);
      expect(mockRedis.get).toHaveBeenNthCalledWith(1, expect.any(String));
      expect(mockRedis.get).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching(mockRedis.get.mock.calls[0][0])
      );
    });
  });

  describe('set', () => {
    it('should store response in cache with default TTL', async () => {
      await cache.set('test prompt', {}, 'test-provider', mockResponse);

      expect(mockRedis.setEx).toHaveBeenCalledWith(
        expect.any(String),
        3600, // default TTL
        JSON.stringify({ ...mockResponse, cached: false })
      );
    });

    it('should store response with custom TTL', async () => {
      const customTTL = 1800;
      await cache.set('test prompt', {}, 'test-provider', mockResponse, customTTL);

      expect(mockRedis.setEx).toHaveBeenCalledWith(
        expect.any(String),
        customTTL,
        expect.any(String)
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.setEx.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(
        cache.set('test prompt', {}, 'test-provider', mockResponse)
      ).resolves.toBeUndefined();
    });
  });

  describe('shouldCache', () => {
    it('should cache expensive responses', () => {
      const shouldCache = cache.shouldCache(mockResponse, 0.02); // > $0.01
      expect(shouldCache).toBe(true);
    });

    it('should cache long responses', () => {
      const longResponse = {
        ...mockResponse,
        content: 'A'.repeat(1500), // > 1000 characters
      };
      const shouldCache = cache.shouldCache(longResponse, 0.005);
      expect(shouldCache).toBe(true);
    });

    it('should cache high-confidence responses', () => {
      const highConfidenceResponse = {
        ...mockResponse,
        confidence: 0.9, // > 0.8
      };
      const shouldCache = cache.shouldCache(highConfidenceResponse, 0.005);
      expect(shouldCache).toBe(true);
    });

    it('should not cache short responses', () => {
      const shortResponse = {
        ...mockResponse,
        content: 'Short', // < 50 characters
        confidence: 0.5,
      };
      const shouldCache = cache.shouldCache(shortResponse, 0.005);
      expect(shouldCache).toBe(false);
    });

    it('should cache medium responses that meet other criteria', () => {
      const mediumResponse = {
        ...mockResponse,
        content: 'A'.repeat(100), // 100 characters
        confidence: 0.7,
      };
      const shouldCache = cache.shouldCache(mediumResponse, 0.005);
      expect(shouldCache).toBe(true); // Default case
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const mockKeys = ['ai_cache:key1', 'ai_cache:key2', 'ai_cache:key3'];
      const mockValue = JSON.stringify(mockResponse);

      mockRedis.keys.mockResolvedValue(mockKeys);
      mockRedis.get.mockResolvedValue(mockValue);

      const stats = await cache.getStats();

      expect(stats).toEqual({
        totalEntries: 3,
        estimatedSizeBytes: expect.any(Number),
        estimatedSizeMB: expect.any(Number),
        avgEntrySizeBytes: expect.any(Number),
      });

      expect(stats.totalEntries).toBe(3);
      expect(stats.estimatedSizeBytes).toBeGreaterThan(0);
      expect(stats.estimatedSizeMB).toBeGreaterThanOrEqual(0);
    });

    it('should handle Redis errors in stats', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const stats = await cache.getStats();

      expect(stats).toEqual({
        totalEntries: 0,
        estimatedSizeBytes: 0,
        estimatedSizeMB: 0,
        avgEntrySizeBytes: 0,
      });
    });
  });

  describe('cleanup', () => {
    it('should remove old cache entries', async () => {
      const mockKeys = ['ai_cache:old1', 'ai_cache:old2', 'ai_cache:new1'];
      mockRedis.keys.mockResolvedValue(mockKeys);

      // Mock TTL values: old entries have low TTL (high age), new entries have high TTL (low age)
      mockRedis.ttl
        .mockResolvedValueOnce(100) // old1: 3600-100 = 3500 seconds = ~1 hour old
        .mockResolvedValueOnce(200) // old2: 3600-200 = 3400 seconds = ~0.9 hours old
        .mockResolvedValueOnce(3500); // new1: 3600-3500 = 100 seconds = ~0.03 hours old

      const deletedCount = await cache.cleanup(0.5); // Remove entries older than 0.5 hours

      expect(deletedCount).toBe(2); // old1 and old2 should be deleted
      expect(mockRedis.del).toHaveBeenCalledTimes(2);
    });

    it('should handle cleanup errors gracefully', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const deletedCount = await cache.cleanup();

      expect(deletedCount).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all cache entries', async () => {
      const mockKeys = ['ai_cache:key1', 'ai_cache:key2'];
      mockRedis.keys.mockResolvedValue(mockKeys);

      await cache.clear();

      expect(mockRedis.del).toHaveBeenCalledWith(mockKeys);
    });

    it('should handle empty cache', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await cache.clear();

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should handle clear errors gracefully', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      // Should not throw
      await expect(cache.clear()).resolves.toBeUndefined();
    });
  });

  describe('close', () => {
    it('should close Redis connection when open', async () => {
      mockRedis.isOpen = true;
      await cache.close();
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should not close when connection is not open', async () => {
      mockRedis.isOpen = false;
      await cache.close();
      expect(mockRedis.quit).not.toHaveBeenCalled();
    });
  });
});
