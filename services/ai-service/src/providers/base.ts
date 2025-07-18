import { AIProvider, AIResponse, AIOperation } from '../../../../shared/src/types';

/**
 * Base abstract class for AI providers
 * Provides common functionality and enforces interface compliance
 */
export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: string;
  protected abstract apiKey: string;
  protected baseUrl?: string;

  // Health check properties
  private lastHealthCheck: Date | null = null;
  private healthCheckInterval = 5 * 60 * 1000; // 5 minutes
  private isHealthy = true;

  /**
   * Check if the provider is available and healthy
   */
  async isAvailable(): Promise<boolean> {
    const now = new Date();

    // Use cached health status if recent
    if (
      this.lastHealthCheck &&
      now.getTime() - this.lastHealthCheck.getTime() < this.healthCheckInterval
    ) {
      return this.isHealthy;
    }

    try {
      await this.performHealthCheck();
      this.isHealthy = true;
      this.lastHealthCheck = now;
      return true;
    } catch (error) {
      console.error(`Health check failed for ${this.name}:`, error);
      this.isHealthy = false;
      this.lastHealthCheck = now;
      return false;
    }
  }

  /**
   * Generate AI response with provider-specific implementation
   */
  abstract generateResponse(prompt: string, context: any): Promise<AIResponse>;

  /**
   * Estimate cost for a given prompt
   */
  abstract estimateCost(prompt: string): number;

  /**
   * Perform provider-specific health check
   */
  protected abstract performHealthCheck(): Promise<void>;

  /**
   * Get provider configuration
   */
  protected getConfig() {
    return {
      name: this.name,
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      timeout: 30000, // 30 seconds default timeout
      maxRetries: 3,
    };
  }

  /**
   * Calculate token count estimate (rough approximation)
   */
  protected estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Create standardized error response
   */
  protected createError(message: string, code: string, retryable = false): Error {
    const error = new Error(message) as any;
    error.provider = this.name;
    error.code = code;
    error.retryable = retryable;
    return error;
  }
}
