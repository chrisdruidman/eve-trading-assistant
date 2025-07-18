import {
  AIAgentService,
  MarketData,
  AnalysisContext,
  MarketAnalysis,
  UserProfile,
  MarketConditions,
  TradingAdvice,
  TradingSuggestion,
  AIResponse,
  AIOperation,
  TradingOpportunity,
  RiskAssessment,
  MarketTrend,
} from '../../../../shared/src/types';
import { AIProviderManagerImpl } from '../providers/manager';
import { AICacheManager } from '../cache/aiCache';
import { AnthropicProvider } from '../providers/anthropic';
import { OpenAIProvider } from '../providers/openai';
import { MarketAnalysisService } from './marketAnalysisService';

/**
 * Main AI Agent Service
 * Orchestrates AI providers and provides trading analysis capabilities
 */
export class AIService implements AIAgentService {
  private providerManager: AIProviderManagerImpl;
  private cache: AICacheManager;
  private marketAnalysisService: MarketAnalysisService;
  private initialized = false;

  constructor() {
    this.providerManager = new AIProviderManagerImpl();
    this.cache = new AICacheManager();
    this.marketAnalysisService = new MarketAnalysisService(this.providerManager, this.cache);
  }

  /**
   * Initialize the AI service with providers
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize cache
    await this.cache.initialize();

    // Register AI providers
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (anthropicKey) {
      const anthropicProvider = new AnthropicProvider(anthropicKey);
      this.providerManager.registerProvider(anthropicProvider);
    }

    if (openaiKey) {
      const openaiProvider = new OpenAIProvider(openaiKey);
      this.providerManager.registerProvider(openaiProvider);
    }

    // Set provider priority (Anthropic first, OpenAI as fallback)
    const availableProviders = [];
    if (anthropicKey) availableProviders.push('anthropic');
    if (openaiKey) availableProviders.push('openai');

    if (availableProviders.length === 0) {
      throw new Error('No AI provider API keys configured');
    }

    this.providerManager.setProviderPriority(availableProviders);
    this.initialized = true;

    console.log('AI Service initialized with providers:', availableProviders);
  }

  /**
   * Analyze market data and provide comprehensive insights
   */
  async analyzeMarketData(
    marketData: MarketData[],
    context: AnalysisContext
  ): Promise<MarketAnalysis> {
    await this.ensureInitialized();
    return this.marketAnalysisService.analyzeMarketData(marketData, context);
  }

  /**
   * Identify trading opportunities with detailed analysis
   */
  async identifyTradingOpportunities(
    marketData: MarketData[],
    context: AnalysisContext
  ): Promise<TradingOpportunity[]> {
    await this.ensureInitialized();
    return this.marketAnalysisService.identifyTradingOpportunities(marketData, context);
  }

  /**
   * Assess profit margins and risks for trading suggestions
   */
  async assessProfitAndRisk(
    suggestions: TradingSuggestion[],
    marketData: MarketData[],
    context: AnalysisContext
  ): Promise<{ suggestions: TradingSuggestion[]; risks: RiskAssessment[] }> {
    await this.ensureInitialized();
    return this.marketAnalysisService.assessProfitAndRisk(suggestions, marketData, context);
  }

  /**
   * Predict market trends with AI analysis
   */
  async predictMarketTrends(
    marketData: MarketData[],
    historicalData: any[],
    context: AnalysisContext
  ): Promise<MarketTrend[]> {
    await this.ensureInitialized();
    return this.marketAnalysisService.predictMarketTrends(marketData, historicalData, context);
  }

  /**
   * Generate trading advice based on user profile and market conditions
   */
  async generateTradingAdvice(
    userProfile: UserProfile,
    marketConditions: MarketConditions
  ): Promise<TradingAdvice> {
    await this.ensureInitialized();

    const prompt = this.buildTradingAdvicePrompt(userProfile, marketConditions);
    const aiContext = {
      analysisType: 'trading_advice',
      userProfile,
      marketConditions,
    };

    const response = await this.executeWithCache(prompt, aiContext);
    return this.parseTradingAdvice(response);
  }

