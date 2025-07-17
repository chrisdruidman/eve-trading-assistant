// Error handling classes and response formatters for EVE Trading Assistant

import { ErrorResponse, ValidationError } from '../types';

// ============================================================================
// Base Error Classes
// ============================================================================

export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  abstract readonly retryable: boolean;

  public readonly timestamp: Date;
  public readonly requestId?: string;
  public readonly details?: Record<string, any>;

  constructor(message: string, details?: Record<string, any>, requestId?: string) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.details = details || undefined;
    this.requestId = requestId || undefined;

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  abstract toErrorResponse(): ErrorResponse;
}

// ============================================================================
// Authentication & Authorization Errors
// ============================================================================

export class AuthenticationError extends AppError {
  readonly code = 'AUTHENTICATION_FAILED';
  readonly statusCode = 401;
  readonly retryable = false;

  toErrorResponse(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      userMessage: 'Authentication failed. Please check your credentials.',
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }
}

export class AuthorizationError extends AppError {
  readonly code = 'AUTHORIZATION_FAILED';
  readonly statusCode = 403;
  readonly retryable = false;

  toErrorResponse(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      userMessage: 'You do not have permission to perform this action.',
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }
}

export class TokenExpiredError extends AppError {
  readonly code = 'TOKEN_EXPIRED';
  readonly statusCode = 401;
  readonly retryable = true;

  toErrorResponse(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      fallbackAction: 'REFRESH_TOKEN',
      userMessage: 'Your session has expired. Please log in again.',
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }
}

// ============================================================================
// Validation Errors
// ============================================================================

export class ValidationErrorClass extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  readonly retryable = false;

  public readonly validationErrors: ValidationError[];

  constructor(message: string, validationErrors: ValidationError[], requestId?: string) {
    super(message, { validationErrors }, requestId);
    this.validationErrors = validationErrors;
  }

  toErrorResponse(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      userMessage: 'Please check your input and try again.',
      details: {
        validationErrors: this.validationErrors,
      },
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }
}

export class ApiKeyValidationError extends AppError {
  readonly code = 'INVALID_API_KEY';
  readonly statusCode = 400;
  readonly retryable = false;

  toErrorResponse(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      userMessage: 'The provided EVE Online API key is invalid or expired.',
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }
}

// ============================================================================
// Resource Errors
// ============================================================================

export class NotFoundError extends AppError {
  readonly code = 'RESOURCE_NOT_FOUND';
  readonly statusCode = 404;
  readonly retryable = false;

  toErrorResponse(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      userMessage: 'The requested resource was not found.',
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }
}

export class ConflictError extends AppError {
  readonly code = 'RESOURCE_CONFLICT';
  readonly statusCode = 409;
  readonly retryable = false;

  toErrorResponse(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      userMessage: 'The resource already exists or conflicts with existing data.',
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }
}

// ============================================================================
// External Service Errors
// ============================================================================

export class EsiApiError extends AppError {
  readonly code = 'ESI_API_ERROR';
  readonly statusCode = 502;
  readonly retryable: boolean;

  public readonly esiStatusCode: number;
  public readonly retryAfter?: number;

  constructor(message: string, esiStatusCode: number, retryAfter?: number, requestId?: string) {
    super(message, { esiStatusCode, retryAfter }, requestId);
    this.esiStatusCode = esiStatusCode;
    this.retryAfter = retryAfter;
    this.retryable = esiStatusCode >= 500 || esiStatusCode === 429;
  }

  toErrorResponse(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      fallbackAction: this.retryable ? 'USE_CACHED_DATA' : undefined,
      userMessage:
        'EVE Online services are temporarily unavailable. Using cached data where possible.',
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }
}

export class AiProviderError extends AppError {
  readonly code = 'AI_PROVIDER_ERROR';
  readonly statusCode = 502;
  readonly retryable: boolean;

  public readonly provider: string;

  constructor(message: string, provider: string, retryable: boolean = true, requestId?: string) {
    super(message, { provider }, requestId);
    this.provider = provider;
    this.retryable = retryable;
  }

