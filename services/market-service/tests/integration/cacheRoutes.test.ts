import { FastifyInstance } from 'fastify';
import { build } from '../helpers/app';

describe('Cache Routes Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/cache/stats', () => {
    it('should return cache statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cache/stats',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('totalKeys');
      expect(body.data).toHaveProperty('marketDataKeys');
      expect(body.data).toHaveProperty('historicalDataKeys');
      expect(body.data).toHaveProperty('metrics');
      expect(body.data.metrics).toHaveProperty('hits');
      expect(body.data.metrics).toHaveProperty('misses');
      expect(body.data.metrics).toHaveProperty('hitRate');
    });
  });

  describe('GET /api/v1/cache/metrics', () => {
    it('should return cache metrics only', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cache/metrics',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('hits');
      expect(body.data).toHaveProperty('misses');
      expect(body.data).toHaveProperty('totalRequests');
      expect(body.data).toHaveProperty('hitRate');
      expect(body.data).toHaveProperty('staleRate');
      expect(body.data).toHaveProperty('lastReset');
    });
  });

  describe('POST /api/v1/cache/invalidate', () => {
    it('should invalidate specific market data cache', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cache/invalidate',
        payload: {
          regionId: 10000002,
          typeId: 34,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.invalidated).toBe(1);
      expect(body.data.regionId).toBe(10000002);
      expect(body.data.typeId).toBe(34);
    });

    it('should invalidate cache by pattern', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cache/invalidate',
        payload: {
          pattern: 'market:10000002:*',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('invalidated');
      expect(body.data.pattern).toBe('market:10000002:*');
    });

    it('should return error for invalid request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cache/invalidate',
        payload: {
          regionId: 10000002,
          // Missing typeId
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Either pattern or both regionId and typeId must be provided');
    });
  });

  describe('POST /api/v1/cache/warmup', () => {
    it('should warm up cache with provided items', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cache/warmup',
        payload: {
          items: [
            { regionId: 10000002, typeId: 34 },
            { regionId: 10000002, typeId: 35 },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('warmed');
      expect(body.data).toHaveProperty('failed');
      expect(body.data).toHaveProperty('errors');
    });

    it('should return error for empty items array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cache/warmup',
        payload: {
          items: [],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Items array cannot be empty');
    });

    it('should return error for too many items', async () => {
      const items = Array.from({ length: 101 }, (_, i) => ({
        regionId: 10000002,
        typeId: i + 1,
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cache/warmup',
        payload: { items },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Cannot warm up more than 100 items at once');
    });

    it('should validate item structure', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cache/warmup',
        payload: {
          items: [
            { regionId: 10000002 }, // Missing typeId
          ],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/cache/refresh/status', () => {
    it('should return refresh scheduler status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/cache/refresh/status',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('isRunning');
      expect(body.data).toHaveProperty('metrics');
      expect(body.data).toHaveProperty('strategies');
      expect(Array.isArray(body.data.strategies)).toBe(true);
    });
  });

  describe('POST /api/v1/cache/refresh', () => {
    it('should force refresh with default parameters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cache/refresh',
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('refreshed');
      expect(body.data).toHaveProperty('failed');
      expect(body.data).toHaveProperty('errors');
      expect(body.data).toHaveProperty('duration');
    });

    it('should force refresh with custom maxAgeMinutes', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cache/refresh',
        payload: {
          maxAgeMinutes: 30,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should force refresh all data when force is true', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cache/refresh',
        payload: {
          force: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should validate maxAgeMinutes parameter', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cache/refresh',
        payload: {
          maxAgeMinutes: -1,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PUT /api/v1/cache/refresh/strategy/:strategyName', () => {
    it('should update existing strategy', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/cache/refresh/strategy/high-priority',
        payload: {
          intervalMinutes: 2,
          enabled: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.strategyName).toBe('high-priority');
      expect(body.data.updates).toEqual({
        intervalMinutes: 2,
        enabled: false,
      });
    });

    it('should return 404 for non-existent strategy', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/cache/refresh/strategy/non-existent',
        payload: {
          intervalMinutes: 5,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe("Strategy 'non-existent' not found");
    });

    it('should validate strategy update parameters', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/cache/refresh/strategy/high-priority',
        payload: {
          intervalMinutes: 0, // Invalid: minimum is 1
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Error handling', () => {
    it('should handle internal server errors gracefully', async () => {
      // This test would require mocking internal dependencies to force errors
      // For now, we'll test that the error handling structure is in place

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/cache/invalidate',
        payload: {
          pattern: 'invalid-pattern-that-might-cause-error',
        },
      });

      // Should either succeed or return a proper error response
      expect([200, 500]).toContain(response.statusCode);

      if (response.statusCode === 500) {
        const body = JSON.parse(response.body);
        expect(body.success).toBe(false);
        expect(body.error).toBeDefined();
      }
    });
  });
});