  /**
   * Explain trading strategy for a given suggestion
   */
  async explainTradingStrategy(suggestion: TradingSuggestion): Promise<string> {
    await this.ensureInitialized();

    const prompt = `Explain the trading strategy and reasoning behind this trading suggestion:

Item: ${suggestion.itemName} (ID: ${suggestion.itemId})
Buy Price: ${suggestion.buyPrice.toLocaleString()} ISK
Sell Price: ${suggestion.sellPrice.toLocaleString()} ISK
Expected Profit: ${suggestion.expectedProfit.toLocaleString()} ISK
Profit Margin: ${(suggestion.profitMargin * 100).toFixed(2)}%
Risk Level: ${suggestion.riskLevel}
Required Investment: ${suggestion.requiredInvestment.toLocaleString()} ISK
Time to Profit: ${suggestion.timeToProfit} hours
Confidence: ${(suggestion.confidence * 100).toFixed(1)}%

Please provide:
1. Why this is a good trading opportunity
2. What risks to be aware of
3. How to execute this trade effectively
4. Market factors that support this recommendation
5. Tips for maximizing profit and minimizing risk

Keep the explanation clear and educational for traders of all experience levels.`;

    const aiContext = {
      analysisType: 'strategy_explanation',
      suggestion,
    };

    const response = await this.executeWithCache(prompt, aiContext);
    return response.content;
  }

  /**
   * Get service health and statistics
   */
  async getServiceHealth(): Promise<ServiceHealth> {
    const providerStats = this.providerManager.getProviderStats();
    const cacheStats = await this.cache.getStats();

    return {
      initialized: this.initialized,
      providers: providerStats,
      cache: cacheStats,
      timestamp: new Date(),
    };
  }

  /**
   * Get enhanced service health with detailed performance metrics
   */
  async getEnhancedServiceHealth(): Promise<EnhancedServiceHealth> {
    const providerStats = this.providerManager.getEnhancedProviderStats();
    const cacheStats = await this.cache.getStats();

    return {
      initialized: this.initialized,
      providers: providerStats,
      cache: cacheStats,
      timestamp: new Date(),
      systemMetrics: {
        totalProviders: providerStats.totalProviders,
        activeProviders: providerStats.activeProviders,
        primaryProvider: providerStats.primary,
        failoverCapable: providerStats.activeProviders > 1,
      },
    };
  }

  /**
   * Execute AI operation with caching
   */
  private async executeWithCache(prompt: string, context: any): Promise<AIResponse> {
    // Try to get from cache first
    const provider = await this.providerManager.getAvailableProvider();
    const cached = await this.cache.get(prompt, context, provider.name);

    if (cached) {
      return cached;
    }

    // Execute with failover
    const operation: AIOperation = {
      prompt,
      context,
      maxRetries: 3,
      timeout: 30000,
    };

    const response = await this.providerManager.executeWithFailover(operation);

    // Cache the response if it meets criteria
    const estimatedCost = provider.estimateCost(prompt);
    if (this.cache.shouldCache(response, estimatedCost)) {
      // Cache for 1 hour for expensive/detailed responses, 30 minutes for others
      const ttl = estimatedCost > 0.01 || response.content.length > 1000 ? 3600 : 1800;
      await this.cache.set(prompt, context, provider.name, response, ttl);
    }

    return response;
  }

