// Logging utilities and monitoring infrastructure for EVE Trading Assistant

import pino from 'pino';
import { sanitizeErrorForLogging } from './errors';

// ============================================================================
// Logger Configuration
// ============================================================================

export interface LoggerConfig {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service: string;
  environment: string;
  version?: string;
  prettyPrint?: boolean;
  redactPaths?: string[];
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface MetricData {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp?: Date;
}

export interface TraceData {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'success' | 'error';
  tags?: Record<string, string>;
  logs?: Array<{ timestamp: Date; message: string; level: string }>;
}

// ============================================================================
// Logger Factory
// ============================================================================

const defaultRedactPaths = [
  'password',
  'apiKey',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'secret',
  'key',
  'credentials',
];

export function createLogger(config: LoggerConfig): pino.Logger {
  const pinoConfig: pino.LoggerOptions = {
    level: config.level,
    base: {
      service: config.service,
      environment: config.environment,
      version: config.version || 'unknown',
    },
    redact: {
      paths: [...defaultRedactPaths, ...(config.redactPaths || [])],
      censor: '[REDACTED]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: label => ({ level: label }),
    },
  };

  if (config.prettyPrint && config.environment === 'development') {
    pinoConfig.transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  }

  return pino(pinoConfig);
}

// ============================================================================
// Application Logger
// ============================================================================

export class AppLogger {
  private logger: pino.Logger;
  private metrics: MetricData[] = [];
  private traces: Map<string, TraceData> = new Map();

  constructor(config: LoggerConfig) {
    this.logger = createLogger(config);
  }

  // Basic logging methods
  trace(message: string, context?: LogContext): void {
    this.logger.trace(this.formatLogEntry(message, context));
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(this.formatLogEntry(message, context));
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(this.formatLogEntry(message, context));
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(this.formatLogEntry(message, context));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    const logEntry = this.formatLogEntry(message, context);
    if (error) {
      logEntry.error = error;
    }
    this.logger.error(logEntry);
  }

  fatal(message: string, error?: Error, context?: LogContext): void {
    const logEntry = this.formatLogEntry(message, context);
    if (error) {
      logEntry.error = error;
    }
    this.logger.fatal(logEntry);
  }

  // Structured logging methods
  logApiRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    this.info('API Request', {
      ...context,
      operation: `${method} ${url}`,
      duration,
      metadata: {
        method,
        url,
        statusCode,
        duration,
      },
    });
  }

  logDatabaseQuery(query: string, duration: number, rowCount?: number, context?: LogContext): void {
    this.debug('Database Query', {
      ...context,
      operation: 'database_query',
      duration,
      metadata: {
        query: query.substring(0, 200), // Truncate long queries
        duration,
        rowCount,
      },
    });
  }

  logExternalApiCall(
    service: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    context?: LogContext
  ): void {
    this.info('External API Call', {
      ...context,
      operation: `external_api_${service}`,
      duration,
      metadata: {
        service,
        endpoint,
        statusCode,
        duration,
      },
    });
  }

  logCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'delete',
    key: string,
    context?: LogContext
  ): void {
    this.debug('Cache Operation', {
      ...context,
      operation: `cache_${operation}`,
      metadata: {
        operation,
        key: key.substring(0, 100), // Truncate long keys
      },
    });
  }

  logUserAction(userId: string, action: string, resource?: string, context?: LogContext): void {
    this.info('User Action', {
      ...context,
      userId,
      operation: action,
      metadata: {
        action,
        resource,
      },
    });
  }

  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context?: LogContext
  ): void {
    const logMethod =
      severity === 'critical' ? this.error : severity === 'high' ? this.warn : this.info;
    logMethod.call(this, `Security Event: ${event}`, undefined, {
      ...context,
      operation: 'security_event',
      metadata: {
        event,
        severity,
      },
    });
  }

  // Metrics collection
  recordMetric(metric: MetricData): void {
    this.metrics.push({
      ...metric,
      timestamp: metric.timestamp || new Date(),
    });

    this.debug('Metric Recorded', {
      operation: 'metric_collection',
      metadata: metric,
    });
  }

  recordCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      unit: 'count',
      tags,
    });
  }

  recordGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      unit: 'gauge',
      tags,
    });
  }

  recordTimer(name: string, duration: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value: duration,
      unit: 'milliseconds',
      tags,
    });
  }

  // Distributed tracing
  startTrace(traceId: string, operation: string, parentSpanId?: string): string {
    const spanId = this.generateSpanId();
    const trace: TraceData = {
      traceId,
      spanId,
      parentSpanId,
      operation,
      startTime: new Date(),
      status: 'success',
      logs: [],
    };

    this.traces.set(spanId, trace);

    this.debug('Trace Started', {
      operation: 'trace_start',
      metadata: {
        traceId,
        spanId,
        parentSpanId,
        operation,
      },
    });

    return spanId;
  }

  finishTrace(
    spanId: string,
    status: 'success' | 'error' = 'success',
    tags?: Record<string, string>
  ): void {
    const trace = this.traces.get(spanId);
    if (!trace) {
      this.warn('Attempted to finish non-existent trace', { metadata: { spanId } });
      return;
    }

    trace.endTime = new Date();
    trace.duration = trace.endTime.getTime() - trace.startTime.getTime();
    trace.status = status;
    trace.tags = { ...trace.tags, ...tags };

    this.debug('Trace Finished', {
      operation: 'trace_finish',
      duration: trace.duration,
      metadata: {
        traceId: trace.traceId,
        spanId,
        operation: trace.operation,
        status,
        duration: trace.duration,
      },
    });

    // Record trace duration as metric
    this.recordTimer(`trace.${trace.operation}`, trace.duration, {
      status,
      ...tags,
    });

    this.traces.delete(spanId);
  }

  addTraceLog(spanId: string, message: string, level: string = 'info'): void {
    const trace = this.traces.get(spanId);
    if (trace) {
      trace.logs?.push({
        timestamp: new Date(),
        message,
        level,
      });
    }
  }

  // Performance monitoring
  async measureAsync<T>(operation: string, fn: () => Promise<T>, context?: LogContext): Promise<T> {
    const startTime = Date.now();
    const traceId = context?.requestId || this.generateTraceId();
    const spanId = this.startTrace(traceId, operation);

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      this.finishTrace(spanId, 'success');
      this.recordTimer(`operation.${operation}`, duration, { status: 'success' });

      this.debug(`Operation completed: ${operation}`, {
        ...context,
        operation,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.finishTrace(spanId, 'error');
      this.recordTimer(`operation.${operation}`, duration, { status: 'error' });

      this.error(`Operation failed: ${operation}`, error as Error, {
        ...context,
        operation,
        duration,
      });

      throw error;
    }
  }

  measureSync<T>(operation: string, fn: () => T, context?: LogContext): T {
    const startTime = Date.now();

    try {
      const result = fn();
      const duration = Date.now() - startTime;

      this.recordTimer(`operation.${operation}`, duration, { status: 'success' });

      this.debug(`Operation completed: ${operation}`, {
        ...context,
        operation,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.recordTimer(`operation.${operation}`, duration, { status: 'error' });

      this.error(`Operation failed: ${operation}`, error as Error, {
        ...context,
        operation,
        duration,
      });

      throw error;
    }
  }

  // Utility methods
  getMetrics(): MetricData[] {
    return [...this.metrics];
  }

  clearMetrics(): void {
    this.metrics = [];
  }

  child(bindings: Record<string, any>): AppLogger {
    const childLogger = new AppLogger({
      level: this.logger.level as any,
      service: 'child',
      environment: 'unknown',
    });
    childLogger.logger = this.logger.child(bindings);
    return childLogger;
  }

  private formatLogEntry(message: string, context?: LogContext): Record<string, any> {
    const entry: Record<string, any> = { msg: message };

    if (context) {
      if (context.requestId) entry.requestId = context.requestId;
      if (context.userId) entry.userId = context.userId;
      if (context.operation) entry.operation = context.operation;
      if (context.duration !== undefined) entry.duration = context.duration;
      if (context.metadata) entry.metadata = context.metadata;
    }

    return entry;
  }

  private generateTraceId(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }

  private generateSpanId(): string {
    return Math.random().toString(36).substring(2, 10);
  }
}

// ============================================================================
// Global Logger Instance
// ============================================================================

let globalLogger: AppLogger | null = null;

export function initializeLogger(config: LoggerConfig): AppLogger {
  globalLogger = new AppLogger(config);
  return globalLogger;
}

export function getLogger(): AppLogger {
  if (!globalLogger) {
    // Create default logger if not initialized
    globalLogger = new AppLogger({
      level: 'info',
      service: 'eve-trading-assistant',
      environment: process.env.NODE_ENV || 'development',
      prettyPrint: process.env.NODE_ENV === 'development',
    });
  }
  return globalLogger;
}

// ============================================================================
// Monitoring Utilities
// ============================================================================

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  duration?: number;
  timestamp: Date;
}

export class HealthMonitor {
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();
  private logger: AppLogger;

  constructor(logger: AppLogger) {
    this.logger = logger;
  }

  registerCheck(name: string, checkFn: () => Promise<HealthCheck>): void {
    this.checks.set(name, checkFn);
    this.logger.debug('Health check registered', { metadata: { name } });
  }

  async runChecks(): Promise<HealthCheck[]> {
    const results: HealthCheck[] = [];

    for (const [name, checkFn] of this.checks) {
      try {
        const startTime = Date.now();
        const result = await checkFn();
        const duration = Date.now() - startTime;

        results.push({
          ...result,
          duration,
          timestamp: new Date(),
        });

        this.logger.recordMetric({
          name: `health_check.${name}`,
          value: result.status === 'healthy' ? 1 : 0,
          tags: { check: name, status: result.status },
        });
      } catch (error) {
        results.push({
          name,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        });

        this.logger.error(`Health check failed: ${name}`, error as Error);
      }
    }

    return results;
  }

  async getOverallHealth(): Promise<{
    status: 'healthy' | 'unhealthy' | 'degraded';
    checks: HealthCheck[];
  }> {
    const checks = await this.runChecks();

    const hasUnhealthy = checks.some(check => check.status === 'unhealthy');
    const hasDegraded = checks.some(check => check.status === 'degraded');

    let status: 'healthy' | 'unhealthy' | 'degraded';
    if (hasUnhealthy) {
      status = 'unhealthy';
    } else if (hasDegraded) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return { status, checks };
  }
}

// ============================================================================
// Express/Fastify Middleware Helpers
// ============================================================================

export function createRequestLogger(logger: AppLogger) {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || logger['generateTraceId']();

    req.requestId = requestId;
    req.logger = logger.child({ requestId });

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      logger.logApiRequest(req.method, req.url, res.statusCode, duration, { requestId });
    });

    next();
  };
}

export function createErrorLogger(logger: AppLogger) {
  return (error: Error, req: any, res: any, next: any) => {
    logger.error('Unhandled request error', error, {
      requestId: req.requestId,
      operation: `${req.method} ${req.url}`,
      metadata: {
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
      },
    });

    next(error);
  };
}
