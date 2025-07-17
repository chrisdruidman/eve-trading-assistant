import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { Pool, PoolClient } from 'pg';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    db: {
      pool: Pool;
      query: (text: string, params?: any[]) => Promise<any>;
      getClient: () => Promise<PoolClient>;
    };
  }
}

const setupDatabase: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/eve_trading_dev',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test connection
  try {
    const client = await pool.connect();
    fastify.log.info('Database connected successfully');
    client.release();
  } catch (err) {
    fastify.log.error('Failed to connect to database:', err);
    throw err;
  }

  // Add database methods to fastify instance
  fastify.decorate('db', {
    pool,
    query: async (text: string, params?: any[]) => {
      const start = Date.now();
      try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        fastify.log.debug({ query: text, duration }, 'Database query executed');
        return result;
      } catch (err) {
        fastify.log.error({ query: text, error: err }, 'Database query failed');
        throw err;
      }
    },
    getClient: () => pool.connect(),
  });

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    fastify.log.info('Closing database connection pool');
    await pool.end();
  });
};

export { setupDatabase };
export default fp(setupDatabase);