  toErrorResponse(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      fallbackAction: 'FALLBACK_AI_PROVIDER',
      userMessage: 'AI analysis is temporarily unavailable. Trying alternative provider.',
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }
}

// ============================================================================
// Rate Limiting Errors
// ============================================================================

export class RateLimitError extends AppError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly statusCode = 429;
  readonly retryable = true;

  public readonly retryAfter: number;

  constructor(message: string, retryAfter: number, requestId?: string) {
    super(message, { retryAfter }, requestId);
    this.retryAfter = retryAfter;
  }

  toErrorResponse(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      fallbackAction: 'RETRY_AFTER_DELAY',
      userMessage: `Too many requests. Please wait ${this.retryAfter} seconds before trying again.`,
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }
}

// ============================================================================
// Database Errors
// ============================================================================

export class DatabaseError extends AppError {
  readonly code = 'DATABASE_ERROR';
  readonly statusCode = 500;
  readonly retryable: boolean;

  public readonly constraint?: string;
  public readonly table?: string;

  constructor(
    message: string,
    retryable: boolean = false,
    constraint?: string,
    table?: string,
    requestId?: string
  ) {
    super(message, { constraint, table }, requestId);
    this.retryable = retryable;
    this.constraint = constraint;
    this.table = table;
  }

  toErrorResponse(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      userMessage: 'A database error occurred. Please try again later.',
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }
}

// ============================================================================
// System Errors
// ============================================================================

export class InternalServerError extends AppError {
  readonly code = 'INTERNAL_SERVER_ERROR';
  readonly statusCode = 500;
  readonly retryable = true;

  toErrorResponse(): ErrorResponse {
    return {
      code: this.code,
      message: 'An internal server error occurred',
      retryable: this.retryable,
      userMessage: 'Something went wrong on our end. Please try again later.',
      details: undefined, // Don't expose internal details
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }
}

export class ServiceUnavailableError extends AppError {
  readonly code = 'SERVICE_UNAVAILABLE';
  readonly statusCode = 503;
  readonly retryable = true;

  toErrorResponse(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      userMessage: 'The service is temporarily unavailable. Please try again later.',
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }
}

// ============================================================================
// Error Response Formatters
// ============================================================================

/**
 * Format error for API response
 */
export function formatErrorResponse(error: Error, requestId?: string): ErrorResponse {
  if (error instanceof AppError) {
    return error.toErrorResponse();
  }

  // Handle unknown errors
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    retryable: false,
    userMessage: 'Something went wrong. Please try again later.',
    timestamp: new Date(),
    requestId,
  };
}

/**
 * Create validation error from field errors
 */
export function createValidationError(
  fieldErrors: Array<{ field: string; message: string; code: string; value?: any }>,
  requestId?: string
): ValidationErrorClass {
  const validationErrors: ValidationError[] = fieldErrors.map(error => ({
    field: error.field,
    message: error.message,
    code: error.code,
    value: error.value,
  }));

  return new ValidationErrorClass('Validation failed', validationErrors, requestId);
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.retryable;
  }
  return false;
}

/**
 * Get retry delay for exponential backoff
 */
export function getRetryDelay(attemptNumber: number, baseDelay: number = 1000): number {
  const maxDelay = 16000; // 16 seconds
  const delay = baseDelay * Math.pow(2, attemptNumber - 1);
  return Math.min(delay, maxDelay);
}

/**
 * Sanitize error for logging (remove sensitive information)
 */
export function sanitizeErrorForLogging(error: Error): Record<string, any> {
  const sanitized: Record<string, any> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  if (error instanceof AppError) {
    sanitized.code = error.code;
    sanitized.statusCode = error.statusCode;
    sanitized.retryable = error.retryable;
    sanitized.timestamp = error.timestamp;
    sanitized.requestId = error.requestId;

    // Only include non-sensitive details
    if (error.details) {
      const { apiKey, password, token, ...safeDetails } = error.details;
      sanitized.details = safeDetails;
    }
  }

  return sanitized;
}
