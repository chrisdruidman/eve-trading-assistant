import { FastifyInstance } from 'fastify';
import { TradingController } from '../controllers/tradingController';

export async function tradingRoutes(fastify: FastifyInstance) {
  const controller = new TradingController();

  // Health check
  fastify.get('/health', controller.healthCheck.bind(controller));

  // Trading suggestions
  fastify.post(
    '/suggestions',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'budget', 'marketData'],
          properties: {
            userId: { type: 'string' },
            budget: { type: 'number', minimum: 0.01 },
            marketData: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['typeId', 'regionId', 'buyOrders', 'sellOrders'],
                properties: {
                  typeId: { type: 'number' },
                  regionId: { type: 'number' },
                  buyOrders: { type: 'array' },
                  sellOrders: { type: 'array' },
                  lastUpdated: { type: 'string' },
                  volume: { type: 'number' },
                  averagePrice: { type: 'number' },
                },
              },
            },
            userProfile: {
              type: 'object',
              properties: {
                userId: { type: 'string' },
                tradingExperience: {
                  type: 'string',
                  enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
                },
                riskTolerance: {
                  type: 'string',
                  enum: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'],
                },
                availableBudget: { type: 'number' },
                preferredMarkets: {
                  type: 'array',
                  items: { type: 'number' },
                },
                tradingGoals: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    controller.generateSuggestions.bind(controller)
  );

  // Trading plans
  fastify.post(
    '/plans',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'parameters', 'marketData'],
          properties: {
            userId: { type: 'string' },
            parameters: {
              type: 'object',
              required: ['budget', 'riskTolerance'],
              properties: {
                budget: { type: 'number', minimum: 0.01 },
                riskTolerance: {
                  type: 'string',
                  enum: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'],
                },
                preferredRegions: {
                  type: 'array',
                  items: { type: 'number' },
                },
                excludedItems: {
                  type: 'array',
                  items: { type: 'number' },
                },
                maxInvestmentPerTrade: { type: 'number', minimum: 0.01 },
              },
            },
            marketData: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['typeId', 'regionId', 'buyOrders', 'sellOrders'],
                properties: {
                  typeId: { type: 'number' },
                  regionId: { type: 'number' },
                  buyOrders: { type: 'array' },
                  sellOrders: { type: 'array' },
                },
              },
            },
          },
        },
      },
    },
    controller.createTradingPlan.bind(controller)
  );

  // Budget management
  fastify.put(
    '/users/:userId/budget',
    {
      schema: {
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['budget'],
          properties: {
            budget: { type: 'number', minimum: 0.01 },
          },
        },
      },
    },
    controller.updateBudget.bind(controller)
  );

  // Trade execution tracking
  fastify.post(
    '/users/:userId/trades',
    {
      schema: {
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: [
            'id',
            'userId',
            'suggestionId',
            'itemId',
            'buyPrice',
            'quantity',
            'executedAt',
            'status',
          ],
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            suggestionId: { type: 'string' },
            itemId: { type: 'number' },
            buyPrice: { type: 'number', minimum: 0.01 },
            sellPrice: { type: 'number', minimum: 0.01 },
            quantity: { type: 'number', minimum: 1 },
            executedAt: { type: 'string' },
            completedAt: { type: 'string' },
            actualProfit: { type: 'number' },
            status: {
              type: 'string',
              enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
            },
          },
        },
      },
    },
    controller.trackTradeExecution.bind(controller)
  );

  // Detailed analysis
  fastify.post(
    '/analysis',
    {
      schema: {
        body: {
          type: 'object',
          required: [
            'itemId',
            'itemName',
            'buyPrice',
            'sellPrice',
            'expectedProfit',
            'profitMargin',
            'riskLevel',
            'requiredInvestment',
            'timeToProfit',
            'confidence',
          ],
          properties: {
            itemId: { type: 'number' },
            itemName: { type: 'string' },
            buyPrice: { type: 'number', minimum: 0.01 },
            sellPrice: { type: 'number', minimum: 0.01 },
            expectedProfit: { type: 'number' },
            profitMargin: { type: 'number' },
            riskLevel: {
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH'],
            },
            requiredInvestment: { type: 'number', minimum: 0.01 },
            timeToProfit: { type: 'number', minimum: 0 },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
      },
    },
    controller.getDetailedAnalysis.bind(controller)
  );

  // Portfolio metrics
  fastify.post(
    '/portfolio/metrics',
    {
      schema: {
        body: {
          type: 'object',
          required: [
            'id',
            'userId',
            'budget',
            'riskTolerance',
            'suggestions',
            'createdAt',
            'status',
          ],
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            budget: { type: 'number', minimum: 0.01 },
            riskTolerance: {
              type: 'string',
              enum: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'],
            },
            suggestions: { type: 'array' },
            createdAt: { type: 'string' },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'PAUSED', 'COMPLETED'],
            },
          },
        },
      },
    },
    controller.calculatePortfolioMetrics.bind(controller)
  );
}
