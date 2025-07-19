import { TradingSuggestion, MarketData, MarketOrder, AnalysisContext } from '@shared/types';

export interface TradingOpportunityAnalysis {
  itemId: number;
  itemName: string;
  buyRegion: number;
  sellRegion: number;
  buyPrice: number;
  sellPrice: number;
  volume: number;
  profitPerUnit: number;
  profitMargin: number;
  roi: number;
  riskScore: number;
  liquidityScore: number;
  competitionScore: number;
}

export interface RiskFactors {
  priceVolatility: number;
  volumeStability: number;
  competitionLevel: number;
  marketDepth: number;
  historicalReliability: number;
}

export class TradingSuggestionEngine {
  private readonly MIN_PROFIT_MARGIN = 0.05; // 5% minimum profit margin
  private readonly MIN_ROI = 0.1; // 10% minimum ROI
  private readonly MAX_INVESTMENT_RATIO = 0.3; // Max 30% of budget per trade

  /**
   * Generate trading suggestions based on market data and user parameters
   */
  async generateSuggestions(
    marketData: MarketData[],
    context: AnalysisContext,
    maxSuggestions: number = 10
  ): Promise<TradingSuggestion[]> {
    // Analyze all trading opportunities
    const opportunities = await this.analyzeMarketOpportunities(marketData, context);

    // Filter by budget constraints
    const budgetFiltered = this.filterByBudget(opportunities, context.budget);

    // Calculate risk levels
    const withRiskAssessment = budgetFiltered.map(opp => ({
      ...opp,
      riskLevel: this.calculateRiskLevel(opp, context.riskTolerance),
    }));

    // Filter by risk tolerance
    const riskFiltered = this.filterByRiskTolerance(withRiskAssessment, context.riskTolerance);

    // Sort by profitability and risk-adjusted returns
    const sorted = this.sortByProfitability(riskFiltered, context.riskTolerance);

    // Convert to TradingSuggestion format
    const suggestions = sorted
      .slice(0, maxSuggestions)
      .map(opp => this.convertToTradingSuggestion(opp));

    return suggestions;
  }

  /**
   * Analyze market data to identify trading opportunities
   */
  private async analyzeMarketOpportunities(
    marketData: MarketData[],
    _context: AnalysisContext
  ): Promise<TradingOpportunityAnalysis[]> {
    const opportunities: TradingOpportunityAnalysis[] = [];

    for (const market of marketData) {
      // Skip if no orders available
      if (market.buyOrders.length === 0 || market.sellOrders.length === 0) {
        continue;
      }

      // Find best buy and sell opportunities
      const bestBuyOrder = this.findBestBuyOrder(market.sellOrders);
      const bestSellOrder = this.findBestSellOrder(market.buyOrders);

      if (!bestBuyOrder || !bestSellOrder) {
        continue;
      }

      // Calculate basic metrics
      const profitPerUnit = bestSellOrder.price - bestBuyOrder.price;
      const profitMargin = profitPerUnit / bestBuyOrder.price;
      const roi = profitPerUnit / bestBuyOrder.price;

      // Skip if not profitable enough
      if (profitMargin < this.MIN_PROFIT_MARGIN || roi < this.MIN_ROI) {
        continue;
      }

      // Calculate available volume (limited by both orders)
      const availableVolume = Math.min(bestBuyOrder.volume, bestSellOrder.volume);

      // Calculate risk factors
      const riskFactors = this.calculateRiskFactors(market);
      const riskScore = this.aggregateRiskScore(riskFactors);

      // Calculate liquidity and competition scores
      const liquidityScore = this.calculateLiquidityScore(market);
      const competitionScore = this.calculateCompetitionScore(market);

      opportunities.push({
        itemId: market.typeId,
        itemName: `Item_${market.typeId}`, // TODO: Get actual item names from database
        buyRegion: market.regionId,
        sellRegion: market.regionId, // For now, same region trading
        buyPrice: bestBuyOrder.price,
        sellPrice: bestSellOrder.price,
        volume: availableVolume,
        profitPerUnit,
        profitMargin,
        roi,
        riskScore,
        liquidityScore,
        competitionScore,
      });
    }

    return opportunities;
  }

