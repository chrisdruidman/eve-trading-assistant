import { FastifyInstance } from 'fastify';
import { analysisRoutes } from './analysis';

/**
 * Register all AI service routes
 */
export async function registerRoutes(fastify: FastifyInstance) {
  // Register analysis routes under /api/v1 prefix
  await fastify.register(analysisRoutes, { prefix: '/api/v1' });

  // Root health check
  fastify.get('/health', async (request, reply) => {
    return reply.send({
      service: 'ai-service',
      status: 'healthy',
      timestamp: new Date(),
      version: '1.0.0',
    });
  });

  // Service info endpoint
  fastify.get('/info', async (request, reply) => {
    return reply.send({
      service: 'EVE Trading Assistant - AI Service',
      description: 'AI provider orchestration service for trading analysis',
      version: '1.0.0',
      endpoints: [
        'POST /api/v1/analyze/market - Analyze market data',
        'POST /api/v1/analyze/trading-advice - Generate trading advice',
        'POST /api/v1/analyze/explain-strategy - Explain trading strategy',
        'GET /api/v1/health - Service health check',
        'GET /health - Basic health check',
        'GET /info - Service information',
      ],
      timestamp: new Date(),
    });
  });
}
