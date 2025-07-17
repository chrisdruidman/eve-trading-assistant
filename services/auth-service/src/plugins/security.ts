import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

async function securityPlugin(fastify: FastifyInstance) {
  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });

  // CORS configuration
  await fastify.register(cors, {
    origin: (origin, callback) => {
      const hostname = new URL(origin || 'http://localhost').hostname;

      // Allow localhost for development
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        callback(null, true);
        return;
      }

      // Allow production domains
      const allowedDomains = process.env.ALLOWED_ORIGINS?.split(',') || [];
      if (allowedDomains.includes(hostname)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: 100, // Maximum 100 requests
    timeWindow: '1 minute', // Per minute
    errorResponseBuilder(_request, context) {
      return {
        code: 429,
        error: 'Rate limit exceeded',
        message: `Too many requests, retry after ${Math.round(context.ttl / 1000)} seconds`,
        expiresIn: Math.round(context.ttl / 1000),
      };
    },
  });

  // Stricter rate limiting for auth endpoints
  await fastify.register(rateLimit, {
    max: 5, // Maximum 5 requests
    timeWindow: '1 minute', // Per minute
    keyGenerator(request) {
      return request.ip; // Rate limit by IP
    },
    errorResponseBuilder(_request, context) {
      return {
        code: 429,
        error: 'Authentication rate limit exceeded',
        message: `Too many authentication attempts, retry after ${Math.round(context.ttl / 1000)} seconds`,
        expiresIn: Math.round(context.ttl / 1000),
      };
    },
  });
}

export default fp(securityPlugin, {
  name: 'security-plugin',
});