  /**
   * Find the best buy order (lowest sell price)
   */
  private findBestBuyOrder(sellOrders: MarketOrder[]): MarketOrder | null {
    if (sellOrders.length === 0) return null;

    return sellOrders.reduce((best, current) => (current.price < best.price ? current : best));
  }

  /**
   * Find the best sell order (highest buy price)
   */
  private findBestSellOrder(buyOrders: MarketOrder[]): MarketOrder | null {
    if (buyOrders.length === 0) return null;

    return buyOrders.reduce((best, current) => (current.price > best.price ? current : best));
  }

  /**
   * Calculate risk factors for a market
   */
  private calculateRiskFactors(market: MarketData): RiskFactors {
    const buyOrders = market.buyOrders;
    const sellOrders = market.sellOrders;

    // Price volatility based on spread
    const bestBuy = Math.max(...buyOrders.map(o => o.price));
    const bestSell = Math.min(...sellOrders.map(o => o.price));
    const spread = Math.abs(bestSell - bestBuy) / Math.max(bestBuy, bestSell);
    const priceVolatility = Math.min(spread * 2, 1); // Normalize to 0-1

    // Volume stability based on order depth
    const totalBuyVolume = buyOrders.reduce((sum, o) => sum + o.volume, 0);
    const totalSellVolume = sellOrders.reduce((sum, o) => sum + o.volume, 0);
    const volumeImbalance =
      Math.abs(totalBuyVolume - totalSellVolume) / Math.max(totalBuyVolume, totalSellVolume);
    const volumeStability = 1 - volumeImbalance;

    // Competition level based on number of orders
    const totalOrders = buyOrders.length + sellOrders.length;
    const competitionLevel = Math.min(totalOrders / 50, 1); // Normalize to 0-1

    // Market depth based on volume at best prices
    const bestBuyVolume = buyOrders.find(o => o.price === bestBuy)?.volume || 0;
    const bestSellVolume = sellOrders.find(o => o.price === bestSell)?.volume || 0;
    const marketDepth = Math.min((bestBuyVolume + bestSellVolume) / 10000, 1);

    // Historical reliability (placeholder - would need historical data)
    const historicalReliability = 0.7; // Default moderate reliability

    return {
      priceVolatility,
      volumeStability,
      competitionLevel,
      marketDepth,
      historicalReliability,
    };
  }

  /**
   * Aggregate risk factors into a single risk score
   */
  private aggregateRiskScore(factors: RiskFactors): number {
    const weights = {
      priceVolatility: 0.3,
      volumeStability: 0.2,
      competitionLevel: 0.2,
      marketDepth: 0.2,
      historicalReliability: 0.1,
    };

    return (
      factors.priceVolatility * weights.priceVolatility +
      (1 - factors.volumeStability) * weights.volumeStability +
      factors.competitionLevel * weights.competitionLevel +
      (1 - factors.marketDepth) * weights.marketDepth +
      (1 - factors.historicalReliability) * weights.historicalReliability
    );
  }

  /**
   * Calculate liquidity score based on volume and order depth
   */
  private calculateLiquidityScore(market: MarketData): number {
    const totalVolume = market.volume;
    const orderCount = market.buyOrders.length + market.sellOrders.length;

    // Higher volume and more orders = better liquidity
    const volumeScore = Math.min(totalVolume / 100000, 1); // Normalize
    const orderScore = Math.min(orderCount / 20, 1); // Normalize

    return volumeScore * 0.7 + orderScore * 0.3;
  }

