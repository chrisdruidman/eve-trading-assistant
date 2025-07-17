// Constants for EVE Trading Assistant
// Complete shared constants for the application

// ============================================================================
// API Endpoints
// ============================================================================

export const API_ENDPOINTS = {
  ESI_BASE: 'https://esi.evetech.net',
  AUTH_SERVICE: 'http://localhost:3001',
  MARKET_SERVICE: 'http://localhost:3002',
  TRADING_SERVICE: 'http://localhost:3003',
  AI_SERVICE: 'http://localhost:3004',
  NOTIFICATION_SERVICE: 'http://localhost:3005',
  USER_SERVICE: 'http://localhost:3006',
} as const;

export const ESI_ENDPOINTS = {
  MARKET_ORDERS: '/v1/markets/{region_id}/orders/',
  MARKET_HISTORY: '/v1/markets/{region_id}/history/',
  MARKET_TYPES: '/v1/markets/types/',
  CHARACTER_INFO: '/v5/characters/{character_id}/',
  CORPORATION_INFO: '/v5/corporations/{corporation_id}/',
  ALLIANCE_INFO: '/v4/alliances/{alliance_id}/',
  TOKEN_VERIFY: '/v2/oauth/verify/',
} as const;

// ============================================================================
// Cache Configuration
// ============================================================================

export const CACHE_TTL = {
  MARKET_DATA: 5 * 60, // 5 minutes
  MARKET_HISTORY: 60 * 60, // 1 hour
  AI_RESPONSES: 60 * 60, // 1 hour
  USER_SESSION: 15 * 60, // 15 minutes
  CHARACTER_INFO: 24 * 60 * 60, // 24 hours
  CORPORATION_INFO: 24 * 60 * 60, // 24 hours
  TYPE_INFO: 7 * 24 * 60 * 60, // 7 days
} as const;

export const CACHE_KEYS = {
  MARKET_DATA: 'market:data',
  MARKET_HISTORY: 'market:history',
  AI_RESPONSE: 'ai:response',
  USER_SESSION: 'user:session',
  CHARACTER_INFO: 'character:info',
  TRADING_SUGGESTIONS: 'trading:suggestions',
  WATCHLIST_ALERTS: 'watchlist:alerts',
} as const;

// ============================================================================
// EVE Online Constants
// ============================================================================

export const EVE_REGIONS = {
  THE_FORGE: 10000002,
  DOMAIN: 10000043,
  SINQ_LAISON: 10000032,
  HEIMATAR: 10000030,
  METROPOLIS: 10000042,
  DELVE: 10000060,
  PROVIDENCE: 10000047,
  CATCH: 10000014,
  CURSE: 10000012,
  GREAT_WILDLANDS: 10000011,
} as const;

export const EVE_STATIONS = {
  JITA_4_4: 60003760,
  AMARR_VIII: 60008494,
  DODIXIE_IX: 60011866,
  HEK_VIII: 60005686,
  RENS_VI: 60004588,
} as const;

export const EVE_SCOPES = {
  READ_CHARACTER_ASSETS: 'esi-assets.read_assets.v1',
  READ_CHARACTER_WALLET: 'esi-wallet.read_character_wallet.v1',
  READ_CHARACTER_ORDERS: 'esi-markets.read_character_orders.v1',
  READ_CORPORATION_ASSETS: 'esi-assets.read_corporation_assets.v1',
  READ_CORPORATION_WALLET: 'esi-wallet.read_corporation_wallets.v1',
} as const;

// ============================================================================
// Trading Constants
// ============================================================================

export const RISK_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

export const RISK_TOLERANCE = {
  CONSERVATIVE: 'CONSERVATIVE',
  MODERATE: 'MODERATE',
  AGGRESSIVE: 'AGGRESSIVE',
} as const;

export const TRADING_PLAN_STATUS = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
} as const;

export const TRADE_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export const TIME_HORIZONS = {
  SHORT: 'SHORT', // < 1 day
  MEDIUM: 'MEDIUM', // 1-7 days
  LONG: 'LONG', // > 7 days
} as const;

export const TRADING_EXPERIENCE = {
  BEGINNER: 'BEGINNER',
  INTERMEDIATE: 'INTERMEDIATE',
  ADVANCED: 'ADVANCED',
} as const;

// ============================================================================
// Market Constants
// ============================================================================

export const MARKET_TRENDS = {
  UPWARD: 'UPWARD',
  DOWNWARD: 'DOWNWARD',
  STABLE: 'STABLE',
} as const;

export const MARKET_CONDITIONS = {
  BULL: 'BULL',
  BEAR: 'BEAR',
  SIDEWAYS: 'SIDEWAYS',
} as const;

