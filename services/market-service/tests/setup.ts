// Jest setup file for market service tests

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test environment variables
process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'silent';
process.env['DATABASE_URL'] = 'postgresql://localhost:5432/eve_trading_test';
process.env['REDIS_URL'] = 'redis://localhost:6379/1';

// Global test timeout
jest.setTimeout(10000);
