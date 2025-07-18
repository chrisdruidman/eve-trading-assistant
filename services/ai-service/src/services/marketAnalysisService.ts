import {
  MarketData,
  AnalysisContext,
  MarketAnalysis,
  MarketTrend,
  TradingOpportunity,
  RiskAssessment,
  TradingSuggestion,
  AIResponse,
} from '../../../../shared/src/types';
import { AIProviderManagerImpl } from '../providers/manager';
import { AICacheManager } from '../cache/aiCache';

/**
 * Market Analysis Service
 * Provides sophisticated AI-powered market analysis capabilities
 */
export class MarketAnalysisService {
  private providerManager: AIProviderManagerImpl;
  private cache: AICacheManager;

  constructor(providerManager: AIProviderManagerImpl, cache: AICacheManager) {
    this.providerManager = providerManager;
    this.cache = cache;
  }

  /**
   * Analyze market data with comprehensive AI insights
   */
  async analyzeMarketData(
    marketData: MarketData[],
    context: AnalysisContext
  ): Promise<MarketAnalysis> {
    const prompt = this.buildComprehensiveMarketAnalysisPrompt(marketData, context);
    const aiContext = {
      analysisType: 'comprehensive_market_analysis',
      marketData: this.summarizeMarketData(marketData),
      userContext: context,
    };

    const response = await this.executeWithCache(prompt, aiContext);
    return this.parseComprehensiveMarketAnalysis(response, marketData, context);
  }

  /**
   * Identify trading opportunities with detailed analysis
   */
  async identifyTradingOpportunities(
    marketData: MarketData[],
    context: AnalysisContext
  ): Promise<TradingOpportunity[]> {
    const prompt = this.buildTradingOpportunityPrompt(marketData, context);
    const aiContext = {
      analysisType: 'trading_opportunities',
      marketData: this.summarizeMarketData(marketData),
      userContext: context,
    };

    const response = await this.executeWithCache(prompt, aiContext);
    return this.parseTradingOpportunities(response, marketData);
  }

  /**
   * Assess profit margins and risks for trading suggestions
   */
  async assessProfitAndRisk(
    suggestions: TradingSuggestion[],
    marketData: MarketData[],
    context: AnalysisContext
  ): Promise<{ suggestions: TradingSuggestion[]; risks: RiskAssessment[] }> {
    const prompt = this.buildProfitRiskAssessmentPrompt(suggestions, marketData, context);
    const aiContext = {
      analysisType: 'profit_risk_assessment',
      suggestions,
      marketData: this.summarizeMarketData(marketData),
      userContext: context,
    };

    const response = await this.executeWithCache(prompt, aiContext);
    return this.parseProfitRiskAssessment(response, suggestions);
  }

  /**
   * Predict market trends with AI analysis
   */
  async predictMarketTrends(
    marketData: MarketData[],
    historicalData: any[],
    context: AnalysisContext
  ): Promise<MarketTrend[]> {
    const prompt = this.buildTrendPredictionPrompt(marketData, historicalData, context);
    const aiContext = {
      analysisType: 'trend_prediction',
      marketData: this.summarizeMarketData(marketData),
      historicalData,
      userContext: context,
    };

    const response = await this.executeWithCache(prompt, aiContext);
    return this.parseMarketTrends(response, marketData);
  }

