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
import { TradingPlanRepository } from '../models/tradingPlanRepository';

export class TradingService {
  private suggestionEngine: TradingSuggestionEngine;
  private tradingPlanRepository: TradingPlanRepository;

  constructor() {
    this.suggestionEngine = new TradingSuggestionEngine();
    this.tradingPlanRepository = new TradingPlanRepository();
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
    parameters: TradingPlanParams & { name: string },
    marketData: MarketData[]
  ): Promise<TradingPlan> {
    // Validate parameters
    this.validateTradingPlanParams(parameters);

    // Assess risk tolerance and adjust parameters
    const adjustedParams = this.assessAndAdjustRiskTolerance(parameters);

    // Generate suggestions based on parameters
    const context: AnalysisContext = {
      userId,
      budget: adjustedParams.budget,
      riskTolerance: adjustedParams.riskTolerance,
      preferredRegions: adjustedParams.preferredRegions || [10000002],
      timeHorizon: 'MEDIUM',
    };

    let suggestions = await this.suggestionEngine.generateSuggestions(
      marketData,
      context,
      20 // Generate more suggestions for plan optimization
    );

    // Apply additional filters from parameters
    if (adjustedParams.excludedItems && adjustedParams.excludedItems.length > 0) {
      suggestions = suggestions.filter(s => !adjustedParams.excludedItems!.includes(s.itemId));
    }

    if (adjustedParams.maxInvestmentPerTrade) {
      suggestions = suggestions.filter(
        s => s.requiredInvestment <= adjustedParams.maxInvestmentPerTrade!
      );
    }

    // Optimize suggestion selection for the plan
    const optimizedSuggestions = this.optimizeTradingPlan(suggestions, adjustedParams);

    // Create and persist the trading plan
    const tradingPlan = await this.tradingPlanRepository.createTradingPlan(
      userId,
      adjustedParams,
      optimizedSuggestions
    );

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
   * Update trading plan budget
   */
  async updateTradingPlanBudget(planId: string, newBudget: number): Promise<boolean> {
    if (newBudget <= 0) {
      throw new Error('Budget must be greater than 0');
    }

    return await this.tradingPlanRepository.updateTradingPlanBudget(planId, newBudget);
  }

  /**
   * Update user budget and recalculate suggestions if needed
   */
  async updateBudget(userId: string, newBudget: number): Promise<void> {
    if (newBudget <= 0) {
      throw new Error('Budget must be greater than 0');
    }

    // Get all active trading plans for the user
    const activePlans = await this.tradingPlanRepository.getTradingPlansByUserId(userId);
    const activeUserPlans = activePlans.filter(plan => plan.status === 'ACTIVE');

    // Update budget for all active plans (this is a simplified approach)
    // In a real implementation, you might want to distribute the budget proportionally
    // or let the user decide how to allocate the new budget
    for (const plan of activeUserPlans) {
      if (plan.budget !== newBudget) {
        await this.updateTradingPlanBudget(plan.id, newBudget);
      }
    }
  }

  /**
   * Track execution of a trade
   */
  async trackTradeExecution(_userId: string, trade: ExecutedTrade): Promise<string> {
    // Validate trade data
    if (!trade.itemId || !trade.buyPrice || !trade.quantity) {
      throw new Error('Invalid trade data: itemId, buyPrice, and quantity are required');
    }

    if (trade.buyPrice <= 0 || trade.quantity <= 0) {
      throw new Error('Buy price and quantity must be greater than 0');
    }

    // Record the trade execution
    const tradeId = await this.tradingPlanRepository.recordTradeExecution(trade);

    return tradeId;
  }

  /**
   * Complete a trade (when item is sold)
   */
  async completeTradeExecution(
    tradeId: string,
    sellPrice: number,
    actualProfit: number
  ): Promise<boolean> {
    if (sellPrice <= 0) {
      throw new Error('Sell price must be greater than 0');
    }

    return await this.tradingPlanRepository.updateTradeCompletion(tradeId, sellPrice, actualProfit);
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
   * Get trading plan by ID
   */
  async getTradingPlan(planId: string): Promise<TradingPlan | null> {
    return await this.tradingPlanRepository.getTradingPlanById(planId);
  }

  /**
   * Get all trading plans for a user
   */
  async getUserTradingPlans(userId: string): Promise<TradingPlan[]> {
    return await this.tradingPlanRepository.getTradingPlansByUserId(userId);
  }

  /**
   * Update trading plan status
   */
  async updateTradingPlanStatus(
    planId: string,
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'
  ): Promise<boolean> {
    return await this.tradingPlanRepository.updateTradingPlanStatus(planId, status);
  }

  /**
   * Allocate budget for a trading suggestion
   */
  async allocateBudgetForSuggestion(
    planId: string,
    suggestionId: string,
    amount: number
  ): Promise<boolean> {
    if (amount <= 0) {
      throw new Error('Allocation amount must be greater than 0');
    }

    return await this.tradingPlanRepository.allocateBudget(planId, suggestionId, amount);
  }

  /**
   * Release allocated budget
   */
  async releaseBudgetAllocation(suggestionId: string): Promise<boolean> {
    return await this.tradingPlanRepository.releaseBudget(suggestionId);
  }

  /**
   * Get trading plan performance metrics
   */
  async getTradingPlanMetrics(planId: string): Promise<{
    totalTrades: number;
    successfulTrades: number;
    totalProfit: number;
    totalInvestment: number;
    successRate: number;
    averageProfit: number;
    roi: number;
  }> {
    return await this.tradingPlanRepository.getTradingPlanMetrics(planId);
  }

  /**
   * Validate trading plan parameters
   */
  private validateTradingPlanParams(params: TradingPlanParams & { name: string }): void {
    if (!params.name || params.name.trim().length === 0) {
      throw new Error('Trading plan name is required');
    }

    if (!params.budget || params.budget <= 0) {
      throw new Error('Budget must be greater than 0');
    }

    if (
      !params.riskTolerance ||
      !['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'].includes(params.riskTolerance)
    ) {
      throw new Error('Valid risk tolerance is required (CONSERVATIVE, MODERATE, or AGGRESSIVE)');
    }

    if (params.maxInvestmentPerTrade && params.maxInvestmentPerTrade <= 0) {
      throw new Error('Max investment per trade must be greater than 0 if specified');
    }

    if (params.maxInvestmentPerTrade && params.maxInvestmentPerTrade > params.budget) {
      throw new Error('Max investment per trade cannot exceed total budget');
    }
  }

  /**
   * Assess and adjust risk tolerance based on budget and preferences
   */
  private assessAndAdjustRiskTolerance(
    params: TradingPlanParams & { name: string }
  ): TradingPlanParams & { name: string } {
    const adjustedParams = { ...params };

    // Adjust max investment per trade based on risk tolerance if not specified
    if (!adjustedParams.maxInvestmentPerTrade) {
      switch (adjustedParams.riskTolerance) {
        case 'CONSERVATIVE':
          adjustedParams.maxInvestmentPerTrade = adjustedParams.budget * 0.15; // Max 15% per trade
          break;
        case 'MODERATE':
          adjustedParams.maxInvestmentPerTrade = adjustedParams.budget * 0.25; // Max 25% per trade
          break;
        case 'AGGRESSIVE':
          adjustedParams.maxInvestmentPerTrade = adjustedParams.budget * 0.4; // Max 40% per trade
          break;
      }
    }

    // Ensure max investment doesn't exceed risk tolerance limits
    const maxAllowedByRisk = this.getMaxInvestmentByRiskTolerance(
      adjustedParams.budget,
      adjustedParams.riskTolerance
    );

    if (adjustedParams.maxInvestmentPerTrade! > maxAllowedByRisk) {
      adjustedParams.maxInvestmentPerTrade = maxAllowedByRisk;
    }

    return adjustedParams;
  }

  /**
   * Get maximum investment per trade based on risk tolerance
   */
  private getMaxInvestmentByRiskTolerance(budget: number, riskTolerance: string): number {
    switch (riskTolerance) {
      case 'CONSERVATIVE':
        return budget * 0.2; // Conservative: max 20% per trade
      case 'MODERATE':
        return budget * 0.35; // Moderate: max 35% per trade
      case 'AGGRESSIVE':
        return budget * 0.5; // Aggressive: max 50% per trade
      default:
        return budget * 0.25; // Default to moderate
    }
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
