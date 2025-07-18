import {
  AIProvider,
  AIProviderManager,
  AIOperation,
  AIResponse,
} from '../../../../shared/src/types';

/**
 * AI Provider Manager
 * Handles provider registration, selection, and failover logic with enhanced monitoring
 */
export class AIProviderManagerImpl implements AIProviderManager {
  private providers: Map<string, AIProvider> = new Map();
  private primaryProvider: string | null = null;
  private providerPriority: string[] = [];
  private circuitBreaker: Map<string, CircuitBreakerState> = new Map();
  private performanceMetrics: Map<string, ProviderMetrics> = new Map();
  private responseFormatters: Map<string, ResponseFormatter> = new Map();

  constructor() {
    // Initialize circuit breaker states
    this.resetCircuitBreakers();
    // Initialize response formatters
    this.initializeResponseFormatters();
  }

  /**
   * Register an AI provider
   */
  registerProvider(provider: AIProvider): void {
    this.providers.set(provider.name, provider);

    // Set first registered provider as primary if none set
    if (!this.primaryProvider) {
      this.primaryProvider = provider.name;
      this.providerPriority = [provider.name];
    } else if (!this.providerPriority.includes(provider.name)) {
      this.providerPriority.push(provider.name);
    }

    // Initialize circuit breaker for this provider
    this.circuitBreaker.set(provider.name, {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: null,
      nextRetryTime: null,
    });

    // Initialize performance metrics for this provider
    this.performanceMetrics.set(provider.name, {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      lastRequestTime: null,
      costPerRequest: 0,
      totalCost: 0,
      uptime: 100,
      lastHealthCheck: null,
    });

    console.log(`AI Provider registered: ${provider.name}`);
  }

  /**
   * Set provider priority order
   */
  setProviderPriority(priority: string[]): void {
    // Validate all providers exist
    for (const providerName of priority) {
      if (!this.providers.has(providerName)) {
        throw new Error(`Provider ${providerName} not registered`);
      }
    }

    this.providerPriority = [...priority];
    this.primaryProvider = priority[0] || null;
    console.log(`Provider priority set: ${priority.join(' -> ')}`);
  }

  /**
   * Get the next available provider based on priority and health
   */
  async getAvailableProvider(): Promise<AIProvider> {
    return this.getBestAvailableProvider();
  }

  /**
   * Execute operation with automatic failover and enhanced monitoring
   */
  async executeWithFailover(operation: AIOperation): Promise<AIResponse> {
    const maxRetries = operation.maxRetries || 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let provider: AIProvider;
      let startTime: number;

      try {
        provider = await this.getBestAvailableProvider();
        console.log(
          `Attempting operation with provider: ${provider.name} (attempt ${attempt + 1})`
        );

        startTime = Date.now();
        const response = await this.executeWithTimeout(
          () => provider.generateResponse(operation.prompt, operation.context),
          operation.timeout || 30000
        );

        const responseTime = Date.now() - startTime;
        const cost = provider.estimateCost(operation.prompt);

        // Record successful operation with metrics
        this.recordSuccessWithMetrics(provider.name, responseTime, cost);

        // Format and standardize response
        const formattedResponse = this.formatResponse(response, provider.name, operation.prompt);

        return formattedResponse;
      } catch (error: any) {
        lastError = error;
        console.error(`Operation failed on attempt ${attempt + 1}:`, error.message);

        // Record failure with metrics if provider was selected
        if (provider!) {
          const responseTime = Date.now() - startTime!;
          this.recordFailureWithMetrics(provider.name, responseTime);
        }

        // Don't retry on non-retryable errors
        if (!error.retryable) {
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('All AI providers failed');
  }

  /**
   * Get provider statistics
   */
  getProviderStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [name, provider] of this.providers) {
      const breakerState = this.circuitBreaker.get(name);
      stats[name] = {
        registered: true,
        circuitState: breakerState?.state || 'UNKNOWN',
        failureCount: breakerState?.failureCount || 0,
        lastFailure: breakerState?.lastFailureTime,
        nextRetry: breakerState?.nextRetryTime,
      };
    }

    return {
      providers: stats,
      priority: this.providerPriority,
      primary: this.primaryProvider,
    };
  }