  /**
   * Build comprehensive market analysis prompt
   */
  private buildComprehensiveMarketAnalysisPrompt(
    marketData: MarketData[],
    context: AnalysisContext
  ): string {
    const marketSummary = this.formatMarketDataForPrompt(marketData);
    const userProfile = this.formatUserContextForPrompt(context);

    return `You are an expert EVE Online market analyst with deep knowledge of trading mechanics, market dynamics, and profit optimization. Analyze the following market data and provide comprehensive trading insights.

${userProfile}

MARKET DATA ANALYSIS:
${marketSummary}

ANALYSIS REQUIREMENTS:
Please provide a detailed analysis covering:

1. MARKET OVERVIEW
   - Current market state and liquidity assessment
   - Price spread analysis and trading volume evaluation
   - Market efficiency indicators and arbitrage potential

2. TREND ANALYSIS
   - Short-term price momentum (1-7 days)
   - Medium-term trend indicators (1-4 weeks)
   - Volume trend analysis and market participation
   - Seasonal or cyclical patterns if detectable

3. TRADING OPPORTUNITIES
   - Immediate arbitrage opportunities with profit calculations
   - Station trading opportunities with margin analysis
   - Regional trading routes with risk/reward assessment
   - Bulk trading opportunities for larger investments

4. RISK ASSESSMENT
   - Market volatility indicators and price stability
   - Liquidity risks and order book depth analysis
   - Competition analysis and market maker presence
   - External factors affecting market conditions

5. STRATEGIC RECOMMENDATIONS
   - Optimal entry and exit strategies
   - Position sizing recommendations based on risk tolerance
   - Timing considerations for trade execution
   - Portfolio diversification suggestions

6. PROFIT PROJECTIONS
   - Expected profit margins for identified opportunities
   - Time-to-profit estimates for different strategies
   - Risk-adjusted return calculations
   - Break-even analysis and worst-case scenarios

FORMAT YOUR RESPONSE AS STRUCTURED JSON:
{
  "summary": "Brief overview of market conditions and key insights",
  "trends": [
    {
      "typeId": number,
      "regionId": number,
      "direction": "UPWARD|DOWNWARD|STABLE",
      "strength": number (0-1),
      "timeframe": "SHORT|MEDIUM|LONG",
      "description": "Detailed trend explanation",
      "confidence": number (0-1)
    }
  ],
  "opportunities": [
    {
      "typeId": number,
      "regionId": number,
      "strategy": "ARBITRAGE|STATION_TRADING|REGIONAL_TRADING",
      "expectedProfit": number,
      "profitMargin": number,
      "riskLevel": "LOW|MEDIUM|HIGH",
      "timeToProfit": number (hours),
      "confidence": number (0-1),
      "description": "Detailed opportunity explanation"
    }
  ],
  "risks": [
    {
      "factor": "Risk factor name",
      "level": "LOW|MEDIUM|HIGH",
      "description": "Risk description and impact",
      "mitigation": "Suggested mitigation strategy",
      "probability": number (0-1)
    }
  ],
  "recommendations": {
    "immediate": ["List of immediate actions"],
    "shortTerm": ["Short-term strategic recommendations"],
    "longTerm": ["Long-term market positioning advice"]
  },
  "confidence": number (0-1)
}

Ensure all numerical values are realistic for EVE Online markets and all recommendations are actionable within the user's budget and risk tolerance.`;
  }

  /**
   * Build trading opportunity identification prompt
   */
  private buildTradingOpportunityPrompt(
    marketData: MarketData[],
    context: AnalysisContext
  ): string {
    const marketSummary = this.formatMarketDataForPrompt(marketData);
    const userProfile = this.formatUserContextForPrompt(context);

    return `As an EVE Online trading specialist, identify and analyze profitable trading opportunities from the provided market data.

${userProfile}

MARKET DATA:
${marketSummary}

OPPORTUNITY IDENTIFICATION CRITERIA:
- Minimum profit margin: ${this.getMinProfitMargin(context.riskTolerance)}%
- Maximum investment per trade: ${Math.floor(context.budget * 0.3).toLocaleString()} ISK
- Risk tolerance: ${context.riskTolerance}
- Time horizon: ${context.timeHorizon}

ANALYSIS FOCUS:
1. ARBITRAGE OPPORTUNITIES
   - Cross-region price differences
   - Station-to-station spreads within regions
   - Buy/sell order imbalances

2. MARKET MAKING OPPORTUNITIES
   - Wide bid-ask spreads suitable for market making
   - High-volume items with consistent trading activity
   - Stable price ranges with predictable fluctuations

3. TREND TRADING OPPORTUNITIES
   - Items showing strong directional momentum
   - Volume breakouts indicating trend continuation
   - Support and resistance level breaks

4. VALUE TRADING OPPORTUNITIES
   - Undervalued items based on historical averages
   - Oversold conditions with reversal potential
   - Fundamental value mismatches

For each opportunity, calculate:
- Required investment amount
- Expected profit and margin percentage
- Risk level based on volatility and liquidity
- Time to profit realization
- Confidence score based on data quality and market conditions

FORMAT AS JSON ARRAY:
[
  {
    "typeId": number,
    "regionId": number,
    "strategy": "ARBITRAGE|MARKET_MAKING|TREND_TRADING|VALUE_TRADING",
    "buyLocation": number,
    "sellLocation": number,
    "buyPrice": number,
    "sellPrice": number,
    "expectedProfit": number,
    "profitMargin": number,
    "requiredInvestment": number,
    "riskLevel": "LOW|MEDIUM|HIGH",
    "timeToProfit": number,
    "confidence": number,
    "description": "Detailed opportunity explanation",
    "executionSteps": ["Step-by-step execution guide"]
  }
]

Only include opportunities that meet the user's criteria and have realistic profit potential.`;
  }

