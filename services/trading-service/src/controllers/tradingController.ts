import { FastifyRequest, FastifyReply } from 'fastify';
import { TradingService } from '../services/tradingService';
import { TradingPlanParams, MarketData, UserProfile, ExecutedTrade } from '@shared/types';

export class TradingController {
  private tradingService: TradingService;

  constructor() {
    this.tradingService = new TradingService();
  }

  /**
   * Generate trading suggestions
   */
  async generateSuggestions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId, budget, marketData, userProfile } = request.body as {
        userId: string;
        budget: number;
        marketData: MarketData[];
        userProfile?: UserProfile;
      };

      // Validate required parameters
      if (!userId || !budget || !marketData) {
        return reply.status(400).send({
          error: 'Missing required parameters: userId, budget, marketData',
        });
      }

      if (budget <= 0) {
        return reply.status(400).send({
          error: 'Budget must be greater than 0',
        });
      }

      if (!Array.isArray(marketData) || marketData.length === 0) {
        return reply.status(400).send({
          error: 'Market data must be a non-empty array',
        });
      }

      const suggestions = await this.tradingService.generateTradingSuggestions(
        userId,
        budget,
        marketData,
        userProfile
      );

      return reply.send({
        success: true,
        data: {
          suggestions,
          count: suggestions.length,
          totalPotentialProfit: suggestions.reduce((sum, s) => sum + s.expectedProfit, 0),
          totalRequiredInvestment: suggestions.reduce((sum, s) => sum + s.requiredInvestment, 0),
        },
      });
    } catch (error) {
      console.error('Error generating trading suggestions:', error);
      return reply.status(500).send({
        error: 'Internal server error while generating suggestions',
      });
    }
  }

  /**
   * Create a trading plan
   */
  async createTradingPlan(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId, parameters, marketData } = request.body as {
        userId: string;
        parameters: TradingPlanParams;
        marketData: MarketData[];
      };

      // Validate required parameters
      if (!userId || !parameters || !marketData) {
        return reply.status(400).send({
          error: 'Missing required parameters: userId, parameters, marketData',
        });
      }

      if (!parameters.budget || parameters.budget <= 0) {
        return reply.status(400).send({
          error: 'Budget must be greater than 0',
        });
      }

      if (!Array.isArray(marketData) || marketData.length === 0) {
        return reply.status(400).send({
          error: 'Market data must be a non-empty array',
        });
      }

      const tradingPlan = await this.tradingService.createTradingPlan(
        userId,
        parameters,
        marketData
      );

      // Calculate portfolio metrics
      const portfolioMetrics = this.tradingService.calculatePortfolioMetrics(tradingPlan);

      return reply.send({
        success: true,
        data: {
          plan: tradingPlan,
          metrics: portfolioMetrics,
        },
      });
    } catch (error) {
      console.error('Error creating trading plan:', error);
      return reply.status(500).send({
        error: 'Internal server error while creating trading plan',
      });
    }
  }

  /**
   * Update user budget
   */
  async updateBudget(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = request.params as { userId: string };
      const { budget } = request.body as { budget: number };

      if (!userId) {
        return reply.status(400).send({
          error: 'User ID is required',
        });
      }

      if (!budget || budget <= 0) {
        return reply.status(400).send({
          error: 'Budget must be greater than 0',
        });
      }

      await this.tradingService.updateBudget(userId, budget);

      return reply.send({
        success: true,
        message: 'Budget updated successfully',
      });
    } catch (error) {
      console.error('Error updating budget:', error);
      return reply.status(500).send({
        error: 'Internal server error while updating budget',
      });
    }
  }

  /**
   * Track trade execution
   */
  async trackTradeExecution(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = request.params as { userId: string };
      const trade = request.body as ExecutedTrade;

      if (!userId) {
        return reply.status(400).send({
          error: 'User ID is required',
        });
      }

      if (!trade || !trade.itemId || !trade.buyPrice || !trade.quantity) {
        return reply.status(400).send({
          error: 'Invalid trade data: itemId, buyPrice, and quantity are required',
        });
      }

      await this.tradingService.trackTradeExecution(userId, trade);

      return reply.send({
        success: true,
        message: 'Trade execution tracked successfully',
      });
    } catch (error) {
      console.error('Error tracking trade execution:', error);
      return reply.status(500).send({
        error: 'Internal server error while tracking trade execution',
      });
    }
  }

  /**
   * Get detailed analysis for a suggestion
   */
  async getDetailedAnalysis(request: FastifyRequest, reply: FastifyReply) {
    try {
      const suggestion = request.body as any; // TradingSuggestion from request body

      if (!suggestion || !suggestion.itemId) {
        return reply.status(400).send({
          error: 'Valid trading suggestion is required',
        });
      }

      const analysis = await this.tradingService.getDetailedAnalysis(suggestion);

      return reply.send({
        success: true,
        data: analysis,
      });
    } catch (error) {
      console.error('Error getting detailed analysis:', error);
      return reply.status(500).send({
        error: 'Internal server error while analyzing suggestion',
      });
    }
  }

  /**
   * Calculate portfolio metrics for a trading plan
   */
  async calculatePortfolioMetrics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const tradingPlan = request.body as any; // TradingPlan from request body

      if (!tradingPlan || !tradingPlan.suggestions) {
        return reply.status(400).send({
          error: 'Valid trading plan is required',
        });
      }

      const metrics = this.tradingService.calculatePortfolioMetrics(tradingPlan);

      return reply.send({
        success: true,
        data: metrics,
      });
    } catch (error) {
      console.error('Error calculating portfolio metrics:', error);
      return reply.status(500).send({
        error: 'Internal server error while calculating metrics',
      });
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(_request: FastifyRequest, reply: FastifyReply) {
    return reply.send({
      status: 'healthy',
      service: 'trading-service',
      timestamp: new Date().toISOString(),
    });
  }
}
