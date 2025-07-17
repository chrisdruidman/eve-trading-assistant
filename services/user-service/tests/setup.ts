// Test setup file
// This file is run before each test file

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://localhost:5432/eve_trading_test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.DATA_ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';

// Suppress console logs during tests unless explicitly needed
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
jest.setTimeout(10000);
