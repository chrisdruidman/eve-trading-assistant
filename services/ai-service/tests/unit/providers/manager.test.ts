import { AIProviderManagerImpl } from '../../../src/providers/manager';
import { AIProvider, AIResponse } from '../../../../../shared/src/types';

// Mock provider for testing
class MockProvider implements AIProvider {
  public shouldFail: boolean;

  constructor(
    public name: string,
    shouldFail = false,
    private isHealthy = true
  ) {
    this.shouldFail = shouldFail;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isHealthy) throw new Error('Health check failed');
    return this.isHealthy;
  }

  async generateResponse(prompt: string, context: any): Promise<AIResponse> {
    if (this.shouldFail) {
      const error = new Error('Provider failed') as any;
      error.provider = this.name;
      error.retryable = true;
      throw error;
    }

    return {
      content: `Response from ${this.name}: ${prompt}`,
      confidence: 0.8,
      provider: this.name,
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      cached: false,
    };
  }

  estimateCost(prompt: string): number {
    return 0.01;
  }
}

describe('AIProviderManagerImpl', () => {
  let manager: AIProviderManagerImpl;
  let mockProvider1: MockProvider;
  let mockProvider2: MockProvider;

  beforeEach(() => {
    manager = new AIProviderManagerImpl();
    mockProvider1 = new MockProvider('provider1');
    mockProvider2 = new MockProvider('provider2');
  });

  describe('registerProvider', () => {
    it('should register a provider successfully', () => {
      manager.registerProvider(mockProvider1);

      const stats = manager.getProviderStats();
      expect(stats.providers.provider1).toBeDefined();
      expect(stats.providers.provider1.registered).toBe(true);
      expect(stats.primary).toBe('provider1');
    });

    it('should set provider priority correctly', () => {
      manager.registerProvider(mockProvider1);
      manager.registerProvider(mockProvider2);

      const stats = manager.getProviderStats();
      expect(stats.priority).toEqual(['provider1', 'provider2']);
      expect(stats.primary).toBe('provider1');
    });
  });

  describe('setProviderPriority', () => {
    beforeEach(() => {
      manager.registerProvider(mockProvider1);
      manager.registerProvider(mockProvider2);
    });

    it('should set custom priority order', () => {
      manager.setProviderPriority(['provider2', 'provider1']);

      const stats = manager.getProviderStats();
      expect(stats.priority).toEqual(['provider2', 'provider1']);
      expect(stats.primary).toBe('provider2');
    });

    it('should throw error for unregistered provider', () => {
      expect(() => {
        manager.setProviderPriority(['nonexistent']);
      }).toThrow('Provider nonexistent not registered');
    });
  });

  describe('getAvailableProvider', () => {
    beforeEach(() => {
      manager.registerProvider(mockProvider1);
      manager.registerProvider(mockProvider2);
    });

    it('should return first available provider', async () => {
      const provider = await manager.getAvailableProvider();
      expect(provider.name).toBe('provider1');
    });

    it('should skip unhealthy providers', async () => {
      const unhealthyProvider = new MockProvider('unhealthy', false, false);
      manager.registerProvider(unhealthyProvider);
      manager.setProviderPriority(['unhealthy', 'provider1', 'provider2']);

      const provider = await manager.getAvailableProvider();
      expect(provider.name).toBe('provider1');
    });

    it('should throw error when no providers available', async () => {
      const unhealthyProvider1 = new MockProvider('unhealthy1', false, false);
      const unhealthyProvider2 = new MockProvider('unhealthy2', false, false);

      const emptyManager = new AIProviderManagerImpl();
      emptyManager.registerProvider(unhealthyProvider1);
      emptyManager.registerProvider(unhealthyProvider2);

      await expect(emptyManager.getAvailableProvider()).rejects.toThrow(
        'No AI providers available'
      );
    });
  });

  describe('executeWithFailover', () => {
    beforeEach(() => {
      manager.registerProvider(mockProvider1);
      manager.registerProvider(mockProvider2);
    });

    it('should execute successfully with first provider', async () => {
      const operation = {
        prompt: 'Test prompt',
        context: {},
      };

      const response = await manager.executeWithFailover(operation);

      expect(response.content).toContain('Response from provider1');
      expect(response.provider).toBe('provider1');
    });

    it('should failover to second provider when first fails', async () => {
      const failingProvider = new MockProvider('failing', true);
      manager.registerProvider(failingProvider);
      manager.setProviderPriority(['failing', 'provider1', 'provider2']);

      const operation = {
        prompt: 'Test prompt',
        context: {},
      };

      const response = await manager.executeWithFailover(operation);

      expect(response.content).toContain('Response from provider1');
      expect(response.provider).toBe('provider1');
    });

    it('should respect maxRetries parameter', async () => {
      const failingProvider1 = new MockProvider('failing1', true);
      const failingProvider2 = new MockProvider('failing2', true);

      const failManager = new AIProviderManagerImpl();
      failManager.registerProvider(failingProvider1);
      failManager.registerProvider(failingProvider2);

      const operation = {
        prompt: 'Test prompt',
        context: {},
        maxRetries: 2,
      };

      await expect(failManager.executeWithFailover(operation)).rejects.toThrow('Provider failed');
    });

    it('should not retry on non-retryable errors', async () => {
      const nonRetryableProvider = new MockProvider('nonretryable');
      // Override to throw non-retryable error
      nonRetryableProvider.generateResponse = async () => {
        const error = new Error('Non-retryable error') as any;
        error.provider = 'nonretryable';
        error.retryable = false;
        throw error;
      };

      const failManager = new AIProviderManagerImpl();
      failManager.registerProvider(nonRetryableProvider);

      const operation = {
        prompt: 'Test prompt',
        context: {},
        maxRetries: 3,
      };

      await expect(failManager.executeWithFailover(operation)).rejects.toThrow(
        'Non-retryable error'
      );
    });
  });

  describe('circuit breaker', () => {
    beforeEach(() => {
      manager.registerProvider(mockProvider1);
      manager.registerProvider(mockProvider2);
    });

    it('should open circuit after multiple failures', async () => {
      const failingProvider = new MockProvider('failing', true);
      manager.registerProvider(failingProvider);
      manager.setProviderPriority(['failing', 'provider1']);

      // Cause 3 failures to open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await manager.executeWithFailover({
            prompt: 'Test',
            context: {},
            maxRetries: 1,
          });
        } catch (error) {
          // Expected to fail
        }
      }

      const stats = manager.getProviderStats();
      expect(stats.providers.failing.circuitState).toBe('OPEN');
      expect(stats.providers.failing.failureCount).toBe(3);
    });

    it('should reset circuit on successful operation', async () => {
      // First make provider fail to increment failure count
      const intermittentProvider = new MockProvider('intermittent', true);
      manager.registerProvider(intermittentProvider);
      manager.setProviderPriority(['intermittent', 'provider1']);

      // Cause failure
      try {
        await manager.executeWithFailover({
          prompt: 'Test',
          context: {},
          maxRetries: 1,
        });
      } catch (error) {
        // Expected
      }

      // Now make it succeed
      intermittentProvider.shouldFail = false;

      await manager.executeWithFailover({
        prompt: 'Test',
        context: {},
      });

      const stats = manager.getProviderStats();
      expect(stats.providers.intermittent.failureCount).toBe(0);
      expect(stats.providers.intermittent.circuitState).toBe('CLOSED');
    });
  });

  describe('getProviderStats', () => {
    it('should return comprehensive provider statistics', () => {
      manager.registerProvider(mockProvider1);
      manager.registerProvider(mockProvider2);
      manager.setProviderPriority(['provider2', 'provider1']);

      const stats = manager.getProviderStats();

      expect(stats).toEqual({
        providers: {
          provider1: {
            registered: true,
            circuitState: 'CLOSED',
            failureCount: 0,
            lastFailure: null,
            nextRetry: null,
          },
          provider2: {
            registered: true,
            circuitState: 'CLOSED',
            failureCount: 0,
            lastFailure: null,
            nextRetry: null,
          },
        },
        priority: ['provider2', 'provider1'],
        primary: 'provider2',
      });
    });
  });
});
