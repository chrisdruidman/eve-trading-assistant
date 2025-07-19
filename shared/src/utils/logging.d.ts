import pino from 'pino';
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
    logs?: Array<{
        timestamp: Date;
        message: string;
        level: string;
    }>;
}
export declare function createLogger(config: LoggerConfig): pino.Logger;
export declare class AppLogger {
    private logger;
    private metrics;
    private traces;
    constructor(config: LoggerConfig);
    trace(message: string, context?: LogContext): void;
    debug(message: string, context?: LogContext): void;
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, error?: Error, context?: LogContext): void;
    fatal(message: string, error?: Error, context?: LogContext): void;
    logApiRequest(method: string, url: string, statusCode: number, duration: number, context?: LogContext): void;
    logDatabaseQuery(query: string, duration: number, rowCount?: number, context?: LogContext): void;
    logExternalApiCall(service: string, endpoint: string, statusCode: number, duration: number, context?: LogContext): void;
    logCacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete', key: string, context?: LogContext): void;
    logUserAction(userId: string, action: string, resource?: string, context?: LogContext): void;
    logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', context?: LogContext): void;
    recordMetric(metric: MetricData): void;
    recordCounter(name: string, value?: number, tags?: Record<string, string>): void;
    recordGauge(name: string, value: number, tags?: Record<string, string>): void;
    recordTimer(name: string, duration: number, tags?: Record<string, string>): void;
    startTrace(traceId: string, operation: string, parentSpanId?: string): string;
    finishTrace(spanId: string, status?: 'success' | 'error', tags?: Record<string, string>): void;
    addTraceLog(spanId: string, message: string, level?: string): void;
    measureAsync<T>(operation: string, fn: () => Promise<T>, context?: LogContext): Promise<T>;
    measureSync<T>(operation: string, fn: () => T, context?: LogContext): T;
    getMetrics(): MetricData[];
    clearMetrics(): void;
    child(bindings: Record<string, any>): AppLogger;
    private formatLogEntry;
    private generateTraceId;
    private generateSpanId;
}
export declare function initializeLogger(config: LoggerConfig): AppLogger;
export declare function getLogger(): AppLogger;
export interface HealthCheck {
    name: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    message?: string;
    duration?: number;
    timestamp: Date;
}
export declare class HealthMonitor {
    private checks;
    private logger;
    constructor(logger: AppLogger);
    registerCheck(name: string, checkFn: () => Promise<HealthCheck>): void;
    runChecks(): Promise<HealthCheck[]>;
    getOverallHealth(): Promise<{
        status: 'healthy' | 'unhealthy' | 'degraded';
        checks: HealthCheck[];
    }>;
}
export declare function createRequestLogger(logger: AppLogger): (req: any, res: any, next: any) => void;
export declare function createErrorLogger(logger: AppLogger): (error: Error, req: any, res: any, next: any) => void;
//# sourceMappingURL=logging.d.ts.map