  /**
   * Build market analysis prompt
   */
  private buildMarketAnalysisPrompt(marketData: MarketData[], context: AnalysisContext): string {
    return `Analyze the following EVE Online market data and provide comprehensive trading insights:

User Context:
- Available Budget: ${context.budget.toLocaleString()} ISK
- Risk Tolerance: ${context.riskTolerance}
- Preferred Regions: ${context.preferredRegions.join(', ')}
- Time Horizon: ${context.timeHorizon}

Market Data Summary:
${marketData
  .map(
    data => `
- Item ID ${data.typeId} in Region ${data.regionId}:
  - Buy Orders: ${data.buyOrders.length} (Highest: ${Math.max(...data.buyOrders.map(o => o.price)).toLocaleString()} ISK)
  - Sell Orders: ${data.sellOrders.length} (Lowest: ${Math.min(...data.sellOrders.map(o => o.price)).toLocaleString()} ISK)
  - Volume: ${data.volume.toLocaleString()}
  - Average Price: ${data.averagePrice.toLocaleString()} ISK
`
  )
  .join('')}

Please provide:
1. Market trend analysis for each item
2. Trading opportunities with profit potential
3. Risk assessment and market volatility indicators
4. Recommended trading strategies based on user's risk tolerance
5. Budget allocation suggestions

Format your response as a structured analysis with clear sections.`;
  }

  /**
   * Build trading advice prompt
   */
  private buildTradingAdvicePrompt(
    userProfile: UserProfile,
    marketConditions: MarketConditions
  ): string {
    return `Provide personalized trading advice for an EVE Online player:

Trader Profile:
- Experience Level: ${userProfile.tradingExperience}
- Risk Tolerance: ${userProfile.riskTolerance}
- Available Budget: ${userProfile.availableBudget.toLocaleString()} ISK
- Preferred Markets: ${userProfile.preferredMarkets.join(', ')}
- Trading Goals: ${userProfile.tradingGoals.join(', ')}

Current Market Conditions:
- Volatility: ${marketConditions.volatility}
- Liquidity: ${marketConditions.liquidity}
- Overall Trend: ${marketConditions.trend}
- Major Events: ${marketConditions.majorEvents.join(', ')}

Please provide:
1. Specific trading recommendations suited to this trader's profile
2. Risk management strategies
3. Budget allocation advice
4. Market timing considerations
5. Educational tips to improve trading skills

Tailor your advice to the trader's experience level and risk tolerance.`;
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
    }));
  }

  /**
   * Parse AI response into MarketAnalysis structure
   */
  private parseMarketAnalysis(response: AIResponse, marketData: MarketData[]): MarketAnalysis {
    // This is a simplified parser - in production, you'd want more sophisticated parsing
    return {
      summary: response.content.substring(0, 500) + '...',
      trends: marketData.map(data => ({
        typeId: data.typeId,
        regionId: data.regionId,
        direction: 'STABLE' as const,
        strength: 0.5,
        timeframe: '24h',
        description: 'Market analysis based on current data',
      })),
      opportunities: [],
      risks: [
        {
          factor: 'Market Volatility',
          level: 'MEDIUM' as const,
          description: 'Standard market risks apply',
          mitigation: 'Diversify trades and monitor closely',
        },
      ],
      confidence: response.confidence,
      generatedAt: new Date(),
    };
  }

  /**
   * Parse AI response into TradingAdvice structure
   */
  private parseTradingAdvice(response: AIResponse): TradingAdvice {
    // Simplified parser - would need more sophisticated parsing in production
    return {
      recommendations: [],
      strategy: response.content.substring(0, 200),
      reasoning: response.content,
      warnings: ['Always verify market data before trading'],
      confidence: response.confidence,
    };
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

/**
 * Service health interface
 */
export interface ServiceHealth {
  initialized: boolean;
  providers: Record<string, any>;
  cache: any;
  timestamp: Date;
}

/**
 * Enhanced service health interface with detailed metrics
 */
export interface EnhancedServiceHealth {
  initialized: boolean;
  providers: Record<string, any>;
  cache: any;
  timestamp: Date;
  systemMetrics: {
    totalProviders: number;
    activeProviders: number;
    primaryProvider: string | null;
    failoverCapable: boolean;
  };
}
