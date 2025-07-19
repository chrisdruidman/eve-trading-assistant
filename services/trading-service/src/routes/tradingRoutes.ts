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
              required: ['name', 'budget', 'riskTolerance'],
              properties: {
                name: { type: 'string', minLength: 1 },
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

  // Get trading plan by ID
  fastify.get(
    '/plans/:planId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['planId'],
          properties: {
            planId: { type: 'string' },
          },
        },
      },
    },
    controller.getTradingPlan.bind(controller)
  );

  // Get all trading plans for a user
  fastify.get(
    '/users/:userId/plans',
    {
      schema: {
        params: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
      },
    },
    controller.getUserTradingPlans.bind(controller)
  );

  // Update trading plan status
  fastify.put(
    '/plans/:planId/status',
    {
      schema: {
        params: {
          type: 'object',
          required: ['planId'],
          properties: {
            planId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: {
              type: 'string',
              enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
            },
          },
        },
      },
    },
    controller.updateTradingPlanStatus.bind(controller)
  );

  // Update trading plan budget
  fastify.put(
    '/plans/:planId/budget',
    {
      schema: {
        params: {
          type: 'object',
          required: ['planId'],
          properties: {
            planId: { type: 'string' },
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
    controller.updateTradingPlanBudget.bind(controller)
  );

  // Allocate budget for a suggestion
  fastify.post(
    '/plans/:planId/suggestions/:suggestionId/allocate',
    {
      schema: {
        params: {
          type: 'object',
          required: ['planId', 'suggestionId'],
          properties: {
            planId: { type: 'string' },
            suggestionId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['amount'],
          properties: {
            amount: { type: 'number', minimum: 0.01 },
          },
        },
      },
    },
    controller.allocateBudget.bind(controller)
  );

  // Release budget allocation
  fastify.delete(
    '/suggestions/:suggestionId/allocation',
    {
      schema: {
        params: {
          type: 'object',
          required: ['suggestionId'],
          properties: {
            suggestionId: { type: 'string' },
          },
        },
      },
    },
    controller.releaseBudget.bind(controller)
  );

  // Get trading plan metrics
  fastify.get(
    '/plans/:planId/metrics',
    {
      schema: {
        params: {
          type: 'object',
          required: ['planId'],
          properties: {
            planId: { type: 'string' },
          },
        },
      },
    },
    controller.getTradingPlanMetrics.bind(controller)
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

  // Complete trade execution
  fastify.put(
    '/trades/:tradeId/complete',
    {
      schema: {
        params: {
          type: 'object',
          required: ['tradeId'],
          properties: {
            tradeId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['sellPrice', 'actualProfit'],
          properties: {
            sellPrice: { type: 'number', minimum: 0.01 },
            actualProfit: { type: 'number' },
          },
        },
      },
    },
    controller.completeTradeExecution.bind(controller)
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
