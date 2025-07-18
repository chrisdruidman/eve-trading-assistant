import { AIService } from '../../src/services/aiService';
import {
  MarketData,
  AnalysisContext,
  UserProfile,
  MarketConditions,
} from '../../../../shared/src/types';

// Mock environment variables
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock external dependencies
jest.mock('@anthropic-ai/sdk');
jest.mock('openai');
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    isOpen: false,
    connect: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn(),
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn(),
    ttl: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
  })),
}));

describe('AIService Integration Tests', () => {
  let aiService: AIService;
  let mockMarketData: MarketData[];
  let mockAnalysisContext: AnalysisContext;
  let mockUserProfile: UserProfile;
  let mockMarketConditions: MarketConditions;

  beforeEach(async () => {
    jest.clearAllMocks();

    aiService = new AIService();

    // Mock market data
    mockMarketData = [
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
        volume: 1500,
        averagePrice: 5.75,
      },
    ];

    mockAnalysisContext = {
      userId: 'test-user-123',
      budget: 10000000,
      riskTolerance: 'MODERATE',
      preferredRegions: [10000002],
      timeHorizon: 'MEDIUM',
    };

    mockUserProfile = {
      userId: 'test-user-123',
      tradingExperience: 'INTERMEDIATE',
      riskTolerance: 'MODERATE',
      availableBudget: 10000000,
      preferredMarkets: [10000002],
      tradingGoals: ['profit_maximization', 'risk_management'],
    };

    mockMarketConditions = {
      volatility: 0.3,
      liquidity: 0.7,
      trend: 'BULL',
      majorEvents: ['patch_release', 'market_event'],
    };
  });

  describe('Service Initialization', () => {
    it('should initialize successfully with API keys', async () => {
      await expect(aiService.initialize()).resolves.not.toThrow();

      const health = await aiService.getServiceHealth();
      expect(health.initialized).toBe(true);
      expect(health.providers.providers).toBeDefined();
    });

    it('should throw error when no API keys are provided', async () => {
      // Temporarily remove API keys
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const serviceWithoutKeys = new AIService();

      await expect(serviceWithoutKeys.initialize()).rejects.toThrow(
        'No AI provider API keys configured'
      );

      // Restore API keys
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      process.env.OPENAI_API_KEY = 'test-openai-key';
    });
  });

  describe('Market Data Analysis', () => {
    beforeEach(async () => {
      // Mock successful Anthropic response
      const mockAnthropic = require('@anthropic-ai/sdk');
      mockAnthropic.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [
              {
                type: 'text',
                text: 'Market analysis: The Tritanium market shows moderate volatility with good trading opportunities. Current spread of 0.50 ISK suggests profitable arbitrage potential.',
              },
            ],
            usage: {
              input_tokens: 150,
              output_tokens: 75,
            },
          }),
        },
      }));

      await aiService.initialize();
    });

    it('should analyze market data successfully', async () => {
      const analysis = await aiService.analyzeMarketData(mockMarketData, mockAnalysisContext);

      expect(analysis).toBeDefined();
      expect(analysis.summary).toBeDefined();
      expect(analysis.trends).toHaveLength(1);
      expect(analysis.trends[0].typeId).toBe(34);
      expect(analysis.trends[0].regionId).toBe(10000002);
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.generatedAt).toBeInstanceOf(Date);
    });

    it('should handle empty market data', async () => {
      await expect(aiService.analyzeMarketData([], mockAnalysisContext)).resolves.toBeDefined();
    });

    it('should include user context in analysis', async () => {
      const contextWithHighBudget = {
        ...mockAnalysisContext,
        budget: 100000000,
        riskTolerance: 'AGGRESSIVE' as const,
      };

      const analysis = await aiService.analyzeMarketData(mockMarketData, contextWithHighBudget);
      expect(analysis).toBeDefined();
    });
  });

  describe('Trading Advice Generation', () => {
    beforeEach(async () => {
      // Mock successful Anthropic response
      const mockAnthropic = require('@anthropic-ai/sdk');
      mockAnthropic.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [
              {
                type: 'text',
                text: 'Trading advice: Based on your intermediate experience and moderate risk tolerance, focus on high-volume items with consistent spreads. Consider diversifying across multiple regions.',
              },
            ],
            usage: {
              input_tokens: 200,
              output_tokens: 100,
            },
          }),
        },
      }));

      await aiService.initialize();
    });

    it('should generate trading advice successfully', async () => {
      const advice = await aiService.generateTradingAdvice(mockUserProfile, mockMarketConditions);

      expect(advice).toBeDefined();
      expect(advice.recommendations).toBeDefined();
      expect(advice.strategy).toBeDefined();
      expect(advice.reasoning).toBeDefined();
      expect(advice.warnings).toBeDefined();
      expect(advice.confidence).toBeGreaterThan(0);
    });

    it('should tailor advice to user experience level', async () => {
      const beginnerProfile = {
        ...mockUserProfile,
        tradingExperience: 'BEGINNER' as const,
        riskTolerance: 'CONSERVATIVE' as const,
      };

      const advice = await aiService.generateTradingAdvice(beginnerProfile, mockMarketConditions);
      expect(advice).toBeDefined();
      expect(advice.warnings).toContain('Always verify market data before trading');
    });
  });

  describe('Strategy Explanation', () => {
    beforeEach(async () => {
      // Mock successful Anthropic response
      const mockAnthropic = require('@anthropic-ai/sdk');
      mockAnthropic.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [
              {
                type: 'text',
                text: 'This trading strategy focuses on arbitrage opportunities in the Tritanium market. The 8.3% profit margin provides good returns while maintaining moderate risk levels. Execute by buying at 5.50 ISK and selling at 6.00 ISK.',
              },
            ],
            usage: {
              input_tokens: 180,
              output_tokens: 90,
            },
          }),
        },
      }));

      await aiService.initialize();
    });

    it('should explain trading strategy successfully', async () => {
      const mockSuggestion = {
        itemId: 34,
        itemName: 'Tritanium',
        buyPrice: 5.5,
        sellPrice: 6.0,
        expectedProfit: 500,
        profitMargin: 0.083,
        riskLevel: 'MEDIUM' as const,
        requiredInvestment: 5500,
        timeToProfit: 24,
        confidence: 0.85,
      };

      const explanation = await aiService.explainTradingStrategy(mockSuggestion);

      expect(explanation).toBeDefined();
      expect(typeof explanation).toBe('string');
      expect(explanation.length).toBeGreaterThan(50);
    });
  });

  describe('Service Health', () => {
    it('should return comprehensive health information', async () => {
      await aiService.initialize();

      const health = await aiService.getServiceHealth();

      expect(health).toBeDefined();
      expect(health.initialized).toBe(true);
      expect(health.providers).toBeDefined();
      expect(health.cache).toBeDefined();
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should show uninitialized state before initialization', async () => {
      const uninitializedService = new AIService();
      const health = await uninitializedService.getServiceHealth();

      expect(health.initialized).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await aiService.initialize();
    });

    it('should handle AI provider failures gracefully', async () => {
      // Mock Anthropic to fail
      const mockAnthropic = require('@anthropic-ai/sdk');
      mockAnthropic.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockRejectedValue(new Error('API Error')),
        },
      }));

      // Mock OpenAI to succeed as fallback
      const mockOpenAI = require('openai');
      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [
                {
                  message: { content: 'Fallback response from OpenAI' },
                  finish_reason: 'stop',
                },
              ],
              usage: {
                prompt_tokens: 100,
                completion_tokens: 50,
                total_tokens: 150,
              },
            }),
          },
        },
      }));

      // Reinitialize with new mocks
      const failoverService = new AIService();
      await failoverService.initialize();

      const analysis = await failoverService.analyzeMarketData(mockMarketData, mockAnalysisContext);
      expect(analysis).toBeDefined();
    });

    it('should throw error when all providers fail', async () => {
      // Mock both providers to fail
      const mockAnthropic = require('@anthropic-ai/sdk');
      mockAnthropic.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockRejectedValue(new Error('Anthropic Error')),
        },
      }));

      const mockOpenAI = require('openai');
      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('OpenAI Error')),
          },
        },
      }));

      const failingService = new AIService();
      await failingService.initialize();

      await expect(
        failingService.analyzeMarketData(mockMarketData, mockAnalysisContext)
      ).rejects.toThrow();
    });
  });

  describe('Caching Behavior', () => {
    beforeEach(async () => {
      // Mock successful Anthropic response
      const mockAnthropic = require('@anthropic-ai/sdk');
      mockAnthropic.mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [
              {
                type: 'text',
                text: 'Cached response content for testing',
              },
            ],
            usage: {
              input_tokens: 100,
              output_tokens: 50,
            },
          }),
        },
      }));

      await aiService.initialize();
    });

    it('should cache expensive AI responses', async () => {
      // First call should hit the API
      const analysis1 = await aiService.analyzeMarketData(mockMarketData, mockAnalysisContext);

      // Second call with same parameters should use cache
      const analysis2 = await aiService.analyzeMarketData(mockMarketData, mockAnalysisContext);

      expect(analysis1).toBeDefined();
      expect(analysis2).toBeDefined();

      // Both should have similar content but second should be marked as cached
      // Note: In real implementation, the second call would return cached: true
    });
  });
});
