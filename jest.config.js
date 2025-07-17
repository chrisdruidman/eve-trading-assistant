module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/services', '<rootDir>/shared'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'services/**/*.ts',
    'shared/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapping: {
    '^@shared/(.*)$': '<rootDir>/shared/src/$1',
    '^@auth-service/(.*)$': '<rootDir>/services/auth-service/src/$1',
    '^@market-service/(.*)$': '<rootDir>/services/market-service/src/$1',
    '^@trading-service/(.*)$': '<rootDir>/services/trading-service/src/$1',
    '^@ai-service/(.*)$': '<rootDir>/services/ai-service/src/$1',
    '^@notification-service/(.*)$': '<rootDir>/services/notification-service/src/$1',
    '^@user-service/(.*)$': '<rootDir>/services/user-service/src/$1',
  },
  testTimeout: 10000,
};
