import {
  AIProvider,
  AIProviderManager,
  AIOperation,
  AIResponse,
} from '../../../../shared/src/types';

/**
 * AI Provider Manager
 * Handles provider registration, selection, and failover logic
 */
export class AIProviderManagerImpl implements AIProviderManager {
  private providers: Map<string, AIProvider> = new Map();
  private primaryProvider: string | null = null;
  private providerPriority: string[] = [];
  private circuitBreaker: Map<string, CircuitBreakerState> = new Map();

  constructor() {
    // Initialize circuit breaker states
    this.resetCircuitBreakers();
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
          // Reset circuit breaker on successful health check
          this.resetCircuitBreaker(providerName);
          return provider;
        }
      } catch (error) {
        console.error(`Provider ${providerName} health check failed:`, error);
        this.recordFailure(providerName);
      }
    }

    throw new Error('No AI providers available');
  }

  /**
   * Execute operation with automatic failover
   */
  async executeWithFailover(operation: AIOperation): Promise<AIResponse> {
    const maxRetries = operation.maxRetries || 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const provider = await this.getAvailableProvider();
        console.log(
          `Attempting operation with provider: ${provider.name} (attempt ${attempt + 1})`
        );

        const response = await this.executeWithTimeout(
          () => provider.generateResponse(operation.prompt, operation.context),
          operation.timeout || 30000
        );

        // Mark successful operation
        this.recordSuccess(provider.name);
        return response;
      } catch (error: any) {
        lastError = error;
        console.error(`Operation failed on attempt ${attempt + 1}:`, error.message);

        // Record failure for circuit breaker
        if (error.provider) {
          this.recordFailure(error.provider);
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