  /**
   * Get enhanced provider statistics including performance metrics
   */
  getEnhancedProviderStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [name, provider] of this.providers) {
      const breakerState = this.circuitBreaker.get(name);
      const metrics = this.performanceMetrics.get(name);

      stats[name] = {
        registered: true,
        circuitState: breakerState?.state || 'UNKNOWN',
        failureCount: breakerState?.failureCount || 0,
        lastFailure: breakerState?.lastFailureTime,
        nextRetry: breakerState?.nextRetryTime,
        performance: {
          totalRequests: metrics?.totalRequests || 0,
          successRate: metrics?.totalRequests
            ? (metrics.successfulRequests / metrics.totalRequests) * 100
            : 0,
          averageResponseTime: metrics?.averageResponseTime || 0,
          uptime: metrics?.uptime || 100,
          totalCost: metrics?.totalCost || 0,
          costPerRequest: metrics?.costPerRequest || 0,
          lastRequest: metrics?.lastRequestTime,
          score: this.calculateProviderScore(name),
        },
      };
    }

    return {
      providers: stats,
      priority: this.providerPriority,
      primary: this.primaryProvider,
      totalProviders: this.providers.size,
      activeProviders: Array.from(this.providers.keys()).filter(name => {
        const breakerState = this.circuitBreaker.get(name);
        return !breakerState || !this.isCircuitOpen(breakerState);
      }).length,
    };
  }

  /**
   * Reset all circuit breakers
   */
  private resetCircuitBreakers(): void {
    for (const providerName of this.providers.keys()) {
      this.resetCircuitBreaker(providerName);
    }
  }

  /**
   * Reset circuit breaker for specific provider
   */
  private resetCircuitBreaker(providerName: string): void {
    this.circuitBreaker.set(providerName, {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: null,
      nextRetryTime: null,
    });
  }

  /**
   * Record successful operation
   */
  private recordSuccess(providerName: string): void {
    const state = this.circuitBreaker.get(providerName);
    if (state) {
      state.failureCount = 0;
      state.state = 'CLOSED';
      state.nextRetryTime = null;
    }
  }

  /**
   * Record failed operation
   */
  private recordFailure(providerName: string): void {
    const state = this.circuitBreaker.get(providerName);
    if (!state) return;

    state.failureCount++;
    state.lastFailureTime = new Date();

    // Open circuit after 3 failures
    if (state.failureCount >= 3) {
      state.state = 'OPEN';
      // Retry after exponential backoff (1min, 2min, 4min, max 10min)
      const backoffMinutes = Math.min(Math.pow(2, state.failureCount - 3), 10);
      state.nextRetryTime = new Date(Date.now() + backoffMinutes * 60 * 1000);
      console.log(`Circuit breaker OPENED for ${providerName}, retry in ${backoffMinutes} minutes`);
    }
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitOpen(state: CircuitBreakerState): boolean {
    if (state.state !== 'OPEN') return false;

    // Check if retry time has passed
    if (state.nextRetryTime && new Date() > state.nextRetryTime) {
      state.state = 'HALF_OPEN';
      return false;
    }

    return true;
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
      }),
    ]);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Initialize response formatters for different providers
   */
  private initializeResponseFormatters(): void {
    // Anthropic formatter
    this.responseFormatters.set('anthropic', {
      formatResponse: (response: AIResponse, originalPrompt: string): AIResponse => {
        return {
          ...response,
          confidence: this.normalizeConfidence(response, 'anthropic'),
          content: this.standardizeContent(response.content, 'anthropic'),
        };
      },
      validateResponse: (response: AIResponse): boolean => {
        return !!(response.content && response.content.length > 0 && response.confidence >= 0);
      },
      normalizeConfidence: (response: AIResponse): number => {
        // Anthropic typically provides high-quality responses, adjust confidence accordingly
        return Math.min(response.confidence * 1.1, 1.0);
      },
    });

    // OpenAI formatter
    this.responseFormatters.set('openai', {
      formatResponse: (response: AIResponse, originalPrompt: string): AIResponse => {
        return {
          ...response,
          confidence: this.normalizeConfidence(response, 'openai'),
          content: this.standardizeContent(response.content, 'openai'),
        };
      },
      validateResponse: (response: AIResponse): boolean => {
        return !!(response.content && response.content.length > 0 && response.confidence >= 0);
      },
      normalizeConfidence: (response: AIResponse): number => {
        // OpenAI confidence normalization
        return Math.max(response.confidence * 0.95, 0.1);
      },
    });
  }

  /**
   * Get the best available provider based on performance metrics and availability
   */
  private async getBestAvailableProvider(): Promise<AIProvider> {
    const availableProviders: Array<{ provider: AIProvider; score: number }> = [];

    for (const providerName of this.providerPriority) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      // Check circuit breaker
      const breakerState = this.circuitBreaker.get(providerName);
      if (breakerState && this.isCircuitOpen(breakerState)) {
        console.log(`Circuit breaker OPEN for ${providerName}, skipping`);
        continue;
      }

      // Check provider availability
      try {
        const isAvailable = await provider.isAvailable();
        if (isAvailable) {
          const score = this.calculateProviderScore(providerName);
          availableProviders.push({ provider, score });

          // Don't reset circuit breaker here - only reset on successful operations
          // The circuit breaker should remain open until a successful operation completes
        }
      } catch (error) {
        console.error(`Provider ${providerName} health check failed:`, error);
        this.recordFailure(providerName);
      }
    }

    if (availableProviders.length === 0) {
      throw new Error('No AI providers available');
    }

    // Sort by score (higher is better) and return the best provider
    availableProviders.sort((a, b) => b.score - a.score);
    const bestProvider = availableProviders[0].provider;

    console.log(
      `Selected best provider: ${bestProvider.name} (score: ${availableProviders[0].score.toFixed(2)})`
    );
    return bestProvider;
  }

  /**
   * Calculate provider performance score
   */
  private calculateProviderScore(providerName: string): number {
    const metrics = this.performanceMetrics.get(providerName);
    if (!metrics || metrics.totalRequests === 0) {
      // New provider gets neutral score
      return 0.5;
    }

    const successRate = metrics.successfulRequests / metrics.totalRequests;
    const avgResponseTime = metrics.averageResponseTime;
    const costEfficiency = metrics.costPerRequest > 0 ? 1 / metrics.costPerRequest : 1;
    const uptime = metrics.uptime / 100;

    // Weighted score calculation
    const score =
      successRate * 0.4 + // 40% weight on success rate
      uptime * 0.3 + // 30% weight on uptime
      (1 / (avgResponseTime / 1000 + 1)) * 0.2 + // 20% weight on response time (inverted)
      Math.min(costEfficiency, 1) * 0.1; // 10% weight on cost efficiency

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Record successful operation with detailed metrics
   */
  private recordSuccessWithMetrics(providerName: string, responseTime: number, cost: number): void {
    // Update circuit breaker
    this.recordSuccess(providerName);

    // Update performance metrics
    const metrics = this.performanceMetrics.get(providerName);
    if (metrics) {
      metrics.totalRequests++;
      metrics.successfulRequests++;
      metrics.totalResponseTime += responseTime;
      metrics.averageResponseTime = metrics.totalResponseTime / metrics.totalRequests;
      metrics.lastRequestTime = new Date();
      metrics.totalCost += cost;
      metrics.costPerRequest = metrics.totalCost / metrics.totalRequests;

      // Update uptime (simple calculation based on recent success)
      const recentSuccessRate = metrics.successfulRequests / metrics.totalRequests;
      metrics.uptime = recentSuccessRate * 100;
    }
  }

  /**
   * Record failed operation with detailed metrics
   */
  private recordFailureWithMetrics(providerName: string, responseTime: number): void {
    // Update circuit breaker
    this.recordFailure(providerName);

    // Update performance metrics
    const metrics = this.performanceMetrics.get(providerName);
    if (metrics) {
      metrics.totalRequests++;
      metrics.failedRequests++;
      metrics.totalResponseTime += responseTime;
      metrics.averageResponseTime = metrics.totalResponseTime / metrics.totalRequests;
      metrics.lastRequestTime = new Date();

      // Update uptime
      const recentSuccessRate = metrics.successfulRequests / metrics.totalRequests;
      metrics.uptime = recentSuccessRate * 100;
    }
  }

  /**
   * Format response using provider-specific formatter
   */
  private formatResponse(
    response: AIResponse,
    providerName: string,
    originalPrompt: string
  ): AIResponse {
    const formatter = this.responseFormatters.get(providerName);
    if (!formatter) {
      console.warn(`No formatter found for provider ${providerName}, using default formatting`);
      return response;
    }

    try {
      const formattedResponse = formatter.formatResponse(response, originalPrompt);

      // Validate the formatted response
      if (!formatter.validateResponse(formattedResponse)) {
        console.warn(`Response validation failed for provider ${providerName}`);
        return response; // Return original if validation fails
      }

      return formattedResponse;
    } catch (error) {
      console.error(`Error formatting response for provider ${providerName}:`, error);
      return response; // Return original on error
    }
  }

  /**
   * Normalize confidence score for a specific provider
   */
  private normalizeConfidence(response: AIResponse, providerName: string): number {
    const formatter = this.responseFormatters.get(providerName);
    if (formatter) {
      return formatter.normalizeConfidence(response);
    }
    return response.confidence;
  }

  /**
   * Standardize content format across providers
   */
  private standardizeContent(content: string, providerName: string): string {
    // Remove provider-specific formatting artifacts
    let standardized = content.trim();

    // Remove common AI provider prefixes/suffixes
    standardized = standardized.replace(/^(Assistant:|AI:|Claude:|GPT:)\s*/i, '');
    standardized = standardized.replace(
      /\s*(--\s*Assistant|--\s*AI|--\s*Claude|--\s*GPT)\s*$/i,
      ''
    );

    // Normalize line endings
    standardized = standardized.replace(/\r\n/g, '\n');

    // Ensure consistent paragraph spacing
    standardized = standardized.replace(/\n{3,}/g, '\n\n');

    return standardized;
  }
}

/**
 * Circuit breaker state interface
 */
interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: Date | null;
  nextRetryTime: Date | null;
}

/**
 * Provider performance metrics interface
 */
interface ProviderMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalResponseTime: number;
  lastRequestTime: Date | null;
  costPerRequest: number;
  totalCost: number;
  uptime: number; // percentage
  lastHealthCheck: Date | null;
}

/**
 * Response formatter interface for standardizing responses across providers
 */
interface ResponseFormatter {
  formatResponse(response: AIResponse, originalPrompt: string): AIResponse;
  validateResponse(response: AIResponse): boolean;
  normalizeConfidence(response: AIResponse): number;
}