  /**
   * Build profit and risk assessment prompt
   */
  private buildProfitRiskAssessmentPrompt(
    suggestions: TradingSuggestion[],
    marketData: MarketData[],
    context: AnalysisContext
  ): string {
    const suggestionsText = suggestions
      .map(
        (s, i) => `
SUGGESTION ${i + 1}:
- Item: ${s.itemName} (ID: ${s.itemId})
- Buy Price: ${s.buyPrice.toLocaleString()} ISK
- Sell Price: ${s.sellPrice.toLocaleString()} ISK
- Expected Profit: ${s.expectedProfit.toLocaleString()} ISK
- Profit Margin: ${(s.profitMargin * 100).toFixed(2)}%
- Risk Level: ${s.riskLevel}
- Investment: ${s.requiredInvestment.toLocaleString()} ISK
- Time to Profit: ${s.timeToProfit} hours`
      )
      .join('\n');

    return `As an EVE Online risk management expert, analyze the following trading suggestions and provide detailed profit and risk assessments.

USER PROFILE:
- Budget: ${context.budget.toLocaleString()} ISK
- Risk Tolerance: ${context.riskTolerance}
- Time Horizon: ${context.timeHorizon}

TRADING SUGGESTIONS TO ANALYZE:
${suggestionsText}

ASSESSMENT REQUIREMENTS:

1. PROFIT ANALYSIS
   - Validate profit calculations and assumptions
   - Assess profit probability and potential variations
   - Identify factors that could impact profitability
   - Calculate risk-adjusted returns

2. RISK ASSESSMENT
   - Market risk (price volatility, liquidity)
   - Execution risk (order fulfillment, timing)
   - Competition risk (other traders, market makers)
   - Systemic risk (game updates, economic changes)

3. PORTFOLIO IMPACT
   - Correlation between suggestions
   - Diversification benefits or concentration risks
   - Capital allocation optimization
   - Overall portfolio risk profile

4. SCENARIO ANALYSIS
   - Best case profit scenarios
   - Most likely profit outcomes
   - Worst case loss scenarios
   - Break-even analysis

5. RISK MITIGATION
   - Specific risk mitigation strategies
   - Position sizing recommendations
   - Stop-loss and profit-taking levels
   - Hedging opportunities

FORMAT AS JSON:
{
  "enhancedSuggestions": [
    {
      "originalIndex": number,
      "adjustedProfitMargin": number,
      "adjustedRiskLevel": "LOW|MEDIUM|HIGH",
      "profitProbability": number,
      "expectedValue": number,
      "worstCaseScenario": number,
      "bestCaseScenario": number,
      "recommendedPosition": number,
      "riskMitigationSteps": ["List of specific mitigation actions"]
    }
  ],
  "portfolioRisks": [
    {
      "factor": "Risk factor name",
      "level": "LOW|MEDIUM|HIGH",
      "description": "Detailed risk description",
      "mitigation": "Mitigation strategy",
      "affectedSuggestions": [numbers]
    }
  ],
  "overallAssessment": {
    "totalExpectedProfit": number,
    "totalRisk": "LOW|MEDIUM|HIGH",
    "diversificationScore": number,
    "recommendedCapitalAllocation": number,
    "confidence": number
  }
}`;
  }

