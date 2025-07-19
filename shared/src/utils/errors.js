"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceUnavailableError = exports.InternalServerError = exports.DatabaseError = exports.RateLimitError = exports.AiProviderError = exports.EsiApiError = exports.ConflictError = exports.NotFoundError = exports.ApiKeyValidationError = exports.ValidationErrorClass = exports.TokenExpiredError = exports.AuthorizationError = exports.AuthenticationError = exports.AppError = void 0;
exports.formatErrorResponse = formatErrorResponse;
exports.createValidationError = createValidationError;
exports.isRetryableError = isRetryableError;
exports.getRetryDelay = getRetryDelay;
exports.sanitizeErrorForLogging = sanitizeErrorForLogging;
class AppError extends Error {
    constructor(message, details, requestId) {
        super(message);
        this.name = this.constructor.name;
        this.timestamp = new Date();
        this.details = details || undefined;
        this.requestId = requestId || undefined;
        Object.setPrototypeOf(this, new.target.prototype);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
exports.AppError = AppError;
class AuthenticationError extends AppError {
    constructor() {
        super(...arguments);
        this.code = 'AUTHENTICATION_FAILED';
        this.statusCode = 401;
        this.retryable = false;
    }
    toErrorResponse() {
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
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AppError {
    constructor() {
        super(...arguments);
        this.code = 'AUTHORIZATION_FAILED';
        this.statusCode = 403;
        this.retryable = false;
    }
    toErrorResponse() {
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
exports.AuthorizationError = AuthorizationError;
class TokenExpiredError extends AppError {
    constructor() {
        super(...arguments);
        this.code = 'TOKEN_EXPIRED';
        this.statusCode = 401;
        this.retryable = true;
    }
    toErrorResponse() {
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
exports.TokenExpiredError = TokenExpiredError;
class ValidationErrorClass extends AppError {
    constructor(message, validationErrors, requestId) {
        super(message, { validationErrors }, requestId);
        this.code = 'VALIDATION_ERROR';
        this.statusCode = 400;
        this.retryable = false;
        this.validationErrors = validationErrors;
    }
    toErrorResponse() {
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
exports.ValidationErrorClass = ValidationErrorClass;
class ApiKeyValidationError extends AppError {
    constructor() {
        super(...arguments);
        this.code = 'INVALID_API_KEY';
        this.statusCode = 400;
        this.retryable = false;
    }
    toErrorResponse() {
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
exports.ApiKeyValidationError = ApiKeyValidationError;
class NotFoundError extends AppError {
    constructor() {
        super(...arguments);
        this.code = 'RESOURCE_NOT_FOUND';
        this.statusCode = 404;
        this.retryable = false;
    }
    toErrorResponse() {
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
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor() {
        super(...arguments);
        this.code = 'RESOURCE_CONFLICT';
        this.statusCode = 409;
        this.retryable = false;
    }
    toErrorResponse() {
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
exports.ConflictError = ConflictError;
class EsiApiError extends AppError {
    constructor(message, esiStatusCode, retryAfter, requestId) {
        super(message, { esiStatusCode, retryAfter }, requestId);
        this.code = 'ESI_API_ERROR';
        this.statusCode = 502;
        this.esiStatusCode = esiStatusCode;
        this.retryAfter = retryAfter;
        this.retryable = esiStatusCode >= 500 || esiStatusCode === 429;
    }
    toErrorResponse() {
        return {
            code: this.code,
            message: this.message,
            retryable: this.retryable,
            fallbackAction: this.retryable ? 'USE_CACHED_DATA' : undefined,
            userMessage: 'EVE Online services are temporarily unavailable. Using cached data where possible.',
            details: this.details,
            timestamp: this.timestamp,
            requestId: this.requestId,
        };
    }
}
exports.EsiApiError = EsiApiError;
class AiProviderError extends AppError {
    constructor(message, provider, retryable = true, requestId) {
        super(message, { provider }, requestId);
        this.code = 'AI_PROVIDER_ERROR';
        this.statusCode = 502;
        this.provider = provider;
        this.retryable = retryable;
    }
    toErrorResponse() {
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
exports.AiProviderError = AiProviderError;
class RateLimitError extends AppError {
    constructor(message, retryAfter, requestId) {
        super(message, { retryAfter }, requestId);
        this.code = 'RATE_LIMIT_EXCEEDED';
        this.statusCode = 429;
        this.retryable = true;
        this.retryAfter = retryAfter;
    }
    toErrorResponse() {
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
exports.RateLimitError = RateLimitError;
class DatabaseError extends AppError {
    constructor(message, retryable = false, constraint, table, requestId) {
        super(message, { constraint, table }, requestId);
        this.code = 'DATABASE_ERROR';
        this.statusCode = 500;
        this.retryable = retryable;
        this.constraint = constraint;
        this.table = table;
    }
    toErrorResponse() {
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
exports.DatabaseError = DatabaseError;
class InternalServerError extends AppError {
    constructor() {
        super(...arguments);
        this.code = 'INTERNAL_SERVER_ERROR';
        this.statusCode = 500;
        this.retryable = true;
    }
    toErrorResponse() {
        return {
            code: this.code,
            message: 'An internal server error occurred',
            retryable: this.retryable,
            userMessage: 'Something went wrong on our end. Please try again later.',
            details: undefined,
            timestamp: this.timestamp,
            requestId: this.requestId,
        };
    }
}
exports.InternalServerError = InternalServerError;
class ServiceUnavailableError extends AppError {
    constructor() {
        super(...arguments);
        this.code = 'SERVICE_UNAVAILABLE';
        this.statusCode = 503;
        this.retryable = true;
    }
    toErrorResponse() {
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
exports.ServiceUnavailableError = ServiceUnavailableError;
function formatErrorResponse(error, requestId) {
    if (error instanceof AppError) {
        return error.toErrorResponse();
    }
    return {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
        retryable: false,
        userMessage: 'Something went wrong. Please try again later.',
        timestamp: new Date(),
        requestId,
    };
}
function createValidationError(fieldErrors, requestId) {
    const validationErrors = fieldErrors.map(error => ({
        field: error.field,
        message: error.message,
        code: error.code,
        value: error.value,
    }));
    return new ValidationErrorClass('Validation failed', validationErrors, requestId);
}
function isRetryableError(error) {
    if (error instanceof AppError) {
        return error.retryable;
    }
    return false;
}
function getRetryDelay(attemptNumber, baseDelay = 1000) {
    const maxDelay = 16000;
    const delay = baseDelay * Math.pow(2, attemptNumber - 1);
    return Math.min(delay, maxDelay);
}
function sanitizeErrorForLogging(error) {
    const sanitized = {
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
        if (error.details) {
            const { apiKey, password, token, ...safeDetails } = error.details;
            sanitized.details = safeDetails;
        }
    }
    return sanitized;
}
//# sourceMappingURL=errors.js.map