import Fastify, { FastifyInstance } from 'fastify';
import { setupRoutes } from '../../src/routes';

// Mock Redis for testing
const mockRedis = {
  client: {
    keys: jest.fn().mockResolvedValue([]),
    del: jest.fn().mockResolvedValue(1),
    info: jest.fn().mockResolvedValue('used_memory_human:1M\n'),
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
  } as any,
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(false),
  setWithStrategy: jest.fn().mockResolvedValue(undefined),
  getWithFreshness: jest.fn().mockResolvedValue({ value: null, isStale: false }),
};

// Mock Database for testing
const mockDb = {
  pool: {} as any,
  query: jest.fn().mockResolvedValue({ rows: [] }),
  getClient: jest.fn().mockResolvedValue({
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  }),
};

export async function build(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // Disable logging in tests
  });

  // Register mock plugins
  app.decorate('redis', mockRedis as any);
  app.decorate('db', mockDb as any);

  // Register routes
  await app.register(setupRoutes);

  return app;
}

export { mockRedis, mockDb };
