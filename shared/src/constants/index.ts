// Constants for EVE Trading Assistant
// Placeholder file for shared constants

export const API_ENDPOINTS = {
  ESI_BASE: 'https://esi.evetech.net',
  AUTH_SERVICE: 'http://localhost:3001',
  MARKET_SERVICE: 'http://localhost:3002',
  TRADING_SERVICE: 'http://localhost:3003',
  AI_SERVICE: 'http://localhost:3004',
  NOTIFICATION_SERVICE: 'http://localhost:3005',
  USER_SERVICE: 'http://localhost:3006',
} as const;

export const CACHE_TTL = {
  MARKET_DATA: 5 * 60, // 5 minutes
  AI_RESPONSES: 60 * 60, // 1 hour
  USER_SESSION: 15 * 60, // 15 minutes
} as const;

export const EVE_REGIONS = {
  THE_FORGE: 10000002,
  DOMAIN: 10000043,
  SINQ_LAISON: 10000032,
  HEIMATAR: 10000030,
  METROPOLIS: 10000042,
} as const;

export const RISK_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;
