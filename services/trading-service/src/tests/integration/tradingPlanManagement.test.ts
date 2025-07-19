import { FastifyInstance } from 'fastify';
import { build } from '../helpers/app';
import { TradingPlanParams, MarketData } from '@shared/types';

describe('Trading Plan Management Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await build();
  });

  afterAll(async () => {
    await app.close();
  });

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
          price: 5.0,
          volume: 1000,
          minVolume: 1,
          duration: 90,
          issued: new Date(),
          isBuyOrder: false,
        },
      ],
      lastUpdated: new Date(),
      volume: 2000,
      averagePrice: 5.25,
    },
  ];

  describe('POST /plans', () => {
    it('should create a trading plan successfully', async () => {
      const userId = 'test-user-123';
      const parameters: TradingPlanParams & { name: string } = {
        name: 'Test Trading Plan',
        budget: 1000000,
        riskTolerance: 'MODERATE',
        preferredRegions: [10000002],
        maxInvestmentPerTrade: 250000,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/plans',
        payload: {
          userId,
          parameters,
          marketData: mockMarketData,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.plan).toBeDefined();
      expect(body.data.plan.userId).toBe(userId);
      expect(body.data.plan.budget).toBe(parameters.budget);
      expect(body.data.plan.riskTolerance).toBe(parameters.riskTolerance);
      expect(body.data.metrics).toBeDefined();
    });

    it('should return 400 for missing required parameters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/plans',
        payload: {
          userId: 'test-user-123',
          // Missing parameters and marketData
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Missing required parameters');
    });

    it('should return 400 for invalid budget', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/plans',
        payload: {
          userId: 'test-user-123',
          parameters: {
            name: 'Test Plan',
            budget: -1000,
            riskTolerance: 'MODERATE',
          },
          marketData: mockMarketData,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Budget must be greater than 0');
    });

    it('should return 400 for missing plan name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/plans',
        payload: {
          userId: 'test-user-123',
          parameters: {
            name: '',
            budget: 1000000,
            riskTolerance: 'MODERATE',
          },
          marketData: mockMarketData,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Trading plan name is required');
    });
  });

  describe('GET /plans/:planId', () => {
    let createdPlanId: string;

    beforeAll(async () => {
      // Create a plan first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/plans',
        payload: {
          userId: 'test-user-123',
          parameters: {
            name: 'Test Plan for Retrieval',
            budget: 1000000,
            riskTolerance: 'MODERATE',
          },
          marketData: mockMarketData,
        },
      });

      const createBody = JSON.parse(createResponse.body);
      createdPlanId = createBody.data.plan.id;
    });

    it('should retrieve trading plan by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/plans/${createdPlanId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.plan).toBeDefined();
      expect(body.data.plan.id).toBe(createdPlanId);
      expect(body.data.metrics).toBeDefined();
    });

    it('should return 404 for non-existent plan', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/plans/non-existent-plan-id',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Trading plan not found');
    });
  });

  describe('GET /users/:userId/plans', () => {
    const testUserId = 'test-user-for-plans';

    beforeAll(async () => {
      // Create multiple plans for the user
      const planNames = ['Plan 1', 'Plan 2', 'Plan 3'];

      for (const name of planNames) {
        await app.inject({
          method: 'POST',
          url: '/plans',
          payload: {
            userId: testUserId,
            parameters: {
              name,
              budget: 1000000,
              riskTolerance: 'MODERATE',
            },
            marketData: mockMarketData,
          },
        });
      }
    });

    it('should retrieve all trading plans for a user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/users/${testUserId}/plans`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.plans).toBeDefined();
      expect(Array.isArray(body.data.plans)).toBe(true);
      expect(body.data.plans.length).toBeGreaterThanOrEqual(3);
      expect(body.data.count).toBe(body.data.plans.length);
    });

    it('should return empty array for user with no plans', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users/user-with-no-plans/plans',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.plans).toEqual([]);
      expect(body.data.count).toBe(0);
    });
  });

  describe('PUT /plans/:planId/status', () => {
    let testPlanId: string;

    beforeAll(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/plans',
        payload: {
          userId: 'test-user-status',
          parameters: {
            name: 'Plan for Status Test',
            budget: 1000000,
            riskTolerance: 'MODERATE',
          },
          marketData: mockMarketData,
        },
      });

      const createBody = JSON.parse(createResponse.body);
      testPlanId = createBody.data.plan.id;
    });

    it('should update trading plan status', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/plans/${testPlanId}/status`,
        payload: {
          status: 'PAUSED',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('status updated successfully');
    });

    it('should return 400 for invalid status', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/plans/${testPlanId}/status`,
        payload: {
          status: 'INVALID_STATUS',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Valid status is required');
    });
  });

  describe('PUT /plans/:planId/budget', () => {
    let testPlanId: string;

    beforeAll(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/plans',
        payload: {
          userId: 'test-user-budget',
          parameters: {
            name: 'Plan for Budget Test',
            budget: 1000000,
            riskTolerance: 'MODERATE',
          },
          marketData: mockMarketData,
        },
      });

      const createBody = JSON.parse(createResponse.body);
      testPlanId = createBody.data.plan.id;
    });

    it('should update trading plan budget', async () => {
      const newBudget = 2000000;
      const response = await app.inject({
        method: 'PUT',
        url: `/plans/${testPlanId}/budget`,
        payload: {
          budget: newBudget,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('budget updated successfully');
    });

    it('should return 400 for invalid budget', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/plans/${testPlanId}/budget`,
        payload: {
          budget: -1000,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Budget must be greater than 0');
    });
  });

  describe('GET /plans/:planId/metrics', () => {
    let testPlanId: string;

    beforeAll(async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/plans',
        payload: {
          userId: 'test-user-metrics',
          parameters: {
            name: 'Plan for Metrics Test',
            budget: 1000000,
            riskTolerance: 'MODERATE',
          },
          marketData: mockMarketData,
        },
      });

      const createBody = JSON.parse(createResponse.body);
      testPlanId = createBody.data.plan.id;
    });

    it('should retrieve trading plan metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/plans/${testPlanId}/metrics`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(typeof body.data.totalTrades).toBe('number');
      expect(typeof body.data.successfulTrades).toBe('number');
      expect(typeof body.data.totalProfit).toBe('number');
      expect(typeof body.data.totalInvestment).toBe('number');
      expect(typeof body.data.successRate).toBe('number');
      expect(typeof body.data.averageProfit).toBe('number');
      expect(typeof body.data.roi).toBe('number');
    });
  });

  describe('Trade execution tracking', () => {
    it('should track trade execution', async () => {
      const userId = 'test-user-trades';
      const trade = {
        id: 'trade-123',
        userId,
        suggestionId: 'suggestion-123',
        itemId: 34,
        buyPrice: 5.0,
        sellPrice: 6.0,
        quantity: 1000,
        executedAt: new Date().toISOString(),
        actualProfit: 1000,
        status: 'COMPLETED',
      };

      const response = await app.inject({
        method: 'POST',
        url: `/users/${userId}/trades`,
        payload: trade,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('tracked successfully');
    });

    it('should return 400 for invalid trade data', async () => {
      const userId = 'test-user-trades';
      const invalidTrade = {
        id: 'trade-123',
        userId,
        suggestionId: 'suggestion-123',
        itemId: 0, // Invalid
        buyPrice: -5.0, // Invalid
        quantity: 0, // Invalid
        executedAt: new Date().toISOString(),
        status: 'COMPLETED',
      };

      const response = await app.inject({
        method: 'POST',
        url: `/users/${userId}/trades`,
        payload: invalidTrade,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid trade data');
    });
  });
});
