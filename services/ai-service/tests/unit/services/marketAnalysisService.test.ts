import { MarketAnalysisService } from '../../../src/services/marketAnalysisService';
import { AIProviderManagerImpl } from '../../../src/providers/manager';
import { AICacheManager } from '../../../src/cache/aiCache';
import {
  MarketData,
  AnalysisContext,
  TradingSuggestion,
  AIResponse,
} from '../../../../../shared/src/types';

// Mock dependencies
jest.mock('../../../src/providers/manager');
jest.mock('../../../src/cache/aiCache');

describe('MarketAnalysisService', () => {
  let marketAnalysisService: MarketAnalysisService;
  let mockProviderManager: jest.Mocked<AIProviderManagerImpl>;
  let mockCache: jest.Mocked<AICacheManager>;

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

  const mockAIResponse: AIResponse = {
    content: JSON.stringify({
      summary: 'Market analysis shows moderate trading opportunities',
      trends: [
        {
          typeId: 34,
          regionId: 10000002,
          direction: 'UPWARD',
          strength: 0.7,
          timeframe: 'SHORT',
          description: 'Strong upward momentum detected',
          confidence: 0.8,
        },
      ],
      opportunities: [
        {
          typeId: 34,
          regionId: 10000002,
          strategy: 'ARBITRAGE',
          expectedProfit: 5000,
          profitMargin: 0.09,
          riskLevel: 'LOW',
          timeToProfit: 24,
          confidence: 0.85,
        },
      ],
      risks: [
        {
          factor: 'Market Volatility',
          level: 'MEDIUM',
          description: 'Standard volatility risks',
          mitigation: 'Monitor closely',
          probability: 0.3,
        },
      ],
      confidence: 0.8,
    }),
    confidence: 0.8,
    provider: 'anthropic',
    usage: {
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
    },
    cached: false,
  };

  beforeEach(() => {
    mockProviderManager = new AIProviderManagerImpl() as jest.Mocked<AIProviderManagerImpl>;
    mockCache = new AICacheManager() as jest.Mocked<AICacheManager>;
    marketAnalysisService = new MarketAnalysisService(mockProviderManager, mockCache);

    // Setup default mocks
    mockProviderManager.getAvailableProvider.mockResolvedValue({
      name: 'anthropic',
      isAvailable: jest.fn().mockResolvedValue(true),
      generateResponse: jest.fn().mockResolvedValue(mockAIResponse),
      estimateCost: jest.fn().mockReturnValue(0.02),
    });

    mockProviderManager.executeWithFailover.mockResolvedValue(mockAIResponse);
    mockCache.get.mockResolvedValue(null);
    mockCache.shouldCache.mockReturnValue(true);
    mockCache.set.mockResolvedValue();
  });

  describe('analyzeMarketData', () => {
    it('should analyze market data and return comprehensive analysis', async () => {
      const result = await marketAnalysisService.analyzeMarketData(mockMarketData, mockContext);

      expect(result).toBeDefined();
      expect(result.summary).toBe('Market analysis shows moderate trading opportunities');
      expect(result.trends).toHaveLength(1);
      expect(result.trends[0].direction).toBe('UPWARD');
      expect(result.opportunities).toHaveLength(1);
      expect(result.risks).toHaveLength(1);
      expect(result.confidence).toBe(0.8);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should handle AI response parsing errors gracefully', async () => {
      const invalidResponse = {
        ...mockAIResponse,
        content: 'Invalid JSON response',
      };
      mockProviderManager.executeWithFailover.mockResolvedValue(invalidResponse);

      const result = await marketAnalysisService.analyzeMarketData(mockMarketData, mockContext);

      expect(result).toBeDefined();
      expect(result.summary).toContain('Invalid JSON response');
      expect(result.trends).toHaveLength(1); // Default trends
      expect(result.confidence).toBeLessThan(0.8); // Reduced confidence for fallback
    });

    it('should use cached responses when available', async () => {
      mockCache.get.mockResolvedValue(mockAIResponse);

      const result = await marketAnalysisService.analyzeMarketData(mockMarketData, mockContext);

      expect(mockCache.get).toHaveBeenCalled();
      expect(mockProviderManager.executeWithFailover).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('identifyTradingOpportunities', () => {
    it('should identify trading opportunities from market data', async () => {
      const opportunitiesResponse = {
        ...mockAIResponse,
        content: JSON.stringify([
          {
            typeId: 34,
            regionId: 10000002,
            strategy: 'ARBITRAGE',
            buyLocation: 60003760,
            sellLocation: 60008494,
            buyPrice: 5.5,
            sellPrice: 6.0,
            expectedProfit: 5000,
            profitMargin: 0.09,
            requiredInvestment: 55000,
            riskLevel: 'LOW',
            timeToProfit: 24,
            confidence: 0.85,
            description: 'Cross-station arbitrage opportunity',
            executionSteps: ['Buy at Jita', 'Transport to Amarr', 'Sell at market'],
          },
        ]),
      };
      mockProviderManager.executeWithFailover.mockResolvedValue(opportunitiesResponse);

      const result = await marketAnalysisService.identifyTradingOpportunities(
        mockMarketData,
        mockContext
      );

      expect(result).toHaveLength(1);
      expect(result[0].typeId).toBe(34);
      expect(result[0].expectedProfit).toBe(5000);
      expect(result[0].riskLevel).toBe('LOW');
      expect(result[0].confidence).toBe(0.85);
    });

    it('should return empty array for invalid response format', async () => {
      const invalidResponse = {
        ...mockAIResponse,
        content: 'Not a valid JSON array',
      };
      mockProviderManager.executeWithFailover.mockResolvedValue(invalidResponse);

      const result = await marketAnalysisService.identifyTradingOpportunities(
        mockMarketData,
        mockContext
      );

      expect(result).toEqual([]);
    });
  });

  describe('assessProfitAndRisk', () => {
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

    it('should assess profit and risk for trading suggestions', async () => {
      const assessmentResponse = {
        ...mockAIResponse,
        content: JSON.stringify({
          enhancedSuggestions: [
            {
              originalIndex: 0,
              adjustedProfitMargin: 0.08,
              adjustedRiskLevel: 'MEDIUM',
              profitProbability: 0.75,
              expectedValue: 4500,
              worstCaseScenario: -1000,
              bestCaseScenario: 7000,
              recommendedPosition: 50000,
              riskMitigationSteps: ['Monitor market closely', 'Set stop-loss orders'],
            },
          ],
          portfolioRisks: [
            {
              factor: 'Concentration Risk',
              level: 'MEDIUM',
              description: 'High concentration in single item',
              mitigation: 'Diversify across multiple items',
              affectedSuggestions: [0],
            },
          ],
          overallAssessment: {
            totalExpectedProfit: 4500,
            totalRisk: 'MEDIUM',
            diversificationScore: 0.3,
            recommendedCapitalAllocation: 50000,
            confidence: 0.75,
          },
        }),
      };
      mockProviderManager.executeWithFailover.mockResolvedValue(assessmentResponse);

      const result = await marketAnalysisService.assessProfitAndRisk(
        mockSuggestions,
        mockMarketData,
        mockContext
      );

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].profitMargin).toBe(0.08);
      expect(result.suggestions[0].riskLevel).toBe('MEDIUM');
      expect(result.risks).toHaveLength(1);
      expect(result.risks[0].factor).toBe('Concentration Risk');
    });

    it('should return original suggestions if assessment fails', async () => {
      const invalidResponse = {
        ...mockAIResponse,
        content: 'Invalid assessment response',
      };
      mockProviderManager.executeWithFailover.mockResolvedValue(invalidResponse);

      const result = await marketAnalysisService.assessProfitAndRisk(
        mockSuggestions,
        mockMarketData,
        mockContext
      );

      expect(result.suggestions).toEqual(mockSuggestions);
      expect(result.risks).toHaveLength(2); // Default risks
    });
  });

  describe('predictMarketTrends', () => {
    const mockHistoricalData = [
      {
        typeId: 34,
        regionId: 10000002,
        date: '2024-01-01',
        highest: 6.5,
        lowest: 5.0,
        average: 5.75,
        volume: 15000,
        orderCount: 150,
      },
    ];

    it('should predict market trends using current and historical data', async () => {
      const trendsResponse = {
        ...mockAIResponse,
        content: JSON.stringify([
          {
            typeId: 34,
            regionId: 10000002,
            shortTermTrend: {
              direction: 'UPWARD',
              strength: 0.7,
              duration: '1-7 days',
              priceTarget: 6.2,
              confidence: 0.8,
            },
            mediumTermTrend: {
              direction: 'STABLE',
              strength: 0.4,
              duration: '1-4 weeks',
              priceTarget: 5.9,
              confidence: 0.6,
            },
            keyFactors: ['Increased demand', 'Supply constraints'],
            riskFactors: ['Market volatility', 'Competition'],
            tradingImplications: 'Consider long positions with tight stops',
            volatilityForecast: 0.3,
          },
        ]),
      };
      mockProviderManager.executeWithFailover.mockResolvedValue(trendsResponse);

      const result = await marketAnalysisService.predictMarketTrends(
        mockMarketData,
        mockHistoricalData,
        mockContext
      );

      expect(result).toHaveLength(1);
      expect(result[0].typeId).toBe(34);
      expect(result[0].direction).toBe('UPWARD');
      expect(result[0].strength).toBe(0.7);
      expect(result[0].timeframe).toBe('1-7 days');
    });

    it('should return default trends for invalid response', async () => {
      const invalidResponse = {
        ...mockAIResponse,
        content: 'Invalid trends response',
      };
      mockProviderManager.executeWithFailover.mockResolvedValue(invalidResponse);

      const result = await marketAnalysisService.predictMarketTrends(
        mockMarketData,
        mockHistoricalData,
        mockContext
      );

      expect(result).toHaveLength(1);
      expect(result[0].direction).toBe('STABLE');
      expect(result[0].strength).toBe(0.5);
      expect(result[0].description).toContain('Market analysis based on current order book data');
    });
  });

  describe('prompt building', () => {
    it('should build comprehensive market analysis prompts', async () => {
      await marketAnalysisService.analyzeMarketData(mockMarketData, mockContext);

      expect(mockProviderManager.executeWithFailover).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('expert EVE Online market analyst'),
          context: expect.objectContaining({
            analysisType: 'comprehensive_market_analysis',
          }),
        })
      );
    });

    it('should include user context in prompts', async () => {
      await marketAnalysisService.analyzeMarketData(mockMarketData, mockContext);

      const call = mockProviderManager.executeWithFailover.mock.calls[0][0];
      expect(call.prompt).toContain('Available Budget: 1,000,000 ISK');
      expect(call.prompt).toContain('Risk Tolerance: MODERATE');
      expect(call.prompt).toContain('Time Horizon: MEDIUM');
    });

    it('should format market data properly in prompts', async () => {
      await marketAnalysisService.analyzeMarketData(mockMarketData, mockContext);

      const call = mockProviderManager.executeWithFailover.mock.calls[0][0];
      expect(call.prompt).toContain('ITEM 34 - REGION 10000002');
      expect(call.prompt).toContain('Best Buy Order: 5.5 ISK');
      expect(call.prompt).toContain('Best Sell Order: 6 ISK');
    });
  });

  describe('caching behavior', () => {
    it('should cache expensive analysis responses', async () => {
      mockProviderManager.getAvailableProvider.mockResolvedValue({
        name: 'anthropic',
        isAvailable: jest.fn().mockResolvedValue(true),
        generateResponse: jest.fn().mockResolvedValue(mockAIResponse),
        estimateCost: jest.fn().mockReturnValue(0.03), // High cost
      });

      await marketAnalysisService.analyzeMarketData(mockMarketData, mockContext);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        'anthropic',
        mockAIResponse,
        7200 // 2 hours for expensive responses
      );
    });

    it('should use shorter cache TTL for cheaper responses', async () => {
      mockProviderManager.getAvailableProvider.mockResolvedValue({
        name: 'anthropic',
        isAvailable: jest.fn().mockResolvedValue(true),
        generateResponse: jest.fn().mockResolvedValue(mockAIResponse),
        estimateCost: jest.fn().mockReturnValue(0.01), // Lower cost
      });

      await marketAnalysisService.analyzeMarketData(mockMarketData, mockContext);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        'anthropic',
        mockAIResponse,
        3600 // 1 hour for cheaper responses
      );
    });
  });
});
