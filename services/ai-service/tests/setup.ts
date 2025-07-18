/**
 * Test setup for AI Service
 * Configures global test environment and mocks
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock console methods to reduce test noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Global test timeout
jest.setTimeout(30000);

// Mock timers for tests that use setTimeout/setInterval
beforeEach(() => {
  jest.clearAllTimers();
});

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export test utilities
export const testUtils = {
  /**
   * Create a mock AI response
   */
  createMockAIResponse: (overrides = {}) => ({
    content: 'Mock AI response content',
    confidence: 0.8,
    provider: 'test-provider',
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
    cached: false,
    ...overrides,
  }),

  /**
   * Create mock market data
   */
  createMockMarketData: (overrides = {}) => ({
    typeId: 34,
    regionId: 10000002,
    buyOrders: [
      {
        orderId: 1,
        typeId: 34,
        regionId: 10000002,
        locationId: 60003760,
        price: 5.5,
        volume: 1000,
        minVolume: 1,
        duration: 90,
        issued: new Date(),
        isBuyOrder: true,
      },
    ],
    sellOrders: [
      {
        orderId: 2,
        typeId: 34,
        regionId: 10000002,
        locationId: 60003760,
        price: 6.0,
        volume: 500,
        minVolume: 1,
        duration: 90,
        issued: new Date(),
        isBuyOrder: false,
      },
    ],
    lastUpdated: new Date(),
    volume: 1500,
    averagePrice: 5.75,
    ...overrides,
  }),

  /**
   * Create mock user profile
   */
  createMockUserProfile: (overrides = {}) => ({
    userId: 'test-user-123',
    tradingExperience: 'INTERMEDIATE' as const,
    riskTolerance: 'MODERATE' as const,
    availableBudget: 10000000,
    preferredMarkets: [10000002],
    tradingGoals: ['profit_maximization'],
    ...overrides,
  }),

  /**
   * Wait for a specified amount of time
   */
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Create a promise that rejects after a timeout
   */
  timeout: (ms: number, message = 'Operation timed out') =>
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
};
