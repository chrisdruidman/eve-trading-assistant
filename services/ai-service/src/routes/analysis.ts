import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AIService } from '../services/aiService';
import {
  MarketData,
  AnalysisContext,
  UserProfile,
  MarketConditions,
  TradingSuggestion,
} from '../../../../shared/src/types';

/**
 * AI Analysis Routes
 * Handles market analysis and trading advice endpoints
 */
export async function analysisRoutes(fastify: FastifyInstance) {
  const aiService = new AIService();
  await aiService.initialize();

  // Market data analysis endpoint
  fastify.post<{
    Body: {
      marketData: MarketData[];
      context: AnalysisContext;
    };
  }>('/analyze/market', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { marketData, context } = request.body as any;

      if (!marketData || !Array.isArray(marketData) || marketData.length === 0) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Market data array is required and cannot be empty',
        });
      }

      if (!context || !context.userId || !context.budget) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Analysis context with userId and budget is required',
        });
      }

      const analysis = await aiService.analyzeMarketData(marketData, context);

      return reply.send({
        success: true,
        data: analysis,
        meta: {
          processedItems: marketData.length,
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      console.error('Market analysis error:', error);

      return reply.status(500).send({
        error: 'ANALYSIS_FAILED',
        message: 'Failed to analyze market data',
        details: error.message,
      });
    }
  });

  // Trading advice endpoint
  fastify.post<{
    Body: {
      userProfile: UserProfile;
      marketConditions: MarketConditions;
    };
  }>('/analyze/trading-advice', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { userProfile, marketConditions } = request.body as any;

      if (!userProfile || !userProfile.userId) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'User profile with userId is required',
        });
      }

      if (!marketConditions) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Market conditions are required',
        });
      }

      const advice = await aiService.generateTradingAdvice(userProfile, marketConditions);

      return reply.send({
        success: true,
        data: advice,
        meta: {
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      console.error('Trading advice error:', error);

      return reply.status(500).send({
        error: 'ADVICE_FAILED',
        message: 'Failed to generate trading advice',
        details: error.message,
      });
    }
  });

  // Strategy explanation endpoint
  fastify.post<{
    Body: {
      suggestion: TradingSuggestion;
    };
  }>('/analyze/explain-strategy', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { suggestion } = request.body as any;

      if (!suggestion || !suggestion.itemId) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Trading suggestion is required',
        });
      }

      const explanation = await aiService.explainTradingStrategy(suggestion);

      return reply.send({
        success: true,
        data: {
          explanation,
          suggestion,
        },
        meta: {
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      console.error('Strategy explanation error:', error);

      return reply.status(500).send({
        error: 'EXPLANATION_FAILED',
        message: 'Failed to explain trading strategy',
        details: error.message,
      });
    }
  });

  // Service health endpoint
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = await aiService.getServiceHealth();

      return reply.send({
        success: true,
        data: health,
        meta: {
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      console.error('Health check error:', error);

      return reply.status(500).send({
        error: 'HEALTH_CHECK_FAILED',
        message: 'Failed to get service health',
        details: error.message,
      });
    }
  });

  // Trading opportunities identification endpoint
  fastify.post<{
    Body: {
      marketData: MarketData[];
      context: AnalysisContext;
    };
  }>('/analyze/opportunities', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { marketData, context } = request.body as any;

      if (!marketData || !Array.isArray(marketData) || marketData.length === 0) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Market data array is required and cannot be empty',
        });
      }

      if (!context || !context.userId || !context.budget) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Analysis context with userId and budget is required',
        });
      }

      const opportunities = await aiService.identifyTradingOpportunities(marketData, context);

      return reply.send({
        success: true,
        data: opportunities,
        meta: {
          processedItems: marketData.length,
          opportunitiesFound: opportunities.length,
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      console.error('Trading opportunities error:', error);

      return reply.status(500).send({
        error: 'OPPORTUNITIES_FAILED',
        message: 'Failed to identify trading opportunities',
        details: error.message,
      });
    }
  });

  // Profit and risk assessment endpoint
  fastify.post<{
    Body: {
      suggestions: TradingSuggestion[];
      marketData: MarketData[];
      context: AnalysisContext;
    };
  }>('/analyze/profit-risk', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { suggestions, marketData, context } = request.body as any;

      if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Trading suggestions array is required and cannot be empty',
        });
      }

      if (!marketData || !Array.isArray(marketData)) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Market data array is required',
        });
      }

      if (!context || !context.userId) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Analysis context with userId is required',
        });
      }

      const assessment = await aiService.assessProfitAndRisk(suggestions, marketData, context);

      return reply.send({
        success: true,
        data: assessment,
        meta: {
          analyzedSuggestions: suggestions.length,
          identifiedRisks: assessment.risks.length,
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      console.error('Profit risk assessment error:', error);

      return reply.status(500).send({
        error: 'ASSESSMENT_FAILED',
        message: 'Failed to assess profit and risk',
        details: error.message,
      });
    }
  });

  // Market trend prediction endpoint
  fastify.post<{
    Body: {
      marketData: MarketData[];
      historicalData?: any[];
      context: AnalysisContext;
    };
  }>('/analyze/trends', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { marketData, historicalData = [], context } = request.body as any;

      if (!marketData || !Array.isArray(marketData) || marketData.length === 0) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Market data array is required and cannot be empty',
        });
      }

      if (!context || !context.userId) {
        return reply.status(400).send({
          error: 'INVALID_REQUEST',
          message: 'Analysis context with userId is required',
        });
      }

      const trends = await aiService.predictMarketTrends(marketData, historicalData, context);

      return reply.send({
        success: true,
        data: trends,
        meta: {
          analyzedItems: marketData.length,
          historicalDataPoints: historicalData.length,
          predictedTrends: trends.length,
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      console.error('Market trend prediction error:', error);

      return reply.status(500).send({
        error: 'TREND_PREDICTION_FAILED',
        message: 'Failed to predict market trends',
        details: error.message,
      });
    }
  });

  // Enhanced service health endpoint with detailed performance metrics
  fastify.get('/health/detailed', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const enhancedHealth = await aiService.getEnhancedServiceHealth();

      return reply.send({
        success: true,
        data: enhancedHealth,
        meta: {
          timestamp: new Date(),
          description:
            'Enhanced health check with provider performance metrics and failover status',
        },
      });
    } catch (error: any) {
      console.error('Enhanced health check error:', error);

      return reply.status(500).send({
        error: 'ENHANCED_HEALTH_CHECK_FAILED',
        message: 'Failed to get enhanced service health',
        details: error.message,
      });
    }
  });
}
