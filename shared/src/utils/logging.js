"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthMonitor = exports.AppLogger = void 0;
exports.createLogger = createLogger;
exports.initializeLogger = initializeLogger;
exports.getLogger = getLogger;
exports.createRequestLogger = createRequestLogger;
exports.createErrorLogger = createErrorLogger;
const pino_1 = __importDefault(require("pino"));
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
function createLogger(config) {
    const pinoConfig = {
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
        timestamp: pino_1.default.stdTimeFunctions.isoTime,
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
    return (0, pino_1.default)(pinoConfig);
}
class AppLogger {
    constructor(config) {
        this.metrics = [];
        this.traces = new Map();
        this.logger = createLogger(config);
    }
    trace(message, context) {
        this.logger.trace(this.formatLogEntry(message, context));
    }
    debug(message, context) {
        this.logger.debug(this.formatLogEntry(message, context));
    }
    info(message, context) {
        this.logger.info(this.formatLogEntry(message, context));
    }
    warn(message, context) {
        this.logger.warn(this.formatLogEntry(message, context));
    }
    error(message, error, context) {
        const logEntry = this.formatLogEntry(message, context);
        if (error) {
            logEntry.error = error;
        }
        this.logger.error(logEntry);
    }
    fatal(message, error, context) {
        const logEntry = this.formatLogEntry(message, context);
        if (error) {
            logEntry.error = error;
        }
        this.logger.fatal(logEntry);
    }
    logApiRequest(method, url, statusCode, duration, context) {
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
    logDatabaseQuery(query, duration, rowCount, context) {
        this.debug('Database Query', {
            ...context,
            operation: 'database_query',
            duration,
            metadata: {
                query: query.substring(0, 200),
                duration,
                rowCount,
            },
        });
    }
    logExternalApiCall(service, endpoint, statusCode, duration, context) {
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
    logCacheOperation(operation, key, context) {
        this.debug('Cache Operation', {
            ...context,
            operation: `cache_${operation}`,
            metadata: {
                operation,
                key: key.substring(0, 100),
            },
        });
    }
    logUserAction(userId, action, resource, context) {
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
    logSecurityEvent(event, severity, context) {
        const logMethod = severity === 'critical' ? this.error : severity === 'high' ? this.warn : this.info;
        logMethod.call(this, `Security Event: ${event}`, undefined, {
            ...context,
            operation: 'security_event',
            metadata: {
                event,
                severity,
            },
        });
    }
    recordMetric(metric) {
        this.metrics.push({
            ...metric,
            timestamp: metric.timestamp || new Date(),
        });
        this.debug('Metric Recorded', {
            operation: 'metric_collection',
            metadata: metric,
        });
    }
    recordCounter(name, value = 1, tags) {
        this.recordMetric({
            name,
            value,
            unit: 'count',
            tags,
        });
    }
    recordGauge(name, value, tags) {
        this.recordMetric({
            name,
            value,
            unit: 'gauge',
            tags,
        });
    }
    recordTimer(name, duration, tags) {
        this.recordMetric({
            name,
            value: duration,
            unit: 'milliseconds',
            tags,
        });
    }
    startTrace(traceId, operation, parentSpanId) {
        const spanId = this.generateSpanId();
        const trace = {
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
    finishTrace(spanId, status = 'success', tags) {
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
        this.recordTimer(`trace.${trace.operation}`, trace.duration, {
            status,
            ...tags,
        });
        this.traces.delete(spanId);
    }
    addTraceLog(spanId, message, level = 'info') {
        const trace = this.traces.get(spanId);
        if (trace) {
            trace.logs?.push({
                timestamp: new Date(),
                message,
                level,
            });
        }
    }
    async measureAsync(operation, fn, context) {
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
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.finishTrace(spanId, 'error');
            this.recordTimer(`operation.${operation}`, duration, { status: 'error' });
            this.error(`Operation failed: ${operation}`, error, {
                ...context,
                operation,
                duration,
            });
            throw error;
        }
    }
    measureSync(operation, fn, context) {
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
        }
        catch (error) {
            const duration = Date.now() - startTime;
            this.recordTimer(`operation.${operation}`, duration, { status: 'error' });
            this.error(`Operation failed: ${operation}`, error, {
                ...context,
                operation,
                duration,
            });
            throw error;
        }
    }
    getMetrics() {
        return [...this.metrics];
    }
    clearMetrics() {
        this.metrics = [];
    }
    child(bindings) {
        const childLogger = new AppLogger({
            level: this.logger.level,
            service: 'child',
            environment: 'unknown',
        });
        childLogger.logger = this.logger.child(bindings);
        return childLogger;
    }
    formatLogEntry(message, context) {
        const entry = { msg: message };
        if (context) {
            if (context.requestId)
                entry.requestId = context.requestId;
            if (context.userId)
                entry.userId = context.userId;
            if (context.operation)
                entry.operation = context.operation;
            if (context.duration !== undefined)
                entry.duration = context.duration;
            if (context.metadata)
                entry.metadata = context.metadata;
        }
        return entry;
    }
    generateTraceId() {
        return (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));
    }
    generateSpanId() {
        return Math.random().toString(36).substring(2, 10);
    }
}
exports.AppLogger = AppLogger;
let globalLogger = null;
function initializeLogger(config) {
    globalLogger = new AppLogger(config);
    return globalLogger;
}
function getLogger() {
    if (!globalLogger) {
        globalLogger = new AppLogger({
            level: 'info',
            service: 'eve-trading-assistant',
            environment: process.env.NODE_ENV || 'development',
            prettyPrint: process.env.NODE_ENV === 'development',
        });
    }
    return globalLogger;
}
class HealthMonitor {
    constructor(logger) {
        this.checks = new Map();
        this.logger = logger;
    }
    registerCheck(name, checkFn) {
        this.checks.set(name, checkFn);
        this.logger.debug('Health check registered', { metadata: { name } });
    }
    async runChecks() {
        const results = [];
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
            }
            catch (error) {
                results.push({
                    name,
                    status: 'unhealthy',
                    message: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date(),
                });
                this.logger.error(`Health check failed: ${name}`, error);
            }
        }
        return results;
    }
    async getOverallHealth() {
        const checks = await this.runChecks();
        const hasUnhealthy = checks.some(check => check.status === 'unhealthy');
        const hasDegraded = checks.some(check => check.status === 'degraded');
        let status;
        if (hasUnhealthy) {
            status = 'unhealthy';
        }
        else if (hasDegraded) {
            status = 'degraded';
        }
        else {
            status = 'healthy';
        }
        return { status, checks };
    }
}
exports.HealthMonitor = HealthMonitor;
function createRequestLogger(logger) {
    return (req, res, next) => {
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
function createErrorLogger(logger) {
    return (error, req, res, next) => {
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
//# sourceMappingURL=logging.js.map