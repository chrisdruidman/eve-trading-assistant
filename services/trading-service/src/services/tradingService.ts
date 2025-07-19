import {
  TradingSuggestion,
  TradingPlan,
  TradingPlanParams,
  ExecutedTrade,
  MarketData,
  AnalysisContext,
  UserProfile,
} from '@shared/types';
import { TradingSuggestionEngine } from './tradingSuggestionEngine';

export class TradingService {
  private suggestionEngine: TradingSuggestionEngine;

  constructor() {
    this.suggestionEngine = new TradingSuggestionEngine();
  }

  /**
   * Generate trading suggestions for a user
   */
  async generateTradingSuggestions(
    userId: string,
    budget: number,
    marketData: MarketData[],
    userProfile?: UserProfile
  ): Promise<TradingSuggestion[]> {
    // Create analysis context
    const context: AnalysisContext = {
      userId,
      budget,
      riskTolerance: userProfile?.riskTolerance || 'MODERATE',
      preferredRegions: userProfile?.preferredMarkets || [10000002], // Default to The Forge
      timeHorizon: 'MEDIUM',
    };

    // Generate suggestions using the engine
    const suggestions = await this.suggestionEngine.generateSuggestions(
      marketData,
      context,
      10 // Max 10 suggestions
    );

    // Validate all suggestions
    const validSuggestions = suggestions.filter(suggestion => {
      const validation = this.suggestionEngine.validateSuggestion(suggestion);
      return validation.isValid;
    });

    return validSuggestions;
  }

  /**
   * Create a comprehensive trading plan
   */
  async createTradingPlan(
    userId: string,
    parameters: TradingPlanParams,
    marketData: MarketData[]
  ): Promise<TradingPlan> {
    // Generate suggestions based on parameters
    const context: AnalysisContext = {
      userId,
      budget: parameters.budget,
      riskTolerance: parameters.riskTolerance,
      preferredRegions: parameters.preferredRegions || [10000002],
      timeHorizon: 'MEDIUM',
    };

    let suggestions = await this.suggestionEngine.generateSuggestions(
      marketData,
      context,
      20 // Generate more suggestions for plan optimization
    );

    // Apply additional filters from parameters
    if (parameters.excludedItems && parameters.excludedItems.length > 0) {
      suggestions = suggestions.filter(s => !parameters.excludedItems!.includes(s.itemId));
    }

    if (parameters.maxInvestmentPerTrade) {
      suggestions = suggestions.filter(
        s => s.requiredInvestment <= parameters.maxInvestmentPerTrade!
      );
    }

    // Optimize suggestion selection for the plan
    const optimizedSuggestions = this.optimizeTradingPlan(suggestions, parameters);

    const tradingPlan: TradingPlan = {
      id: this.generatePlanId(),
      userId,
      budget: parameters.budget,
      riskTolerance: parameters.riskTolerance,
      suggestions: optimizedSuggestions,
      createdAt: new Date(),
      status: 'ACTIVE',
    };

    return tradingPlan;
  }

  /**
   * Optimize trading plan by selecting best combination of suggestions
   */
  private optimizeTradingPlan(
    suggestions: TradingSuggestion[],
    parameters: TradingPlanParams
  ): TradingSuggestion[] {
    const budget = parameters.budget;
    const maxInvestmentPerTrade = parameters.maxInvestmentPerTrade || budget * 0.3;

    // Sort by risk-adjusted profitability
    const sortedSuggestions = suggestions.sort((a, b) => {
      const aScore = this.calculatePlanScore(a, parameters.riskTolerance);
      const bScore = this.calculatePlanScore(b, parameters.riskTolerance);
      return bScore - aScore;
    });

    // Select suggestions that fit within budget using greedy algorithm
    const selectedSuggestions: TradingSuggestion[] = [];
    let remainingBudget = budget;

    for (const suggestion of sortedSuggestions) {
      if (
        suggestion.requiredInvestment <= remainingBudget &&
        suggestion.requiredInvestment <= maxInvestmentPerTrade
      ) {
        selectedSuggestions.push(suggestion);
        remainingBudget -= suggestion.requiredInvestment;

        // Stop if we have enough suggestions or budget is too low
        if (selectedSuggestions.length >= 8 || remainingBudget < budget * 0.1) {
          break;
        }
      }
    }

    return selectedSuggestions;
  }

  /**
   * Calculate plan score for suggestion optimization
   */
  private calculatePlanScore(
    suggestion: TradingSuggestion,
    riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
  ): number {
    const profitScore = suggestion.expectedProfit;
    const efficiencyScore = suggestion.expectedProfit / suggestion.requiredInvestment;
    const timeScore = 1000 / suggestion.timeToProfit; // Favor faster trades
    const confidenceScore = suggestion.confidence * 100;

    // Risk adjustment
    const riskMultiplier = this.getRiskMultiplier(suggestion.riskLevel, riskTolerance);

    return (
      (profitScore * 0.4 + efficiencyScore * 100 * 0.3 + timeScore * 0.2 + confidenceScore * 0.1) *
      riskMultiplier
    );
  }

