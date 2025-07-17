// Shared utilities and types for EVE Trading Assistant
// This is the main export file for shared components

export * from './types';
export * from './constants';

// Export utils with explicit re-exports to avoid conflicts
export {
  // Formatting utilities
  formatCurrency,
  formatISK,
  formatNumber,
  formatPercentage,
  formatDuration,

  // Date and time utilities
  sleep,
  formatDate,
  formatRelativeTime,
  isDateExpired,
  addDays,
  addHours,

  // Trading calculation utilities
  calculateProfitMargin,
  calculateProfit,
  calculateROI,
  calculateBreakEvenPrice,
  calculateTaxes,
  calculateBrokerFees,
  calculateNetProfit,

  // Risk assessment utilities
  calculateRiskScore,
  getRiskLevel,
  calculateConfidenceScore,

  // Data processing utilities
  chunk,
  groupBy,
  sortBy,
  unique,
  average,
  median,
  standardDeviation,

  // String utilities
  slugify,
  truncate,
  capitalize,
  camelCase,
  kebabCase,

  // Validation utilities
  validateApiKey,
  validateEmail,
  validateUrl,
  isValidNumber,
  isPositiveNumber,
  isNonNegativeNumber,

  // Cache key utilities
  createCacheKey,
  hashString,

  // Retry utilities
  retry,

  // Encryption utilities
  generateEncryptionKey,
  encryptData,
  decryptData,
  encryptApiKey,
  decryptApiKey,
  hashPassword,
  verifyPassword,
  generateSecureToken,
  createHmacSignature,
  verifyHmacSignature,

  // Error handling utilities
  AppError,
  AuthenticationError,
  AuthorizationError,
  TokenExpiredError,
  ValidationErrorClass,
  ApiKeyValidationError,
  NotFoundError,
  ConflictError,
  EsiApiError,
  AiProviderError as AiProviderErrorClass,
  RateLimitError,
  DatabaseError as DatabaseErrorClass,
  InternalServerError,
  ServiceUnavailableError,
  formatErrorResponse,
  createValidationError,
  isRetryableError,
  getRetryDelay,
  sanitizeErrorForLogging,

  // Validation utilities with Zod
  emailSchema,
  passwordSchema,
  uuidSchema,
  positiveNumberSchema,
  nonNegativeNumberSchema,
  eveCharacterIdSchema,
  eveRegionIdSchema,
  eveTypeIdSchema,
  iskAmountSchema,
  userCredentialsSchema,
  userRegistrationSchema,
  userPreferencesSchema,
  eveApiKeySchema,
  eveCharacterSchema,
  marketOrderSchema,
  marketDataRequestSchema,
  historicalDataRequestSchema,
  watchlistItemSchema,
  alertRuleSchema,
  tradingPlanParamsSchema,
  tradingSuggestionSchema,
  executedTradeSchema,
  analysisContextSchema,
  userProfileSchema,
  notificationSchema,
  validateData,
  validateDataSafe,
  validateEveApiKey,
  validatePassword,
  validateIskAmount,
  validateEveCharacterId,
  validateEveRegionId,
  validateEveTypeId,
  createUpdateSchema,
  paginationSchema,
  validatePagination,

  // Logging utilities
  AppLogger,
  createLogger,
  initializeLogger,
  getLogger,
  HealthMonitor,
  createRequestLogger,
  createErrorLogger,
} from './utils';