  /**
   * Calculate competition score based on order distribution
   */
  private calculateCompetitionScore(market: MarketData): number {
    const buyOrders = market.buyOrders;
    const sellOrders = market.sellOrders;

    if (buyOrders.length === 0 || sellOrders.length === 0) return 1; // High competition

    // Calculate price clustering
    const buyPrices = buyOrders.map(o => o.price).sort((a, b) => b - a);
    const sellPrices = sellOrders.map(o => o.price).sort((a, b) => a - b);

    // More price levels = less competition
    const uniqueBuyPrices = new Set(buyPrices).size;
    const uniqueSellPrices = new Set(sellPrices).size;

    const competitionScore = Math.min(
      (uniqueBuyPrices + uniqueSellPrices) / (buyOrders.length + sellOrders.length),
      1
    );

    return 1 - competitionScore; // Invert so higher score = more competition
  }
  /**
   * Filter opportunities by budget constraints
   */
  private filterByBudget(
    opportunities: TradingOpportunityAnalysis[],
    budget: number
  ): TradingOpportunityAnalysis[] {
    const maxInvestmentPerTrade = budget * this.MAX_INVESTMENT_RATIO;

    return opportunities
      .map(opp => {
        // Adjust volume to fit budget constraints
        const maxAffordableVolume = Math.floor(maxInvestmentPerTrade / opp.buyPrice);
        const adjustedVolume = Math.min(opp.volume, maxAffordableVolume);

        return {
          ...opp,
          volume: adjustedVolume,
        };
      })
      .filter(opp => {
        // Filter out opportunities with zero volume after adjustment
        const hasVolume = opp.volume > 0;
        return hasVolume;
      });
  }

  /**
   * Calculate risk level based on risk score and user tolerance
   */
  private calculateRiskLevel(
    opportunity: TradingOpportunityAnalysis,
    riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    const riskScore = opportunity.riskScore;

    // Adjust thresholds based on user risk tolerance
    let lowThreshold: number;
    let highThreshold: number;

    switch (riskTolerance) {
      case 'CONSERVATIVE':
        lowThreshold = 0.2;
        highThreshold = 0.4;
        break;
      case 'MODERATE':
        lowThreshold = 0.3;
        highThreshold = 0.6;
        break;
      case 'AGGRESSIVE':
        lowThreshold = 0.4;
        highThreshold = 0.7;
        break;
    }

    if (riskScore <= lowThreshold) return 'LOW';
    if (riskScore <= highThreshold) return 'MEDIUM';
    return 'HIGH';
  }

