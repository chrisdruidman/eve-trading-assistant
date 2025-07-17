import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Detailed health check
  fastify.get('/detailed', async (request, reply) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'market-service',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      checks: {
        database: false,
        redis: false,
      },
    };

    // Check database connection
    try {
      await fastify.db.query('SELECT 1');
      health.checks.database = true;
    } catch (error) {
      health.checks.database = false;
      health.status = 'unhealthy';
      fastify.log.error({ error }, 'Database health check failed');
    }

    // Check Redis connection
    try {
      await fastify.redis.client.ping();
      health.checks.redis = true;
    } catch (error) {
      health.checks.redis = false;
      health.status = 'unhealthy';
      fastify.log.error({ error }, 'Redis health check failed');
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    return reply.status(statusCode).send(health);
  });

  // Readiness check (for Kubernetes)
  fastify.get('/ready', async (request, reply) => {
    try {
      // Check if we can connect to essential services
      await fastify.db.query('SELECT 1');
      await fastify.redis.client.ping();

      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      fastify.log.error({ error }, 'Readiness check failed');
      return reply.status(503).send({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: 'Essential services unavailable',
      });
    }
  });

  // Liveness check (for Kubernetes)
  fastify.get('/live', async (request, reply) => {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
};
