import { TradingSuggestionEngine } from '../../services/tradingSuggestionEngine';
import { MarketData, AnalysisContext } from '@shared/types';

describe('TradingSuggestionEngine', () => {
  let engine: TradingSuggestionEngine;

  beforeEach(() => {
    engine = new TradingSuggestionEngine();
  });

  describe('generateSuggestions', () => {
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
          {
            orderId: 2,
            typeId: 34,
            regionId: 10000002,
            locationId: 60003760,
            price: 95,
            volume: 500,
            minVolume: 1,
            duration: 90,
            issued: new Date(),
            isBuyOrder: true,
          },
        ],
        sellOrders: [
          {
            orderId: 3,
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
          {
            orderId: 4,
            typeId: 34,
            regionId: 10000002,
            locationId: 60003760,
            price: 85,
            volume: 600,
            minVolume: 1,
            duration: 90,
            issued: new Date(),
            isBuyOrder: false,
          },
        ],
        lastUpdated: new Date(),
        volume: 2900,
        averagePrice: 90,
      },
    ];

    const mockContext: AnalysisContext = {
      userId: 'test-user',
      budget: 100000,
      riskTolerance: 'AGGRESSIVE',
      preferredRegions: [10000002],
      timeHorizon: 'MEDIUM',
    };

    it('should generate trading suggestions from market data', async () => {
      const suggestions = await engine.generateSuggestions(mockMarketData, mockContext, 5);

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);

      const suggestion = suggestions[0];
      expect(suggestion).toHaveProperty('itemId');
      expect(suggestion).toHaveProperty('buyPrice');
      expect(suggestion).toHaveProperty('sellPrice');
      expect(suggestion).toHaveProperty('expectedProfit');
      expect(suggestion).toHaveProperty('profitMargin');
      expect(suggestion).toHaveProperty('riskLevel');
      expect(suggestion).toHaveProperty('requiredInvestment');
      expect(suggestion).toHaveProperty('confidence');
    });

    it('should calculate correct profit margins', async () => {
      const suggestions = await engine.generateSuggestions(mockMarketData, mockContext, 5);

      if (suggestions.length > 0) {
        const suggestion = suggestions[0]!;
        const expectedProfitMargin =
          (suggestion.sellPrice - suggestion.buyPrice) / suggestion.buyPrice;
        expect(Math.abs(suggestion.profitMargin - expectedProfitMargin)).toBeLessThan(0.001);
      }
    });

    it('should respect budget constraints', async () => {
      const smallBudgetContext: AnalysisContext = {
        ...mockContext,
        budget: 1000, // Small budget
      };

      const suggestions = await engine.generateSuggestions(mockMarketData, smallBudgetContext, 5);

      suggestions.forEach(suggestion => {
        expect(suggestion.requiredInvestment).toBeLessThanOrEqual(smallBudgetContext.budget * 0.3);
      });
    });

    it('should filter by risk tolerance', async () => {
      const conservativeContext: AnalysisContext = {
        ...mockContext,
        riskTolerance: 'CONSERVATIVE',
      };

      const suggestions = await engine.generateSuggestions(mockMarketData, conservativeContext, 5);

      suggestions.forEach(suggestion => {
        expect(['LOW'].includes(suggestion.riskLevel)).toBe(true);
      });
    });

    it('should handle empty market data', async () => {
      const suggestions = await engine.generateSuggestions([], mockContext, 5);
      expect(suggestions).toEqual([]);
    });

    it('should handle market data with no profitable opportunities', async () => {
      const unprofitableMarketData: MarketData[] = [
        {
          ...mockMarketData[0]!,
          buyOrders: [
            {
              ...mockMarketData[0]!.buyOrders[0]!,
              price: 80, // Lower buy price
            },
          ],
          sellOrders: [
            {
              ...mockMarketData[0]!.sellOrders[0]!,
              price: 85, // Higher sell price, making it unprofitable
            },
          ],
        },
      ];

      const suggestions = await engine.generateSuggestions(unprofitableMarketData, mockContext, 5);
      expect(suggestions.length).toBe(0);
    });
  });

  describe('calculateProfitMetrics', () => {
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

    it('should calculate correct profit metrics', () => {
      const metrics = engine.calculateProfitMetrics(mockSuggestion);

      expect(metrics.absoluteProfit).toBe(mockSuggestion.expectedProfit);
      expect(metrics.profitMargin).toBe(mockSuggestion.profitMargin);
      expect(metrics.roi).toBe(mockSuggestion.expectedProfit / mockSuggestion.requiredInvestment);
      expect(metrics.profitPerHour).toBe(
        mockSuggestion.expectedProfit / mockSuggestion.timeToProfit
      );
      expect(metrics.breakEvenVolume).toBeGreaterThan(0);
    });

    it('should calculate break-even volume correctly', () => {
      const metrics = engine.calculateProfitMetrics(mockSuggestion);
      const transactionCost = mockSuggestion.requiredInvestment * 0.01;
      const profitPerUnit = mockSuggestion.sellPrice - mockSuggestion.buyPrice;
      const expectedBreakEven = Math.ceil(transactionCost / profitPerUnit);

      expect(metrics.breakEvenVolume).toBe(expectedBreakEven);
    });
  });

  describe('validateSuggestion', () => {
    it('should validate a good suggestion', () => {
      const goodSuggestion = {
        itemId: 34,
        itemName: 'Tritanium',
        buyPrice: 80,
        sellPrice: 100,
        expectedProfit: 2000,
        profitMargin: 0.25, // 25% - above minimum
        riskLevel: 'MEDIUM' as const,
        requiredInvestment: 8000,
        timeToProfit: 24,
        confidence: 0.75, // Above minimum
      };

      const validation = engine.validateSuggestion(goodSuggestion);
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should reject suggestion with low profit margin', () => {
      const lowMarginSuggestion = {
        itemId: 34,
        itemName: 'Tritanium',
        buyPrice: 80,
        sellPrice: 82,
        expectedProfit: 200,
        profitMargin: 0.025, // 2.5% - below minimum
        riskLevel: 'MEDIUM' as const,
        requiredInvestment: 8000,
        timeToProfit: 24,
        confidence: 0.75,
      };

      const validation = engine.validateSuggestion(lowMarginSuggestion);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('Profit margin'))).toBe(true);
    });

    it('should reject suggestion with negative profit', () => {
      const negativeProfitSuggestion = {
        itemId: 34,
        itemName: 'Tritanium',
        buyPrice: 100,
        sellPrice: 80,
        expectedProfit: -2000,
        profitMargin: -0.2,
        riskLevel: 'HIGH' as const,
        requiredInvestment: 8000,
        timeToProfit: 24,
        confidence: 0.75,
      };

      const validation = engine.validateSuggestion(negativeProfitSuggestion);
      expect(validation.isValid).toBe(false);
      expect(
        validation.issues.some(issue => issue.includes('Expected profit must be positive'))
      ).toBe(true);
    });

    it('should reject suggestion with low confidence', () => {
      const lowConfidenceSuggestion = {
        itemId: 34,
        itemName: 'Tritanium',
        buyPrice: 80,
        sellPrice: 100,
        expectedProfit: 2000,
        profitMargin: 0.25,
        riskLevel: 'MEDIUM' as const,
        requiredInvestment: 8000,
        timeToProfit: 24,
        confidence: 0.2, // Below minimum
      };

      const validation = engine.validateSuggestion(lowConfidenceSuggestion);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('Confidence level too low'))).toBe(
        true
      );
    });
  });

  describe('risk calculation', () => {
    const mockMarketData: MarketData = {
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
        {
          orderId: 2,
          typeId: 34,
          regionId: 10000002,
          locationId: 60003760,
          price: 95,
          volume: 500,
          minVolume: 1,
          duration: 90,
          issued: new Date(),
          isBuyOrder: true,
        },
      ],
      sellOrders: [
        {
          orderId: 3,
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
        {
          orderId: 4,
          typeId: 34,
          regionId: 10000002,
          locationId: 60003760,
          price: 85,
          volume: 600,
          minVolume: 1,
          duration: 90,
          issued: new Date(),
          isBuyOrder: false,
        },
      ],
      lastUpdated: new Date(),
      volume: 2900,
      averagePrice: 90,
    };

    it('should calculate risk factors correctly', () => {
      // Access private method through any cast for testing
      const riskFactors = (engine as any).calculateRiskFactors(mockMarketData);

      expect(riskFactors).toHaveProperty('priceVolatility');
      expect(riskFactors).toHaveProperty('volumeStability');
      expect(riskFactors).toHaveProperty('competitionLevel');
      expect(riskFactors).toHaveProperty('marketDepth');
      expect(riskFactors).toHaveProperty('historicalReliability');

      // All risk factors should be between 0 and 1
      Object.values(riskFactors).forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });

    it('should aggregate risk score correctly', () => {
      const riskFactors = {
        priceVolatility: 0.3,
        volumeStability: 0.8,
        competitionLevel: 0.5,
        marketDepth: 0.7,
        historicalReliability: 0.6,
      };

      const riskScore = (engine as any).aggregateRiskScore(riskFactors);

      expect(riskScore).toBeGreaterThanOrEqual(0);
      expect(riskScore).toBeLessThanOrEqual(1);
    });
  });
});