  /**
   * Get risk multiplier for plan scoring
   */
  private getRiskMultiplier(
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH',
    riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
  ): number {
    const multipliers = {
      CONSERVATIVE: { LOW: 1.2, MEDIUM: 0.8, HIGH: 0.3 },
      MODERATE: { LOW: 1.0, MEDIUM: 1.1, HIGH: 0.9 },
      AGGRESSIVE: { LOW: 0.9, MEDIUM: 1.0, HIGH: 1.2 },
    };

    return multipliers[riskTolerance][riskLevel];
  }

  /**
   * Update user budget and recalculate suggestions if needed
   */
  async updateBudget(_userId: string, _newBudget: number): Promise<void> {
    // In a real implementation, this would update the database
    // and potentially recalculate active trading plans
    // TODO: Implement database update logic
    // TODO: Recalculate active trading plans if needed
  }

  /**
   * Track execution of a trade
   */
  async trackTradeExecution(_userId: string, _trade: ExecutedTrade): Promise<void> {
    // In a real implementation, this would:
    // 1. Store the trade execution in database
    // 2. Update user's available budget
    // 3. Track performance metrics
    // 4. Update trading plan status if applicable
    // TODO: Implement trade tracking logic
  }

  /**
   * Calculate portfolio-level metrics for a trading plan
   */
  calculatePortfolioMetrics(plan: TradingPlan): {
    totalInvestment: number;
    totalExpectedProfit: number;
    averageROI: number;
    averageRiskLevel: number;
    diversificationScore: number;
    timeToBreakEven: number;
  } {
    const suggestions = plan.suggestions;

    if (suggestions.length === 0) {
      return {
        totalInvestment: 0,
        totalExpectedProfit: 0,
        averageROI: 0,
        averageRiskLevel: 0,
        diversificationScore: 0,
        timeToBreakEven: 0,
      };
    }

    const totalInvestment = suggestions.reduce((sum, s) => sum + s.requiredInvestment, 0);
    const totalExpectedProfit = suggestions.reduce((sum, s) => sum + s.expectedProfit, 0);
    const averageROI = totalExpectedProfit / totalInvestment;

    // Calculate average risk level (convert to numeric)
    const riskValues = { LOW: 1, MEDIUM: 2, HIGH: 3 };
    const averageRiskLevel =
      suggestions.reduce((sum, s) => sum + riskValues[s.riskLevel], 0) / suggestions.length;

    // Calculate diversification score based on unique items
    const uniqueItems = new Set(suggestions.map(s => s.itemId)).size;
    const diversificationScore = uniqueItems / suggestions.length;

    // Calculate weighted average time to profit
    const weightedTimeSum = suggestions.reduce(
      (sum, s) => sum + s.timeToProfit * s.requiredInvestment,
      0
    );
    const timeToBreakEven = weightedTimeSum / totalInvestment;

    return {
      totalInvestment,
      totalExpectedProfit,
      averageROI,
      averageRiskLevel,
      diversificationScore,
      timeToBreakEven,
    };
  }

  /**
   * Generate a unique plan ID
   */
  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get detailed analysis for a specific suggestion
   */
  async getDetailedAnalysis(suggestion: TradingSuggestion): Promise<{
    profitMetrics: any;
    validation: any;
    riskAnalysis: {
      riskFactors: string[];
      mitigation: string[];
      confidence: number;
    };
  }> {
    const profitMetrics = this.suggestionEngine.calculateProfitMetrics(suggestion);
    const validation = this.suggestionEngine.validateSuggestion(suggestion);

    // Generate risk analysis
    const riskAnalysis = this.generateRiskAnalysis(suggestion);

    return {
      profitMetrics,
      validation,
      riskAnalysis,
    };
  }

  /**
   * Generate risk analysis for a suggestion
   */
  private generateRiskAnalysis(suggestion: TradingSuggestion): {
    riskFactors: string[];
    mitigation: string[];
    confidence: number;
  } {
    const riskFactors: string[] = [];
    const mitigation: string[] = [];

    // Analyze risk level
    switch (suggestion.riskLevel) {
      case 'HIGH':
        riskFactors.push('High market volatility', 'Significant competition', 'Low liquidity');
        mitigation.push(
          'Monitor market closely',
          'Consider smaller position size',
          'Set stop-loss orders'
        );
        break;
      case 'MEDIUM':
        riskFactors.push('Moderate market volatility', 'Some competition');
        mitigation.push('Regular monitoring recommended', 'Diversify across multiple trades');
        break;
      case 'LOW':
        riskFactors.push('Stable market conditions');
        mitigation.push('Standard monitoring sufficient');
        break;
    }

    // Analyze profit margin
    if (suggestion.profitMargin < 0.1) {
      riskFactors.push('Low profit margin');
      mitigation.push('Ensure accurate pricing', 'Account for transaction costs');
    }

    // Analyze time to profit
    if (suggestion.timeToProfit > 72) {
      riskFactors.push('Extended time to profit');
      mitigation.push('Consider market changes over time', 'Monitor for better opportunities');
    }

    return {
      riskFactors,
      mitigation,
      confidence: suggestion.confidence,
    };
  }
}
