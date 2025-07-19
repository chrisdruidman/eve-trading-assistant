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
        parameters: TradingPlanParams & { name: string };
        marketData: MarketData[];
      };

      // Validate required parameters
      if (!userId || !parameters || !marketData) {
        return reply.status(400).send({
          error: 'Missing required parameters: userId, parameters, marketData',
        });
      }

      if (!parameters.name || parameters.name.trim().length === 0) {
        return reply.status(400).send({
          error: 'Trading plan name is required',
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
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error while creating trading plan',
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
   * Get trading plan by ID
   */
  async getTradingPlan(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { planId } = request.params as { planId: string };

      if (!planId) {
        return reply.status(400).send({
          error: 'Plan ID is required',
        });
      }

      const tradingPlan = await this.tradingService.getTradingPlan(planId);

      if (!tradingPlan) {
        return reply.status(404).send({
          error: 'Trading plan not found',
        });
      }

      const metrics = await this.tradingService.getTradingPlanMetrics(planId);

      return reply.send({
        success: true,
        data: {
          plan: tradingPlan,
          metrics,
        },
      });
    } catch (error) {
      console.error('Error getting trading plan:', error);
      return reply.status(500).send({
        error: 'Internal server error while retrieving trading plan',
      });
    }
  }

  /**
   * Get all trading plans for a user
   */
  async getUserTradingPlans(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { userId } = request.params as { userId: string };

      if (!userId) {
        return reply.status(400).send({
          error: 'User ID is required',
        });
      }

      const tradingPlans = await this.tradingService.getUserTradingPlans(userId);

      return reply.send({
        success: true,
        data: {
          plans: tradingPlans,
          count: tradingPlans.length,
        },
      });
    } catch (error) {
      console.error('Error getting user trading plans:', error);
      return reply.status(500).send({
        error: 'Internal server error while retrieving trading plans',
      });
    }
  }

  /**
   * Update trading plan status
   */
  async updateTradingPlanStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { planId } = request.params as { planId: string };
      const { status } = request.body as {
        status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
      };

      if (!planId) {
        return reply.status(400).send({
          error: 'Plan ID is required',
        });
      }

      if (!status || !['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'].includes(status)) {
        return reply.status(400).send({
          error: 'Valid status is required (ACTIVE, PAUSED, COMPLETED, or CANCELLED)',
        });
      }

      const updated = await this.tradingService.updateTradingPlanStatus(planId, status);

      if (!updated) {
        return reply.status(404).send({
          error: 'Trading plan not found',
        });
      }

      return reply.send({
        success: true,
        message: 'Trading plan status updated successfully',
      });
    } catch (error) {
      console.error('Error updating trading plan status:', error);
      return reply.status(500).send({
        error: 'Internal server error while updating trading plan status',
      });
    }
  }

  /**
   * Update trading plan budget
   */
  async updateTradingPlanBudget(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { planId } = request.params as { planId: string };
      const { budget } = request.body as { budget: number };

      if (!planId) {
        return reply.status(400).send({
          error: 'Plan ID is required',
        });
      }

      if (!budget || budget <= 0) {
        return reply.status(400).send({
          error: 'Budget must be greater than 0',
        });
      }

      const updated = await this.tradingService.updateTradingPlanBudget(planId, budget);

      if (!updated) {
        return reply.status(400).send({
          error:
            'Cannot update budget - plan not found or new budget is less than allocated amount',
        });
      }

      return reply.send({
        success: true,
        message: 'Trading plan budget updated successfully',
      });
    } catch (error) {
      console.error('Error updating trading plan budget:', error);
      return reply.status(500).send({
        error:
          error instanceof Error ? error.message : 'Internal server error while updating budget',
      });
    }
  }

  /**
   * Allocate budget for a suggestion
   */
  async allocateBudget(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { planId, suggestionId } = request.params as { planId: string; suggestionId: string };
      const { amount } = request.body as { amount: number };

      if (!planId || !suggestionId) {
        return reply.status(400).send({
          error: 'Plan ID and Suggestion ID are required',
        });
      }

      if (!amount || amount <= 0) {
        return reply.status(400).send({
          error: 'Allocation amount must be greater than 0',
        });
      }

      const allocated = await this.tradingService.allocateBudgetForSuggestion(
        planId,
        suggestionId,
        amount
      );

      if (!allocated) {
        return reply.status(400).send({
          error: 'Cannot allocate budget - insufficient funds or invalid suggestion',
        });
      }

      return reply.send({
        success: true,
        message: 'Budget allocated successfully',
      });
    } catch (error) {
      console.error('Error allocating budget:', error);
      return reply.status(500).send({
        error:
          error instanceof Error ? error.message : 'Internal server error while allocating budget',
      });
    }
  }

  /**
   * Release budget allocation
   */
  async releaseBudget(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { suggestionId } = request.params as { suggestionId: string };

      if (!suggestionId) {
        return reply.status(400).send({
          error: 'Suggestion ID is required',
        });
      }

      const released = await this.tradingService.releaseBudgetAllocation(suggestionId);

      if (!released) {
        return reply.status(404).send({
          error: 'Budget allocation not found or already released',
        });
      }

      return reply.send({
        success: true,
        message: 'Budget allocation released successfully',
      });
    } catch (error) {
      console.error('Error releasing budget allocation:', error);
      return reply.status(500).send({
        error: 'Internal server error while releasing budget allocation',
      });
    }
  }

  /**
   * Complete trade execution
   */
  async completeTradeExecution(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { tradeId } = request.params as { tradeId: string };
      const { sellPrice, actualProfit } = request.body as {
        sellPrice: number;
        actualProfit: number;
      };

      if (!tradeId) {
        return reply.status(400).send({
          error: 'Trade ID is required',
        });
      }

      if (!sellPrice || sellPrice <= 0) {
        return reply.status(400).send({
          error: 'Sell price must be greater than 0',
        });
      }

      if (actualProfit === undefined || actualProfit === null) {
        return reply.status(400).send({
          error: 'Actual profit is required',
        });
      }

      const completed = await this.tradingService.completeTradeExecution(
        tradeId,
        sellPrice,
        actualProfit
      );

      if (!completed) {
        return reply.status(404).send({
          error: 'Trade not found or already completed',
        });
      }

      return reply.send({
        success: true,
        message: 'Trade execution completed successfully',
      });
    } catch (error) {
      console.error('Error completing trade execution:', error);
      return reply.status(500).send({
        error:
          error instanceof Error ? error.message : 'Internal server error while completing trade',
      });
    }
  }

  /**
   * Get trading plan metrics
   */
  async getTradingPlanMetrics(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { planId } = request.params as { planId: string };

      if (!planId) {
        return reply.status(400).send({
          error: 'Plan ID is required',
        });
      }

      const metrics = await this.tradingService.getTradingPlanMetrics(planId);

      return reply.send({
        success: true,
        data: metrics,
      });
    } catch (error) {
      console.error('Error getting trading plan metrics:', error);
      return reply.status(500).send({
        error: 'Internal server error while retrieving metrics',
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