  /**
   * Build trend prediction prompt
   */
  private buildTrendPredictionPrompt(
    marketData: MarketData[],
    historicalData: any[],
    context: AnalysisContext
  ): string {
    const marketSummary = this.formatMarketDataForPrompt(marketData);
    const historicalSummary = this.formatHistoricalDataForPrompt(historicalData);

    return `As an EVE Online market forecasting expert, analyze current and historical market data to predict future price trends and market movements.

CURRENT MARKET DATA:
${marketSummary}

HISTORICAL DATA PATTERNS:
${historicalSummary}

TREND PREDICTION ANALYSIS:

1. TECHNICAL ANALYSIS
   - Price momentum indicators
   - Volume trend analysis
   - Support and resistance levels
   - Moving average convergence/divergence

2. MARKET STRUCTURE ANALYSIS
   - Order book depth and distribution
   - Bid-ask spread evolution
   - Market maker activity patterns
   - Trading volume patterns

3. CYCLICAL PATTERN RECOGNITION
   - Weekly trading cycles
   - Monthly market patterns
   - Seasonal variations
   - Event-driven market movements

4. PREDICTIVE MODELING
   - Short-term price direction (1-7 days)
   - Medium-term trend projection (1-4 weeks)
   - Long-term market outlook (1-3 months)
   - Volatility forecasting

5. CONFIDENCE ASSESSMENT
   - Data quality and completeness
   - Pattern reliability and consistency
   - Market condition stability
   - External factor impact

FORMAT AS JSON ARRAY:
[
  {
    "typeId": number,
    "regionId": number,
    "shortTermTrend": {
      "direction": "UPWARD|DOWNWARD|STABLE",
      "strength": number (0-1),
      "duration": "1-7 days",
      "priceTarget": number,
      "confidence": number (0-1)
    },
    "mediumTermTrend": {
      "direction": "UPWARD|DOWNWARD|STABLE",
      "strength": number (0-1),
      "duration": "1-4 weeks",
      "priceTarget": number,
      "confidence": number (0-1)
    },
    "keyFactors": ["List of factors driving the trend"],
    "riskFactors": ["List of factors that could disrupt the trend"],
    "tradingImplications": "How traders should position for this trend",
    "volatilityForecast": number (0-1)
  }
]

Provide realistic and actionable trend predictions based on solid market analysis principles.`;
  }

  /**
   * Format market data for AI prompts
   */
  private formatMarketDataForPrompt(marketData: MarketData[]): string {
    return marketData
      .map(data => {
        const bestBuy = Math.max(...data.buyOrders.map(o => o.price));
        const bestSell = Math.min(...data.sellOrders.map(o => o.price));
        const spread = bestSell - bestBuy;
        const spreadPercent = ((spread / bestBuy) * 100).toFixed(2);

        return `
ITEM ${data.typeId} - REGION ${data.regionId}:
- Best Buy Order: ${bestBuy.toLocaleString()} ISK
- Best Sell Order: ${bestSell.toLocaleString()} ISK
- Spread: ${spread.toLocaleString()} ISK (${spreadPercent}%)
- Buy Orders: ${data.buyOrders.length} orders
- Sell Orders: ${data.sellOrders.length} orders
- 24h Volume: ${data.volume.toLocaleString()} units
- Average Price: ${data.averagePrice.toLocaleString()} ISK
- Last Updated: ${data.lastUpdated.toISOString()}
- Order Book Depth: Buy ${data.buyOrders.reduce((sum, o) => sum + o.volume, 0).toLocaleString()} | Sell ${data.sellOrders.reduce((sum, o) => sum + o.volume, 0).toLocaleString()}`;
      })
      .join('\n');
  }

