import Fastify, { FastifyInstance } from 'fastify';
import { tradingRoutes } from '../../routes/tradingRoutes';

describe('Trading Controller Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await app.register(tradingRoutes, { prefix: '/api/v1/trading' });
  });

  afterAll(async () => {
    await app.close();
  });

  const mockMarketData = [
    {
      typeId: 34,
      regionId: 10000002,
      buyOrders: [
        {
          orderId: 1,
          typeId: 34,
          regionId: 10000002,
          locationId: 60003760,
          price: 100,
          volume: 1000,
          minVolume: 1,
          duration: 90,
          issued: new Date().toISOString(),
          isBuyOrder: true,
        },
      ],
      sellOrders: [
        {
          orderId: 2,
          typeId: 34,
          regionId: 10000002,
          locationId: 60003760,
          price: 80,
          volume: 800,
          minVolume: 1,
          duration: 90,
          issued: new Date().toISOString(),
          isBuyOrder: false,
        },
      ],
      lastUpdated: new Date().toISOString(),
      volume: 1800,
      averagePrice: 90,
    },
  ];

  describe('POST /api/v1/trading/suggestions', () => {
    it('should generate trading suggestions successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/trading/suggestions',
        payload: {
          userId: 'test-user',
          budget: 100000,
          marketData: mockMarketData,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('suggestions');
      expect(data.data).toHaveProperty('count');
      expect(data.data).toHaveProperty('totalPotentialProfit');
      expect(data.data).toHaveProperty('totalRequiredInvestment');
      expect(Array.isArray(data.data.suggestions)).toBe(true);
    });

    it('should return 400 for missing required parameters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/trading/suggestions',
        payload: {
          userId: 'test-user',
          // Missing budget and marketData
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.error).toContain('Missing required parameters');
    });

    it('should return 400 for invalid budget', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/trading/suggestions',
        payload: {
          userId: 'test-user',
          budget: -1000,
          marketData: mockMarketData,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for empty market data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/trading/suggestions',
        payload: {
          userId: 'test-user',
          budget: 100000,
          marketData: [],
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.payload);
      expect(data.error).toContain('Market data must be a non-empty array');
    });

    it('should handle user profile in request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/trading/suggestions',
        payload: {
          userId: 'test-user',
          budget: 100000,
          marketData: mockMarketData,
          userProfile: {
            userId: 'test-user',
            tradingExperience: 'BEGINNER',
            riskTolerance: 'CONSERVATIVE',
            availableBudget: 100000,
            preferredMarkets: [10000002],
            tradingGoals: ['steady income'],
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/v1/trading/plans', () => {
    it('should create trading plan successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/trading/plans',
        payload: {
          userId: 'test-user',
          parameters: {
            budget: 100000,
            riskTolerance: 'MODERATE',
            preferredRegions: [10000002],
            maxInvestmentPerTrade: 30000,
          },
          marketData: mockMarketData,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('plan');
      expect(data.data).toHaveProperty('metrics');
      expect(data.data.plan).toHaveProperty('id');
      expect(data.data.plan).toHaveProperty('userId');
      expect(data.data.plan).toHaveProperty('budget');
      expect(data.data.plan).toHaveProperty('suggestions');
    });

    it('should return 400 for missing parameters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/trading/plans',
        payload: {
          userId: 'test-user',
          // Missing parameters and marketData
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for invalid budget in parameters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/trading/plans',
        payload: {
          userId: 'test-user',
          parameters: {
            budget: 0,
            riskTolerance: 'MODERATE',
          },
          marketData: mockMarketData,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PUT /api/v1/trading/users/:userId/budget', () => {
    it('should update budget successfully', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/trading/users/test-user/budget',
        payload: {
          budget: 150000,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Budget updated successfully');
    });

    it('should return 400 for invalid budget', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/trading/users/test-user/budget',
        payload: {
          budget: -1000,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for missing userId', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/trading/users//budget',
        payload: {
          budget: 150000,
        },
      });

      expect(response.statusCode).toBe(404); // Route not found due to empty userId
    });
  });

  describe('POST /api/v1/trading/users/:userId/trades', () => {
    it('should track trade execution successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/trading/users/test-user/trades',
        payload: {
          id: 'trade-1',
          userId: 'test-user',
          suggestionId: 'suggestion-1',
          itemId: 34,
          buyPrice: 80,
          sellPrice: 100,
          quantity: 100,
          executedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          actualProfit: 2000,
          status: 'COMPLETED',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Trade execution tracked successfully');
    });

    it('should return 400 for invalid trade data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/trading/users/test-user/trades',
        payload: {
          id: 'trade-1',
          // Missing required fields
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/trading/analysis', () => {
    it('should provide detailed analysis successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/trading/analysis',
        payload: {
          itemId: 34,
          itemName: 'Tritanium',
          buyPrice: 80,
          sellPrice: 100,
          expectedProfit: 2000,
          profitMargin: 0.25,
          riskLevel: 'MEDIUM',
          requiredInvestment: 8000,
          timeToProfit: 24,
          confidence: 0.75,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('profitMetrics');
      expect(data.data).toHaveProperty('validation');
      expect(data.data).toHaveProperty('riskAnalysis');
    });

    it('should return 400 for invalid suggestion data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/trading/analysis',
        payload: {
          itemId: 34,
          // Missing required fields
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/trading/portfolio/metrics', () => {
    it('should calculate portfolio metrics successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/trading/portfolio/metrics',
        payload: {
          id: 'test-plan',
          userId: 'test-user',
          budget: 100000,
          riskTolerance: 'MODERATE',
          suggestions: [
            {
              itemId: 34,
              itemName: 'Tritanium',
              buyPrice: 80,
              sellPrice: 100,
              expectedProfit: 2000,
              profitMargin: 0.25,
              riskLevel: 'MEDIUM',
              requiredInvestment: 8000,
              timeToProfit: 24,
              confidence: 0.75,
            },
          ],
          createdAt: new Date().toISOString(),
          status: 'ACTIVE',
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('totalInvestment');
      expect(data.data).toHaveProperty('totalExpectedProfit');
      expect(data.data).toHaveProperty('averageROI');
      expect(data.data).toHaveProperty('diversificationScore');
    });

    it('should return 400 for invalid trading plan', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/trading/portfolio/metrics',
        payload: {
          id: 'test-plan',
          // Missing required fields
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/trading/health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/trading/health',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('trading-service');
      expect(data.timestamp).toBeDefined();
    });
  });
});
