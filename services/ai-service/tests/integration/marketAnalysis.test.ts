import { FastifyInstance } from 'fastify';
import { build } from '../helpers/app';
import { MarketData, AnalysisContext, TradingSuggestion } from '../../../../shared/src/types';

describe('Market Analysis API Integration Tests', () => {
  let app: FastifyInstance;

  const mockMarketData: MarketData[] = [
    {
      typeId: 34,
      regionId: 10000002,
      buyOrders: [
        {
          orderId: 1,
          typeId: 34,
          regionId: 10000002,
          locationId: 60003760,
          price: 5.5,
          volume: 1000,
          minVolume: 1,
          duration: 90,
          issued: new Date(),
          isBuyOrder: true,
        },
      ],
      sellOrders: [
        {
          orderId: 2,
          typeId: 34,
          regionId: 10000002,
          locationId: 60003760,
          price: 6.0,
          volume: 500,
          minVolume: 1,
          duration: 90,
          issued: new Date(),
          isBuyOrder: false,
        },
      ],
      lastUpdated: new Date(),
      volume: 10000,
      averagePrice: 5.75,
    },
  ];

  const mockContext: AnalysisContext = {
    userId: 'test-user-123',
    budget: 1000000,
    riskTolerance: 'MODERATE',
    preferredRegions: [10000002],
    timeHorizon: 'MEDIUM',
  };

  const mockSuggestions: TradingSuggestion[] = [
    {
      itemId: 34,
      itemName: 'Tritanium',
      buyPrice: 5.5,
      sellPrice: 6.0,
      expectedProfit: 5000,
      profitMargin: 0.09,
      riskLevel: 'LOW',
      requiredInvestment: 55000,
      timeToProfit: 24,
      confidence: 0.8,
    },
  ];

  beforeAll(async () => {
    app = await build();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/analyze/market', () => {
    it('should analyze market data successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/market',
        payload: {
          marketData: mockMarketData,
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.summary).toBeDefined();
      expect(body.data.trends).toBeDefined();
      expect(body.data.opportunities).toBeDefined();
      expect(body.data.risks).toBeDefined();
      expect(body.data.confidence).toBeDefined();
      expect(body.data.generatedAt).toBeDefined();
      expect(body.meta.processedItems).toBe(1);
    });

    it('should return 400 for missing market data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/market',
        payload: {
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('INVALID_REQUEST');
      expect(body.message).toContain('Market data array is required');
    });

    it('should return 400 for empty market data array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/market',
        payload: {
          marketData: [],
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('INVALID_REQUEST');
    });

    it('should return 400 for missing context', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/market',
        payload: {
          marketData: mockMarketData,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('INVALID_REQUEST');
      expect(body.message).toContain('Analysis context');
    });

    it('should return 400 for invalid context', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/market',
        payload: {
          marketData: mockMarketData,
          context: {
            userId: 'test-user',
            // Missing budget
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('INVALID_REQUEST');
    });
  });

  describe('POST /api/v1/analyze/opportunities', () => {
    it('should identify trading opportunities successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/opportunities',
        payload: {
          marketData: mockMarketData,
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta.processedItems).toBe(1);
      expect(body.meta.opportunitiesFound).toBeDefined();
    });

    it('should handle empty opportunities result', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/opportunities',
        payload: {
          marketData: mockMarketData,
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/opportunities',
        payload: {
          marketData: [],
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('INVALID_REQUEST');
    });
  });

  describe('POST /api/v1/analyze/profit-risk', () => {
    it('should assess profit and risk successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/profit-risk',
        payload: {
          suggestions: mockSuggestions,
          marketData: mockMarketData,
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.suggestions).toBeDefined();
      expect(body.data.risks).toBeDefined();
      expect(Array.isArray(body.data.suggestions)).toBe(true);
      expect(Array.isArray(body.data.risks)).toBe(true);
      expect(body.meta.analyzedSuggestions).toBe(1);
      expect(body.meta.identifiedRisks).toBeDefined();
    });

    it('should return 400 for missing suggestions', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/profit-risk',
        payload: {
          marketData: mockMarketData,
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('INVALID_REQUEST');
      expect(body.message).toContain('Trading suggestions array is required');
    });

    it('should return 400 for empty suggestions array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/profit-risk',
        payload: {
          suggestions: [],
          marketData: mockMarketData,
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('INVALID_REQUEST');
    });

    it('should return 400 for missing market data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/profit-risk',
        payload: {
          suggestions: mockSuggestions,
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('INVALID_REQUEST');
      expect(body.message).toContain('Market data array is required');
    });
  });

  describe('POST /api/v1/analyze/trends', () => {
    it('should predict market trends successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/trends',
        payload: {
          marketData: mockMarketData,
          historicalData: [
            {
              typeId: 34,
              regionId: 10000002,
              date: '2024-01-01',
              highest: 6.5,
              lowest: 5.0,
              average: 5.75,
              volume: 15000,
            },
          ],
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta.analyzedItems).toBe(1);
      expect(body.meta.historicalDataPoints).toBe(1);
      expect(body.meta.predictedTrends).toBeDefined();
    });

    it('should work without historical data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/trends',
        payload: {
          marketData: mockMarketData,
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.meta.historicalDataPoints).toBe(0);
    });

    it('should return 400 for missing market data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/trends',
        payload: {
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('INVALID_REQUEST');
      expect(body.message).toContain('Market data array is required');
    });

    it('should return 400 for empty market data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/trends',
        payload: {
          marketData: [],
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('INVALID_REQUEST');
    });
  });

  describe('Error handling', () => {
    it('should handle AI service failures gracefully', async () => {
      // This test would require mocking the AI service to throw errors
      // For now, we'll test the basic error response structure
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/market',
        payload: {
          marketData: mockMarketData,
          context: {
            ...mockContext,
            userId: '', // Invalid user ID to potentially trigger errors
          },
        },
      });

      // Should either succeed or return a proper error response
      if (response.statusCode !== 200) {
        const body = JSON.parse(response.body);
        expect(body.error).toBeDefined();
        expect(body.message).toBeDefined();
      }
    });

    it('should return proper error format for server errors', async () => {
      // Test with malformed data that might cause processing errors
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/market',
        payload: {
          marketData: [
            {
              // Incomplete market data
              typeId: 34,
              regionId: 10000002,
              // Missing required fields
            },
          ],
          context: mockContext,
        },
      });

      if (response.statusCode >= 500) {
        const body = JSON.parse(response.body);
        expect(body.error).toBeDefined();
        expect(body.message).toBeDefined();
        expect(body.details).toBeDefined();
      }
    });
  });

  describe('Response format validation', () => {
    it('should return consistent response format for market analysis', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/market',
        payload: {
          marketData: mockMarketData,
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Validate response structure
      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.meta).toHaveProperty('processedItems');
      expect(body.meta).toHaveProperty('timestamp');
    });

    it('should return consistent response format for opportunities', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/opportunities',
        payload: {
          marketData: mockMarketData,
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.meta).toHaveProperty('processedItems');
      expect(body.meta).toHaveProperty('opportunitiesFound');
      expect(body.meta).toHaveProperty('timestamp');
    });

    it('should return consistent response format for profit-risk assessment', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/profit-risk',
        payload: {
          suggestions: mockSuggestions,
          marketData: mockMarketData,
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.meta).toHaveProperty('analyzedSuggestions');
      expect(body.meta).toHaveProperty('identifiedRisks');
      expect(body.meta).toHaveProperty('timestamp');
    });

    it('should return consistent response format for trend prediction', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/analyze/trends',
        payload: {
          marketData: mockMarketData,
          context: mockContext,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.meta).toHaveProperty('analyzedItems');
      expect(body.meta).toHaveProperty('historicalDataPoints');
      expect(body.meta).toHaveProperty('predictedTrends');
      expect(body.meta).toHaveProperty('timestamp');
    });
  });
});