export const ALERT_CONDITIONS = {
  PRICE_ABOVE: 'PRICE_ABOVE',
  PRICE_BELOW: 'PRICE_BELOW',
  VOLUME_ABOVE: 'VOLUME_ABOVE',
  VOLUME_BELOW: 'VOLUME_BELOW',
} as const;

// ============================================================================
// AI Provider Constants
// ============================================================================

export const AI_PROVIDERS = {
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  FALLBACK: 'fallback',
} as const;

export const AI_MODELS = {
  CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',
  CLAUDE_3_HAIKU: 'claude-3-haiku-20240307',
  GPT_4_TURBO: 'gpt-4-turbo-preview',
  GPT_3_5_TURBO: 'gpt-3.5-turbo',
} as const;

// ============================================================================
// Notification Constants
// ============================================================================

export const NOTIFICATION_TYPES = {
  MARKET_ALERT: 'MARKET_ALERT',
  TRADING_OPPORTUNITY: 'TRADING_OPPORTUNITY',
  SYSTEM_UPDATE: 'SYSTEM_UPDATE',
  ACCOUNT_NOTICE: 'ACCOUNT_NOTICE',
} as const;

export const NOTIFICATION_PRIORITIES = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;

export const NOTIFICATION_CHANNELS = {
  EMAIL: 'EMAIL',
  IN_APP: 'IN_APP',
  PUSH: 'PUSH',
} as const;

// ============================================================================
// Error Constants
// ============================================================================

export const ERROR_CODES = {
  // Authentication & Authorization
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_API_KEY: 'INVALID_API_KEY',

  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // Resources
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',

  // External Services
  ESI_API_ERROR: 'ESI_API_ERROR',
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',

  // System
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Generic
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ============================================================================
// Rate Limiting Constants
// ============================================================================

export const RATE_LIMITS = {
  ESI_REQUESTS_PER_SECOND: 150,
  ESI_ERROR_LIMIT_REMAIN: 100,
  AI_REQUESTS_PER_MINUTE: 60,
  API_REQUESTS_PER_MINUTE: 1000,
  USER_REQUESTS_PER_MINUTE: 100,
} as const;

export const BACKOFF_CONFIG = {
  BASE_DELAY: 1000, // 1 second
  MAX_DELAY: 16000, // 16 seconds
  MULTIPLIER: 2,
  MAX_ATTEMPTS: 5,
} as const;

// ============================================================================
// Subscription Constants
// ============================================================================

export const SUBSCRIPTION_TIERS = {
  FREE: 'FREE',
  PREMIUM: 'PREMIUM',
} as const;

export const SUBSCRIPTION_LIMITS = {
  FREE: {
    WATCHLIST_ITEMS: 10,
    TRADING_SUGGESTIONS_PER_DAY: 50,
    AI_REQUESTS_PER_DAY: 100,
    ALERTS: 5,
  },
  PREMIUM: {
    WATCHLIST_ITEMS: 100,
    TRADING_SUGGESTIONS_PER_DAY: 500,
    AI_REQUESTS_PER_DAY: 1000,
    ALERTS: 50,
  },
} as const;

// ============================================================================
// Application Constants
// ============================================================================

export const APP_CONFIG = {
  NAME: 'EVE Trading Assistant',
  VERSION: '1.0.0',
  DESCRIPTION: 'AI-powered trading assistant for EVE Online',
  AUTHOR: 'EVE Trading Assistant Team',
  HOMEPAGE: 'https://eve-trading-assistant.com',
  SUPPORT_EMAIL: 'support@eve-trading-assistant.com',
} as const;

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
  SORT_ORDER: 'asc',
} as const;

export const VALIDATION_LIMITS = {
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 50,
  PASSWORD_MIN_LENGTH: 8,
  EMAIL_MAX_LENGTH: 255,
  TRADING_GOALS_MAX: 10,
  PREFERRED_REGIONS_MAX: 10,
  EXCLUDED_ITEMS_MAX: 100,
  NOTIFICATION_TITLE_MAX: 100,
  NOTIFICATION_MESSAGE_MAX: 1000,
  MINIMUM_BUDGET_ISK: 1000,
} as const;

// ============================================================================
// Feature Flags
// ============================================================================

export const FEATURE_FLAGS = {
  ENABLE_AI_ANALYSIS: true,
  ENABLE_PUSH_NOTIFICATIONS: true,
  ENABLE_ADVANCED_CHARTS: true,
  ENABLE_PORTFOLIO_TRACKING: false,
  ENABLE_SOCIAL_FEATURES: false,
  ENABLE_MOBILE_APP: false,
} as const;

// ============================================================================
// Environment Constants
// ============================================================================

export const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

export const LOG_LEVELS = {
  TRACE: 'trace',
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal',
} as const;
