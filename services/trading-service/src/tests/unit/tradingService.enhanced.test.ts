import { TradingService } from '../../services/tradingService';
import { TradingPlanRepository } from '../../models/tradingPlanRepository';
import { TradingSuggestionEngine } from '../../services/tradingSuggestionEngine';
import { TradingPlanParams, MarketData, TradingSuggestion, ExecutedTrade } from '@shared/types';

// Mock dependencies
jest.mock('../../models/tradingPlanRepository');
jest.mock('../../services/tradingSuggestionEngine');

describe('TradingService - Enhanced Trading Plan Management', () => {
  let tradingService: TradingService;
  let mockRepository: jest.Mocked<TradingPlanRepository>;
  let mockSuggestionEngine: jest.Mocked<TradingSuggestionEngine>;

  beforeEach(() => {
    mockRepository = new TradingPlanRepository() as jest.Mocked<TradingPlanRepository>;
    mockSuggestionEngine = new TradingSuggestionEngine() as jest.Mocked<TradingSuggestionEngine>;

    tradingService = new TradingService();
    (tradingService as any).tradingPlanRepository = mockRepository;
    (tradingService as any).suggestionEngine = mockSuggestionEngine;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTradingPlan', () => {
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

    const mockSuggestions: TradingSuggestion[] = [
      {
        itemId: 34,
        itemName: 'Tritanium',
        buyPrice: 5.0,
        sellPrice: 5.5,
        expectedProfit: 500,
        profitMargin: 0.1,
        riskLevel: 'LOW',
        requiredInvestment: 5000,
        timeToProfit: 24,
        confidence: 0.85,
      },
    ];

    it('should create trading plan with risk assessment', async () => {
      const userId = 'user-123';
      const params: TradingPlanParams & { name: string } = {
        name: 'Conservative Plan',
        budget: 1000000,
        riskTolerance: 'CONSERVATIVE',
      };

      const expectedPlan = {
        id: 'plan-123',
        userId,
        budget: params.budget,
        riskTolerance: params.riskTolerance,
        suggestions: mockSuggestions,
        createdAt: new Date(),
        status: 'ACTIVE' as const,
      };

      mockSuggestionEngine.generateSuggestions.mockResolvedValue(mockSuggestions);
      mockRepository.createTradingPlan.mockResolvedValue(expectedPlan);

      const result = await tradingService.createTradingPlan(userId, params, mockMarketData);

      expect(result).toEqual(expectedPlan);
      expect(mockRepository.createTradingPlan).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          name: params.name,
          budget: params.budget,
          riskTolerance: params.riskTolerance,
          maxInvestmentPerTrade: expect.any(Number), // Should be calculated based on risk tolerance
        }),
        expect.any(Array)
      );
    });

    it('should adjust max investment per trade based on risk tolerance', async () => {
      const userId = 'user-123';
      const conservativeParams: TradingPlanParams & { name: string } = {
        name: 'Conservative Plan',
        budget: 1000000,
        riskTolerance: 'CONSERVATIVE',
      };

      const aggressiveParams: TradingPlanParams & { name: string } = {
        name: 'Aggressive Plan',
        budget: 1000000,
        riskTolerance: 'AGGRESSIVE',
      };

      mockSuggestionEngine.generateSuggestions.mockResolvedValue(mockSuggestions);
      mockRepository.createTradingPlan.mockResolvedValue({
        id: 'plan-123',
        userId,
        budget: 1000000,
        riskTolerance: 'CONSERVATIVE',
        suggestions: mockSuggestions,
        createdAt: new Date(),
        status: 'ACTIVE',
      });

      // Test conservative
      await tradingService.createTradingPlan(userId, conservativeParams, mockMarketData);
      expect(mockRepository.createTradingPlan).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          maxInvestmentPerTrade: 150000, // 15% of budget
        }),
        expect.any(Array)
      );

      // Test aggressive
      await tradingService.createTradingPlan(userId, aggressiveParams, mockMarketData);
      expect(mockRepository.createTradingPlan).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          maxInvestmentPerTrade: 400000, // 40% of budget
        }),
        expect.any(Array)
      );
    });

    it('should validate trading plan parameters', async () => {
      const userId = 'user-123';
      const invalidParams: TradingPlanParams & { name: string } = {
        name: '',
        budget: -1000,
        riskTolerance: 'INVALID' as any,
      };

      await expect(
        tradingService.createTradingPlan(userId, invalidParams, mockMarketData)
      ).rejects.toThrow('Trading plan name is required');
    });

    it('should filter suggestions based on parameters', async () => {
      const userId = 'user-123';
      const params: TradingPlanParams & { name: string } = {
        name: 'Filtered Plan',
        budget: 1000000,
        riskTolerance: 'MODERATE',
        excludedItems: [34],
        maxInvestmentPerTrade: 100000,
      };

      const allSuggestions: TradingSuggestion[] = [
        ...mockSuggestions,
        {
          itemId: 35,
          itemName: 'Pyerite',
          buyPrice: 10.0,
          sellPrice: 12.0,
          expectedProfit: 200000,
          profitMargin: 0.2,
          riskLevel: 'MEDIUM',
          requiredInvestment: 150000, // Exceeds maxInvestmentPerTrade
          timeToProfit: 48,
          confidence: 0.75,
        },
      ];

      mockSuggestionEngine.generateSuggestions.mockResolvedValue(allSuggestions);
      mockRepository.createTradingPlan.mockResolvedValue({
        id: 'plan-123',
        userId,
        budget: params.budget,
        riskTolerance: params.riskTolerance,
        suggestions: [], // Should be filtered
        createdAt: new Date(),
        status: 'ACTIVE',
      });

      await tradingService.createTradingPlan(userId, params, mockMarketData);

      // Verify that suggestions were filtered (excluded item 34 and high investment item 35)
      const createCall = mockRepository.createTradingPlan.mock.calls[0];
      if (createCall) {
        const passedSuggestions = createCall[2];
        expect(passedSuggestions).toHaveLength(0); // Both suggestions should be filtered out
      }
    });
  });

  describe('budget management', () => {
    it('should allocate budget for suggestion', async () => {
      const planId = 'plan-123';
      const suggestionId = 'suggestion-123';
      const amount = 5000;

      mockRepository.allocateBudget.mockResolvedValue(true);

      const result = await tradingService.allocateBudgetForSuggestion(planId, suggestionId, amount);

      expect(result).toBe(true);
      expect(mockRepository.allocateBudget).toHaveBeenCalledWith(planId, suggestionId, amount);
    });

    it('should validate allocation amount', async () => {
      const planId = 'plan-123';
      const suggestionId = 'suggestion-123';
      const invalidAmount = -100;

      await expect(
        tradingService.allocateBudgetForSuggestion(planId, suggestionId, invalidAmount)
      ).rejects.toThrow('Allocation amount must be greater than 0');
    });

    it('should release budget allocation', async () => {
      const suggestionId = 'suggestion-123';

      mockRepository.releaseBudget.mockResolvedValue(true);

      const result = await tradingService.releaseBudgetAllocation(suggestionId);

      expect(result).toBe(true);
      expect(mockRepository.releaseBudget).toHaveBeenCalledWith(suggestionId);
    });

    it('should update trading plan budget', async () => {
      const planId = 'plan-123';
      const newBudget = 2000000;

      mockRepository.updateTradingPlanBudget.mockResolvedValue(true);

      const result = await tradingService.updateTradingPlanBudget(planId, newBudget);

      expect(result).toBe(true);
      expect(mockRepository.updateTradingPlanBudget).toHaveBeenCalledWith(planId, newBudget);
    });
  });

  describe('trade execution tracking', () => {
    it('should track trade execution', async () => {
      const userId = 'user-123';
      const trade: ExecutedTrade = {
        id: 'trade-123',
        userId,
        suggestionId: 'suggestion-123',
        itemId: 34,
        buyPrice: 5.0,
        quantity: 1000,
        executedAt: new Date(),
        status: 'PENDING',
      };

      mockRepository.recordTradeExecution.mockResolvedValue('trade-123');

      const result = await tradingService.trackTradeExecution(userId, trade);

      expect(result).toBe('trade-123');
      expect(mockRepository.recordTradeExecution).toHaveBeenCalledWith(trade);
    });

    it('should validate trade data', async () => {
      const userId = 'user-123';
      const invalidTrade: ExecutedTrade = {
        id: 'trade-123',
        userId,
        suggestionId: 'suggestion-123',
        itemId: 0, // Invalid
        buyPrice: -5.0, // Invalid
        quantity: 0, // Invalid
        executedAt: new Date(),
        status: 'PENDING',
      };

      await expect(tradingService.trackTradeExecution(userId, invalidTrade)).rejects.toThrow(
        'Invalid trade data: itemId, buyPrice, and quantity are required'
      );
    });

    it('should complete trade execution', async () => {
      const tradeId = 'trade-123';
      const sellPrice = 6.0;
      const actualProfit = 1000;

      mockRepository.updateTradeCompletion.mockResolvedValue(true);

      const result = await tradingService.completeTradeExecution(tradeId, sellPrice, actualProfit);

      expect(result).toBe(true);
      expect(mockRepository.updateTradeCompletion).toHaveBeenCalledWith(
        tradeId,
        sellPrice,
        actualProfit
      );
    });
  });

  describe('trading plan retrieval', () => {
    it('should get trading plan by ID', async () => {
      const planId = 'plan-123';
      const expectedPlan = {
        id: planId,
        userId: 'user-123',
        budget: 1000000,
        riskTolerance: 'MODERATE' as const,
        suggestions: [],
        createdAt: new Date(),
        status: 'ACTIVE' as const,
      };

      mockRepository.getTradingPlanById.mockResolvedValue(expectedPlan);

      const result = await tradingService.getTradingPlan(planId);

      expect(result).toEqual(expectedPlan);
      expect(mockRepository.getTradingPlanById).toHaveBeenCalledWith(planId);
    });

    it('should get user trading plans', async () => {
      const userId = 'user-123';
      const expectedPlans = [
        {
          id: 'plan-1',
          userId,
          budget: 1000000,
          riskTolerance: 'MODERATE' as const,
          suggestions: [],
          createdAt: new Date(),
          status: 'ACTIVE' as const,
        },
        {
          id: 'plan-2',
          userId,
          budget: 500000,
          riskTolerance: 'CONSERVATIVE' as const,
          suggestions: [],
          createdAt: new Date(),
          status: 'PAUSED' as const,
        },
      ];

      mockRepository.getTradingPlansByUserId.mockResolvedValue(expectedPlans);

      const result = await tradingService.getUserTradingPlans(userId);

      expect(result).toEqual(expectedPlans);
      expect(mockRepository.getTradingPlansByUserId).toHaveBeenCalledWith(userId);
    });
  });

  describe('trading plan metrics', () => {
    it('should get trading plan metrics', async () => {
      const planId = 'plan-123';
      const expectedMetrics = {
        totalTrades: 10,
        successfulTrades: 8,
        totalProfit: 50000,
        totalInvestment: 200000,
        successRate: 0.8,
        averageProfit: 6250,
        roi: 0.25,
      };

      mockRepository.getTradingPlanMetrics.mockResolvedValue(expectedMetrics);

      const result = await tradingService.getTradingPlanMetrics(planId);

      expect(result).toEqual(expectedMetrics);
      expect(mockRepository.getTradingPlanMetrics).toHaveBeenCalledWith(planId);
    });
  });

  describe('risk tolerance assessment', () => {
    it('should apply conservative risk limits', async () => {
      const service = tradingService as any;
      const maxInvestment = service.getMaxInvestmentByRiskTolerance(1000000, 'CONSERVATIVE');
      expect(maxInvestment).toBe(200000); // 20% of budget
    });

    it('should apply moderate risk limits', async () => {
      const service = tradingService as any;
      const maxInvestment = service.getMaxInvestmentByRiskTolerance(1000000, 'MODERATE');
      expect(maxInvestment).toBe(350000); // 35% of budget
    });

    it('should apply aggressive risk limits', async () => {
      const service = tradingService as any;
      const maxInvestment = service.getMaxInvestmentByRiskTolerance(1000000, 'AGGRESSIVE');
      expect(maxInvestment).toBe(500000); // 50% of budget
    });
  });
});
