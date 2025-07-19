import { TradingService } from '../../services/tradingService';
import { MarketData, TradingPlanParams, UserProfile } from '@shared/types';

describe('TradingService', () => {
  let service: TradingService;

  beforeEach(() => {
    service = new TradingService();
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
          price: 100,
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
          price: 80,
          volume: 800,
          minVolume: 1,
          duration: 90,
          issued: new Date(),
          isBuyOrder: false,
        },
      ],
      lastUpdated: new Date(),
      volume: 1800,
      averagePrice: 90,
    },
    {
      typeId: 35,
      regionId: 10000002,
      buyOrders: [
        {
          orderId: 3,
          typeId: 35,
          regionId: 10000002,
          locationId: 60003760,
          price: 200,
          volume: 500,
          minVolume: 1,
          duration: 90,
          issued: new Date(),
          isBuyOrder: true,
        },
      ],
      sellOrders: [
        {
          orderId: 4,
          typeId: 35,
          regionId: 10000002,
          locationId: 60003760,
          price: 150,
          volume: 400,
          minVolume: 1,
          duration: 90,
          issued: new Date(),
          isBuyOrder: false,
        },
      ],
      lastUpdated: new Date(),
      volume: 900,
      averagePrice: 175,
    },
  ];

  describe('generateTradingSuggestions', () => {
    it('should generate trading suggestions', async () => {
      const suggestions = await service.generateTradingSuggestions(
        'test-user',
        100000,
        mockMarketData
      );

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);

      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('itemId');
        expect(suggestion).toHaveProperty('buyPrice');
        expect(suggestion).toHaveProperty('sellPrice');
        expect(suggestion).toHaveProperty('expectedProfit');
        expect(suggestion).toHaveProperty('profitMargin');
        expect(suggestion).toHaveProperty('riskLevel');
        expect(suggestion.expectedProfit).toBeGreaterThan(0);
        expect(suggestion.profitMargin).toBeGreaterThan(0);
      });
    });

    it('should respect user profile risk tolerance', async () => {
      const conservativeProfile: UserProfile = {
        userId: 'test-user',
        tradingExperience: 'BEGINNER',
        riskTolerance: 'CONSERVATIVE',
        availableBudget: 100000,
        preferredMarkets: [10000002],
        tradingGoals: ['steady income'],
      };

      const suggestions = await service.generateTradingSuggestions(
        'test-user',
        100000,
        mockMarketData,
        conservativeProfile
      );

      suggestions.forEach(suggestion => {
        expect(suggestion.riskLevel).toBe('LOW');
      });
    });

    it('should handle empty market data', async () => {
      const suggestions = await service.generateTradingSuggestions('test-user', 100000, []);

      expect(suggestions).toEqual([]);
    });
  });

  describe('createTradingPlan', () => {
    const mockParameters: TradingPlanParams = {
      budget: 100000,
      riskTolerance: 'MODERATE',
      preferredRegions: [10000002],
      maxInvestmentPerTrade: 30000,
    };

    it('should create a trading plan', async () => {
      const plan = await service.createTradingPlan('test-user', mockParameters, mockMarketData);

      expect(plan).toBeDefined();
      expect(plan.id).toBeDefined();
      expect(plan.userId).toBe('test-user');
      expect(plan.budget).toBe(mockParameters.budget);
      expect(plan.riskTolerance).toBe(mockParameters.riskTolerance);
      expect(plan.status).toBe('ACTIVE');
      expect(Array.isArray(plan.suggestions)).toBe(true);
      expect(plan.createdAt).toBeInstanceOf(Date);
    });

    it('should respect budget constraints in plan', async () => {
      const plan = await service.createTradingPlan('test-user', mockParameters, mockMarketData);

      const totalInvestment = plan.suggestions.reduce((sum, s) => sum + s.requiredInvestment, 0);

      expect(totalInvestment).toBeLessThanOrEqual(mockParameters.budget);
    });

    it('should respect max investment per trade', async () => {
      const plan = await service.createTradingPlan('test-user', mockParameters, mockMarketData);

      plan.suggestions.forEach(suggestion => {
        expect(suggestion.requiredInvestment).toBeLessThanOrEqual(
          mockParameters.maxInvestmentPerTrade!
        );
      });
    });

    it('should exclude specified items', async () => {
      const parametersWithExclusions: TradingPlanParams = {
        ...mockParameters,
        excludedItems: [34], // Exclude first item
      };

      const plan = await service.createTradingPlan(
        'test-user',
        parametersWithExclusions,
        mockMarketData
      );

      plan.suggestions.forEach(suggestion => {
        expect(suggestion.itemId).not.toBe(34);
      });
    });
  });

  describe('calculatePortfolioMetrics', () => {
    it('should calculate portfolio metrics correctly', () => {
      const mockPlan = {
        id: 'test-plan',
        userId: 'test-user',
        budget: 100000,
        riskTolerance: 'MODERATE' as const,
        suggestions: [
          {
            itemId: 34,
            itemName: 'Tritanium',
            buyPrice: 80,
            sellPrice: 100,
            expectedProfit: 2000,
            profitMargin: 0.25,
            riskLevel: 'LOW' as const,
            requiredInvestment: 8000,
            timeToProfit: 24,
            confidence: 0.8,
          },
          {
            itemId: 35,
            itemName: 'Pyerite',
            buyPrice: 150,
            sellPrice: 200,
            expectedProfit: 5000,
            profitMargin: 0.33,
            riskLevel: 'MEDIUM' as const,
            requiredInvestment: 15000,
            timeToProfit: 48,
            confidence: 0.7,
          },
        ],
        createdAt: new Date(),
        status: 'ACTIVE' as const,
      };

      const metrics = service.calculatePortfolioMetrics(mockPlan);

      expect(metrics.totalInvestment).toBe(23000);
      expect(metrics.totalExpectedProfit).toBe(7000);
      expect(metrics.averageROI).toBeCloseTo(7000 / 23000, 4);
      expect(metrics.diversificationScore).toBe(1); // 2 unique items / 2 suggestions
      expect(metrics.averageRiskLevel).toBe(1.5); // (1 + 2) / 2
      expect(metrics.timeToBreakEven).toBeGreaterThan(0);
    });

    it('should handle empty suggestions', () => {
      const emptyPlan = {
        id: 'empty-plan',
        userId: 'test-user',
        budget: 100000,
        riskTolerance: 'MODERATE' as const,
        suggestions: [],
        createdAt: new Date(),
        status: 'ACTIVE' as const,
      };

      const metrics = service.calculatePortfolioMetrics(emptyPlan);

      expect(metrics.totalInvestment).toBe(0);
      expect(metrics.totalExpectedProfit).toBe(0);
      expect(metrics.averageROI).toBe(0);
      expect(metrics.diversificationScore).toBe(0);
      expect(metrics.averageRiskLevel).toBe(0);
      expect(metrics.timeToBreakEven).toBe(0);
    });
  });

  describe('getDetailedAnalysis', () => {
    const mockSuggestion = {
      itemId: 34,
      itemName: 'Tritanium',
      buyPrice: 80,
      sellPrice: 100,
      expectedProfit: 2000,
      profitMargin: 0.25,
      riskLevel: 'MEDIUM' as const,
      requiredInvestment: 8000,
      timeToProfit: 24,
      confidence: 0.75,
    };

    it('should provide detailed analysis', async () => {
      const analysis = await service.getDetailedAnalysis(mockSuggestion);

      expect(analysis).toHaveProperty('profitMetrics');
      expect(analysis).toHaveProperty('validation');
      expect(analysis).toHaveProperty('riskAnalysis');

      expect(analysis.profitMetrics).toHaveProperty('absoluteProfit');
      expect(analysis.profitMetrics).toHaveProperty('profitMargin');
      expect(analysis.profitMetrics).toHaveProperty('roi');
      expect(analysis.profitMetrics).toHaveProperty('profitPerHour');
      expect(analysis.profitMetrics).toHaveProperty('breakEvenVolume');

      expect(analysis.validation).toHaveProperty('isValid');
      expect(analysis.validation).toHaveProperty('issues');

      expect(analysis.riskAnalysis).toHaveProperty('riskFactors');
      expect(analysis.riskAnalysis).toHaveProperty('mitigation');
      expect(analysis.riskAnalysis).toHaveProperty('confidence');
    });

    it('should provide appropriate risk analysis for different risk levels', async () => {
      const highRiskSuggestion = {
        ...mockSuggestion,
        riskLevel: 'HIGH' as const,
      };

      const analysis = await service.getDetailedAnalysis(highRiskSuggestion);

      expect(analysis.riskAnalysis.riskFactors).toContain('High market volatility');
      expect(analysis.riskAnalysis.mitigation).toContain('Monitor market closely');
    });
  });

  describe('updateBudget', () => {
    it('should update budget successfully', async () => {
      // This is a placeholder test since the method currently just logs
      await expect(service.updateBudget('test-user', 50000)).resolves.not.toThrow();
    });
  });

  describe('trackTradeExecution', () => {
    it('should track trade execution successfully', async () => {
      const mockTrade = {
        id: 'trade-1',
        userId: 'test-user',
        suggestionId: 'suggestion-1',
        itemId: 34,
        buyPrice: 80,
        sellPrice: 100,
        quantity: 100,
        executedAt: new Date(),
        completedAt: new Date(),
        actualProfit: 2000,
        status: 'COMPLETED' as const,
      };

      // This is a placeholder test since the method currently just logs
      await expect(service.trackTradeExecution('test-user', mockTrade)).resolves.not.toThrow();
    });
  });
});