  /**
   * Format user context for AI prompts
   */
  private formatUserContextForPrompt(context: AnalysisContext): string {
    return `
USER TRADING PROFILE:
- Available Budget: ${context.budget.toLocaleString()} ISK
- Risk Tolerance: ${context.riskTolerance}
- Preferred Regions: ${context.preferredRegions.join(', ')}
- Time Horizon: ${context.timeHorizon}
- User ID: ${context.userId}`;
  }

  /**
   * Format historical data for AI prompts
   */
  private formatHistoricalDataForPrompt(historicalData: any[]): string {
    if (!historicalData || historicalData.length === 0) {
      return 'No historical data available for trend analysis.';
    }

    return historicalData
      .slice(0, 10) // Limit to recent data
      .map(
        data => `
Date: ${data.date} | High: ${data.highest?.toLocaleString()} | Low: ${data.lowest?.toLocaleString()} | Avg: ${data.average?.toLocaleString()} | Volume: ${data.volume?.toLocaleString()}`
      )
      .join('\n');
  }

  /**
   * Get minimum profit margin based on risk tolerance
   */
  private getMinProfitMargin(riskTolerance: string): number {
    switch (riskTolerance) {
      case 'CONSERVATIVE':
        return 15;
      case 'MODERATE':
        return 10;
      case 'AGGRESSIVE':
        return 5;
      default:
        return 10;
    }
  }

  /**
   * Summarize market data for AI context
   */
  private summarizeMarketData(marketData: MarketData[]): any {
    return marketData.map(data => ({
      typeId: data.typeId,
      regionId: data.regionId,
      bestBuyPrice: Math.max(...data.buyOrders.map(o => o.price)),
      bestSellPrice: Math.min(...data.sellOrders.map(o => o.price)),
      spread:
        Math.min(...data.sellOrders.map(o => o.price)) -
        Math.max(...data.buyOrders.map(o => o.price)),
      volume: data.volume,
      orderCount: data.buyOrders.length + data.sellOrders.length,
      lastUpdated: data.lastUpdated,
    }));
  }

  /**
   * Execute AI operation with caching
   */
  private async executeWithCache(prompt: string, context: any): Promise<AIResponse> {
    const provider = await this.providerManager.getAvailableProvider();
    const cached = await this.cache.get(prompt, context, provider.name);

    if (cached) {
      return cached;
    }

    const operation = {
      prompt,
      context,
      maxRetries: 3,
      timeout: 45000, // Longer timeout for complex analysis
    };

    const response = await this.providerManager.executeWithFailover(operation);

    // Cache expensive analysis responses for longer
    const estimatedCost = provider.estimateCost(prompt);
    if (this.cache.shouldCache(response, estimatedCost)) {
      const ttl = estimatedCost > 0.02 || response.content.length > 2000 ? 7200 : 3600; // 2 hours for expensive, 1 hour for others
      await this.cache.set(prompt, context, provider.name, response, ttl);
    }

    return response;
  }

  /**
   * Parse comprehensive market analysis from AI response
   */
  private parseComprehensiveMarketAnalysis(
    response: AIResponse,
    marketData: MarketData[],
    context: AnalysisContext
  ): MarketAnalysis {
    try {
      const parsed = JSON.parse(response.content);

      return {
        summary: parsed.summary || 'Market analysis completed',
        trends: parsed.trends || this.generateDefaultTrends(marketData),
        opportunities:
          parsed.opportunities?.map((opp: any) => ({
            typeId: opp.typeId,
            regionId: opp.regionId,
            buyLocation: opp.buyLocation || 0,
            sellLocation: opp.sellLocation || 0,
            expectedProfit: opp.expectedProfit || 0,
            riskLevel: opp.riskLevel || 'MEDIUM',
            confidence: opp.confidence || 0.5,
          })) || [],
        risks: parsed.risks || this.generateDefaultRisks(),
        confidence: parsed.confidence || response.confidence,
        generatedAt: new Date(),
      };
    } catch (error) {
      // Fallback to basic analysis if JSON parsing fails
      return this.generateFallbackAnalysis(response, marketData, context);
    }
  }

