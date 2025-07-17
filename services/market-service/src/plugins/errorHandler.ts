import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ErrorResponse } from '../../../../shared/src/types';

export const errorHandler = (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
  const requestId = request.id;

  // Log the error
  request.log.error(
    {
      error: error.message,
      stack: error.stack,
      requestId,
      url: request.url,
      method: request.method,
    },
    'Request error'
  );

  // Handle different types of errors
  let statusCode = 500;
  let errorResponse: ErrorResponse;

  if (error.statusCode) {
    statusCode = error.statusCode;
  }

  switch (error.code) {
    case 'RATE_LIMIT_EXCEEDED':
      statusCode = 429;
      errorResponse = {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        retryable: true,
        userMessage: 'Please wait before making more requests',
        timestamp: new Date(),
        requestId,
      };
      break;

    case 'FST_ERR_VALIDATION':
      statusCode = 400;
      errorResponse = {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        retryable: false,
        userMessage: 'Please check your request parameters',
        details: error.validation,
        timestamp: new Date(),
        requestId,
      };
      break;

    case 'ECONNREFUSED':
    case 'ENOTFOUND':
      statusCode = 503;
      errorResponse = {
        code: 'SERVICE_UNAVAILABLE',
        message: 'External service unavailable',
        retryable: true,
        fallbackAction: 'Using cached data where available',
        userMessage: 'Service temporarily unavailable, please try again later',
        timestamp: new Date(),
        requestId,
      };
      break;

    default:
      errorResponse = {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An unexpected error occurred',
        retryable: false,
        userMessage: 'An error occurred while processing your request',
        timestamp: new Date(),
        requestId,
      };
  }

  reply.status(statusCode).send(errorResponse);
};