  /**
   * Filter opportunities by risk tolerance
   */
  private filterByRiskTolerance(
    opportunities: (TradingOpportunityAnalysis & { riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' })[],
    riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
  ): (TradingOpportunityAnalysis & { riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' })[] {
    switch (riskTolerance) {
      case 'CONSERVATIVE':
        return opportunities.filter(opp => opp.riskLevel === 'LOW');
      case 'MODERATE':
        return opportunities.filter(opp => opp.riskLevel !== 'HIGH');
      case 'AGGRESSIVE':
        return opportunities; // Accept all risk levels
      default:
        return opportunities.filter(opp => opp.riskLevel !== 'HIGH');
    }
  }

  /**
   * Sort opportunities by profitability and risk-adjusted returns
   */
  private sortByProfitability(
    opportunities: (TradingOpportunityAnalysis & { riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' })[],
    riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
  ): (TradingOpportunityAnalysis & { riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' })[] {
    return opportunities.sort((a, b) => {
      // Calculate risk-adjusted score
      const aScore = this.calculateRiskAdjustedScore(a, riskTolerance);
      const bScore = this.calculateRiskAdjustedScore(b, riskTolerance);

      return bScore - aScore; // Descending order
    });
  }

  /**
   * Calculate risk-adjusted profitability score
   */
  private calculateRiskAdjustedScore(
    opportunity: TradingOpportunityAnalysis & { riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' },
    riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
  ): number {
    const baseScore = opportunity.roi * opportunity.volume * opportunity.buyPrice;

    // Risk adjustment factors
    const riskAdjustment = this.getRiskAdjustmentFactor(opportunity.riskLevel, riskTolerance);
    const liquidityBonus = opportunity.liquidityScore * 0.1;
    const competitionPenalty = opportunity.competitionScore * 0.05;

    return baseScore * riskAdjustment + liquidityBonus - competitionPenalty;
  }

  /**
   * Get risk adjustment factor based on risk level and tolerance
   */
  private getRiskAdjustmentFactor(
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH',
    riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
  ): number {
    const adjustmentMatrix = {
      CONSERVATIVE: { LOW: 1.0, MEDIUM: 0.7, HIGH: 0.3 },
      MODERATE: { LOW: 0.9, MEDIUM: 1.0, HIGH: 0.8 },
      AGGRESSIVE: { LOW: 0.8, MEDIUM: 0.9, HIGH: 1.0 },
    };

    return adjustmentMatrix[riskTolerance][riskLevel];
  }

  /**
   * Convert analysis to TradingSuggestion format
   */
  private convertToTradingSuggestion(
    opportunity: TradingOpportunityAnalysis & { riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' }
  ): TradingSuggestion {
    const requiredInvestment = opportunity.buyPrice * opportunity.volume;
    const expectedProfit = opportunity.profitPerUnit * opportunity.volume;

    // Estimate time to profit based on volume and liquidity
    const timeToProfit = this.estimateTimeToProfit(opportunity);

    // Calculate confidence based on risk factors
    const confidence = this.calculateConfidence(opportunity);

    return {
      itemId: opportunity.itemId,
      itemName: opportunity.itemName,
      buyPrice: opportunity.buyPrice,
      sellPrice: opportunity.sellPrice,
      expectedProfit,
      profitMargin: opportunity.profitMargin,
      riskLevel: opportunity.riskLevel,
      requiredInvestment,
      timeToProfit,
      confidence,
    };
  }

  /**
   * Estimate time to profit based on market conditions
   */
  private estimateTimeToProfit(opportunity: TradingOpportunityAnalysis): number {
    // Base time in hours
    const baseTime = 24; // 1 day default

    // Adjust based on liquidity (higher liquidity = faster execution)
    const liquidityFactor = 1 - opportunity.liquidityScore * 0.5;

    // Adjust based on competition (more competition = slower execution)
    const competitionFactor = 1 + opportunity.competitionScore * 0.3;

    // Adjust based on volume (larger volumes take longer)
    const volumeFactor = Math.min(opportunity.volume / 1000, 2);

    return Math.round(baseTime * liquidityFactor * competitionFactor * volumeFactor);
  }

  /**
   * Calculate confidence score for the suggestion
   */
  private calculateConfidence(opportunity: TradingOpportunityAnalysis): number {
    // Base confidence from inverse risk score
    const riskConfidence = 1 - opportunity.riskScore;

    // Liquidity confidence
    const liquidityConfidence = opportunity.liquidityScore;

    // Market depth confidence (less competition = higher confidence)
    const competitionConfidence = 1 - opportunity.competitionScore;

    // Profit margin confidence (higher margins = higher confidence)
    const profitConfidence = Math.min(opportunity.profitMargin * 2, 1);

    // Weighted average
    const confidence =
      riskConfidence * 0.3 +
      liquidityConfidence * 0.25 +
      competitionConfidence * 0.25 +
      profitConfidence * 0.2;

    return Math.round(confidence * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate detailed profit metrics for a suggestion
   */
  public calculateProfitMetrics(suggestion: TradingSuggestion): {
    absoluteProfit: number;
    profitMargin: number;
    roi: number;
    profitPerHour: number;
    breakEvenVolume: number;
  } {
    const absoluteProfit = suggestion.expectedProfit;
    const profitMargin = suggestion.profitMargin;
    const roi = absoluteProfit / suggestion.requiredInvestment;
    const profitPerHour = absoluteProfit / suggestion.timeToProfit;

    // Calculate break-even volume (minimum volume needed to cover transaction costs)
    // Assuming 1% transaction cost
    const transactionCostRate = 0.01;
    const transactionCost = suggestion.requiredInvestment * transactionCostRate;
    const profitPerUnit = suggestion.sellPrice - suggestion.buyPrice;
    const breakEvenVolume = Math.ceil(transactionCost / profitPerUnit);

    return {
      absoluteProfit,
      profitMargin,
      roi,
      profitPerHour,
      breakEvenVolume,
    };
  }

  /**
   * Validate suggestion meets minimum requirements
   */
  public validateSuggestion(suggestion: TradingSuggestion): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (suggestion.profitMargin < this.MIN_PROFIT_MARGIN) {
      issues.push(
        `Profit margin ${(suggestion.profitMargin * 100).toFixed(1)}% below minimum ${this.MIN_PROFIT_MARGIN * 100}%`
      );
    }

    if (suggestion.expectedProfit <= 0) {
      issues.push('Expected profit must be positive');
    }

    if (suggestion.confidence < 0.3) {
      issues.push('Confidence level too low for reliable trading');
    }

    if (suggestion.requiredInvestment <= 0) {
      issues.push('Required investment must be positive');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}
