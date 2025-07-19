import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { tradingRoutes } from './routes/tradingRoutes';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// Register plugins
async function registerPlugins() {
  // Security
  await fastify.register(helmet);

  // CORS
  await fastify.register(cors, {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Routes
  await fastify.register(tradingRoutes, { prefix: '/api/v1/trading' });
}

// Start server
async function start() {
  try {
    await registerPlugins();

    const port = parseInt(process.env.PORT || '3003', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });

    console.log(`Trading Service running on http://${host}:${port}`);
    console.log('Available endpoints:');
    console.log('  POST /api/v1/trading/suggestions - Generate trading suggestions');
    console.log('  POST /api/v1/trading/plans - Create trading plan');
    console.log('  PUT /api/v1/trading/users/:userId/budget - Update user budget');
    console.log('  POST /api/v1/trading/users/:userId/trades - Track trade execution');
    console.log('  POST /api/v1/trading/analysis - Get detailed analysis');
    console.log('  POST /api/v1/trading/portfolio/metrics - Calculate portfolio metrics');
    console.log('  GET /api/v1/trading/health - Health check');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await fastify.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await fastify.close();
  process.exit(0);
});

// Start the server
start();

export default fastify;
