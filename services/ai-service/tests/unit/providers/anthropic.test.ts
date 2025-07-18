import { AnthropicProvider } from '../../../src/providers/anthropic';

// Mock Anthropic SDK
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  }));
});

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new AnthropicProvider('test-api-key');
  });

  describe('generateResponse', () => {
    it('should generate response successfully', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Test response content' }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        },
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await provider.generateResponse('Test prompt', {});

      expect(result).toEqual({
        content: 'Test response content',
        confidence: expect.any(Number),
        provider: 'anthropic',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        cached: false,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        temperature: 0.7,
        system: expect.any(String),
        messages: [
          {
            role: 'user',
            content: expect.any(String),
          },
        ],
      });
    });

    it('should handle rate limit errors', async () => {
      const error = new Error('Rate limit exceeded') as any;
      error.status = 429;
      mockCreate.mockRejectedValue(error);

      await expect(provider.generateResponse('Test prompt', {})).rejects.toThrow(
        'Rate limit exceeded'
      );
    });

    it('should handle authentication errors', async () => {
      const error = new Error('Invalid API key') as any;
      error.status = 401;
      mockCreate.mockRejectedValue(error);

      await expect(provider.generateResponse('Test prompt', {})).rejects.toThrow('Invalid API key');
    });

    it('should handle service errors', async () => {
      const error = new Error('Service unavailable') as any;
      error.status = 500;
      mockCreate.mockRejectedValue(error);

      await expect(provider.generateResponse('Test prompt', {})).rejects.toThrow(
        'Anthropic service unavailable'
      );
    });

    it('should use custom parameters from context', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Test response' }],
        usage: { input_tokens: 50, output_tokens: 25 },
      };

      mockCreate.mockResolvedValue(mockResponse);

      const context = {
        maxTokens: 2000,
        temperature: 0.5,
        userProfile: {
          tradingExperience: 'BEGINNER',
          riskTolerance: 'CONSERVATIVE',
          availableBudget: 1000000,
        },
      };

      await provider.generateResponse('Test prompt', context);

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        temperature: 0.5,
        system: expect.stringContaining('BEGINNER'),
        messages: expect.any(Array),
      });
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost correctly', () => {
      const prompt = 'A'.repeat(1000); // 1000 characters ≈ 250 tokens
      const cost = provider.estimateCost(prompt);

      // Expected: 250 input tokens + 125 output tokens
      // Cost: (250/1M * $3) + (125/1M * $15) = $0.00075 + $0.001875 = $0.002625
      expect(cost).toBeCloseTo(0.002625, 6);
    });

    it('should handle empty prompt', () => {
      const cost = provider.estimateCost('');
      expect(cost).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isAvailable', () => {
    it('should return true when health check passes', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'OK' }],
        usage: { input_tokens: 5, output_tokens: 2 },
      };

      mockCreate.mockResolvedValue(mockResponse);

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(true);
    });

    it('should return false when health check fails', async () => {
      mockCreate.mockRejectedValue(new Error('Health check failed'));

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(false);
    });

    it('should cache health check results', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'OK' }],
        usage: { input_tokens: 5, output_tokens: 2 },
      };

      mockCreate.mockResolvedValue(mockResponse);

      // First call
      await provider.isAvailable();
      // Second call (should use cache)
      await provider.isAvailable();

      // Should only call the API once due to caching
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('name property', () => {
    it('should return correct provider name', () => {
      expect(provider.name).toBe('anthropic');
    });
  });
});