  /**
   * Parse trading opportunities from AI response
   */
  private parseTradingOpportunities(
    response: AIResponse,
    marketData: MarketData[]
  ): TradingOpportunity[] {
    try {
      const parsed = JSON.parse(response.content);

      if (Array.isArray(parsed)) {
        return parsed.map((opp: any) => ({
          typeId: opp.typeId,
          regionId: opp.regionId,
          buyLocation: opp.buyLocation || 0,
          sellLocation: opp.sellLocation || 0,
          expectedProfit: opp.expectedProfit || 0,
          riskLevel: opp.riskLevel || 'MEDIUM',
          confidence: opp.confidence || 0.5,
        }));
      }
    } catch (error) {
      // Return empty array if parsing fails
    }

    return [];
  }

  /**
   * Parse profit and risk assessment from AI response
   */
  private parseProfitRiskAssessment(
    response: AIResponse,
    suggestions: TradingSuggestion[]
  ): { suggestions: TradingSuggestion[]; risks: RiskAssessment[] } {
    try {
      const parsed = JSON.parse(response.content);

      const enhancedSuggestions = suggestions.map((suggestion, index) => {
        const enhancement = parsed.enhancedSuggestions?.find((e: any) => e.originalIndex === index);
        if (enhancement) {
          return {
            ...suggestion,
            profitMargin: enhancement.adjustedProfitMargin || suggestion.profitMargin,
            riskLevel: enhancement.adjustedRiskLevel || suggestion.riskLevel,
            confidence: enhancement.profitProbability || suggestion.confidence,
          };
        }
        return suggestion;
      });

      const risks = parsed.portfolioRisks || this.generateDefaultRisks();

      return { suggestions: enhancedSuggestions, risks };
    } catch (error) {
      return { suggestions, risks: this.generateDefaultRisks() };
    }
  }

  /**
   * Parse market trends from AI response
   */
  private parseMarketTrends(response: AIResponse, marketData: MarketData[]): MarketTrend[] {
    try {
      const parsed = JSON.parse(response.content);

      if (Array.isArray(parsed)) {
        return parsed.map((trend: any) => ({
          typeId: trend.typeId,
          regionId: trend.regionId,
          direction: trend.shortTermTrend?.direction || 'STABLE',
          strength: trend.shortTermTrend?.strength || 0.5,
          timeframe: trend.shortTermTrend?.duration || 'SHORT',
          description: trend.tradingImplications || 'Market trend analysis',
        }));
      }
    } catch (error) {
      // Return default trends if parsing fails
    }

    return this.generateDefaultTrends(marketData);
  }

  /**
   * Generate default trends when AI parsing fails
   */
  private generateDefaultTrends(marketData: MarketData[]): MarketTrend[] {
    return marketData.map(data => ({
      typeId: data.typeId,
      regionId: data.regionId,
      direction: 'STABLE' as const,
      strength: 0.5,
      timeframe: 'SHORT',
      description: 'Market analysis based on current order book data',
    }));
  }

  /**
   * Generate default risks when AI parsing fails
   */
  private generateDefaultRisks(): RiskAssessment[] {
    return [
      {
        factor: 'Market Volatility',
        level: 'MEDIUM',
        description: 'Standard market volatility risks apply to all trading activities',
        mitigation: 'Monitor market conditions closely and use appropriate position sizing',
      },
      {
        factor: 'Liquidity Risk',
        level: 'MEDIUM',
        description: 'Risk of insufficient market liquidity affecting trade execution',
        mitigation: 'Verify order book depth before executing large trades',
      },
    ];
  }

  /**
   * Generate fallback analysis when JSON parsing completely fails
   */
  private generateFallbackAnalysis(
    response: AIResponse,
    marketData: MarketData[],
    context: AnalysisContext
  ): MarketAnalysis {
    return {
      summary: response.content.substring(0, 500) + '...',
      trends: this.generateDefaultTrends(marketData),
      opportunities: [],
      risks: this.generateDefaultRisks(),
      confidence: response.confidence * 0.7, // Lower confidence for fallback
      generatedAt: new Date(),
    };
  }
}
