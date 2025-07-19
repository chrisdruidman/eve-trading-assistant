import { ErrorResponse, ValidationError } from '../types';
export declare abstract class AppError extends Error {
    abstract readonly code: string;
    abstract readonly statusCode: number;
    abstract readonly retryable: boolean;
    readonly timestamp: Date;
    readonly requestId?: string;
    readonly details?: Record<string, any>;
    constructor(message: string, details?: Record<string, any>, requestId?: string);
    abstract toErrorResponse(): ErrorResponse;
}
export declare class AuthenticationError extends AppError {
    readonly code = "AUTHENTICATION_FAILED";
    readonly statusCode = 401;
    readonly retryable = false;
    toErrorResponse(): ErrorResponse;
}
export declare class AuthorizationError extends AppError {
    readonly code = "AUTHORIZATION_FAILED";
    readonly statusCode = 403;
    readonly retryable = false;
    toErrorResponse(): ErrorResponse;
}
export declare class TokenExpiredError extends AppError {
    readonly code = "TOKEN_EXPIRED";
    readonly statusCode = 401;
    readonly retryable = true;
    toErrorResponse(): ErrorResponse;
}
export declare class ValidationErrorClass extends AppError {
    readonly code = "VALIDATION_ERROR";
    readonly statusCode = 400;
    readonly retryable = false;
    readonly validationErrors: ValidationError[];
    constructor(message: string, validationErrors: ValidationError[], requestId?: string);
    toErrorResponse(): ErrorResponse;
}
export declare class ApiKeyValidationError extends AppError {
    readonly code = "INVALID_API_KEY";
    readonly statusCode = 400;
    readonly retryable = false;
    toErrorResponse(): ErrorResponse;
}
export declare class NotFoundError extends AppError {
    readonly code = "RESOURCE_NOT_FOUND";
    readonly statusCode = 404;
    readonly retryable = false;
    toErrorResponse(): ErrorResponse;
}
export declare class ConflictError extends AppError {
    readonly code = "RESOURCE_CONFLICT";
    readonly statusCode = 409;
    readonly retryable = false;
    toErrorResponse(): ErrorResponse;
}
export declare class EsiApiError extends AppError {
    readonly code = "ESI_API_ERROR";
    readonly statusCode = 502;
    readonly retryable: boolean;
    readonly esiStatusCode: number;
    readonly retryAfter?: number;
    constructor(message: string, esiStatusCode: number, retryAfter?: number, requestId?: string);
    toErrorResponse(): ErrorResponse;
}
export declare class AiProviderError extends AppError {
    readonly code = "AI_PROVIDER_ERROR";
    readonly statusCode = 502;
    readonly retryable: boolean;
    readonly provider: string;
    constructor(message: string, provider: string, retryable?: boolean, requestId?: string);
    toErrorResponse(): ErrorResponse;
}
export declare class RateLimitError extends AppError {
    readonly code = "RATE_LIMIT_EXCEEDED";
    readonly statusCode = 429;
    readonly retryable = true;
    readonly retryAfter: number;
    constructor(message: string, retryAfter: number, requestId?: string);
    toErrorResponse(): ErrorResponse;
}
export declare class DatabaseError extends AppError {
    readonly code = "DATABASE_ERROR";
    readonly statusCode = 500;
    readonly retryable: boolean;
    readonly constraint?: string;
    readonly table?: string;
    constructor(message: string, retryable?: boolean, constraint?: string, table?: string, requestId?: string);
    toErrorResponse(): ErrorResponse;
}
export declare class InternalServerError extends AppError {
    readonly code = "INTERNAL_SERVER_ERROR";
    readonly statusCode = 500;
    readonly retryable = true;
    toErrorResponse(): ErrorResponse;
}
export declare class ServiceUnavailableError extends AppError {
    readonly code = "SERVICE_UNAVAILABLE";
    readonly statusCode = 503;
    readonly retryable = true;
    toErrorResponse(): ErrorResponse;
}
export declare function formatErrorResponse(error: Error, requestId?: string): ErrorResponse;
export declare function createValidationError(fieldErrors: Array<{
    field: string;
    message: string;
    code: string;
    value?: any;
}>, requestId?: string): ValidationErrorClass;
export declare function isRetryableError(error: Error): boolean;
export declare function getRetryDelay(attemptNumber: number, baseDelay?: number): number;
export declare function sanitizeErrorForLogging(error: Error): Record<string, any>;
//# sourceMappingURL=errors.d.ts.map