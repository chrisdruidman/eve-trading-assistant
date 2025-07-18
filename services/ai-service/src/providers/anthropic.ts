import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider } from './base';
import { AIResponse } from '../../../../shared/src/types';

/**
 * Anthropic Claude AI Provider
 * Primary AI provider for the EVE Trading Assistant
 */
export class AnthropicProvider extends BaseAIProvider {
  readonly name = 'anthropic';
  protected apiKey: string;
  protected override baseUrl?: string;
  private client: Anthropic;
  private model = 'claude-3-5-sonnet-20241022';

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
    this.client = new Anthropic({
      apiKey: this.apiKey,
    });
  }

  /**
   * Generate response using Anthropic Claude
   */
  async generateResponse(prompt: string, context: any = {}): Promise<AIResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const userPrompt = this.buildUserPrompt(prompt, context);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: context.maxTokens || 8000,
        temperature: context.temperature || 0.7,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw this.createError('Unexpected response format from Anthropic', 'INVALID_RESPONSE');
      }

      return {
        content: content.text,
        confidence: this.calculateConfidence(response),
        provider: this.name,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        cached: false,
      };
    } catch (error: any) {
      if (error.status === 429) {
        throw this.createError('Rate limit exceeded', 'RATE_LIMIT', true);
      } else if (error.status === 401) {
        throw this.createError('Invalid API key', 'AUTH_ERROR', false);
      } else if (error.status >= 500) {
        throw this.createError('Anthropic service unavailable', 'SERVICE_ERROR', true);
      } else {
        throw this.createError(`Anthropic API error: ${error.message}`, 'API_ERROR', false);
      }
    }
  }

  /**
   * Estimate cost for Anthropic API call
   * Based on Claude Sonnet 4 pricing: $3/1M input tokens, $15/1M output tokens
   */
  estimateCost(prompt: string): number {
    const inputTokens = this.estimateTokens(prompt);
    const estimatedOutputTokens = Math.min(inputTokens * 0.5, 8000); // Estimate output as 50% of input, max 8000 (increased for Sonnet 4)

    const inputCost = (inputTokens / 1000000) * 3; // $3 per 1M tokens
    const outputCost = (estimatedOutputTokens / 1000000) * 15; // $15 per 1M tokens

    return inputCost + outputCost;
  }

  /**
   * Perform health check by making a simple API call
   */
  protected async performHealthCheck(): Promise<void> {
    try {
      await this.client.messages.create({
        model: this.model,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Health check',
          },
        ],
      });
    } catch (error: any) {
      throw new Error(`Anthropic health check failed: ${error.message}`);
    }
  }

  /**
   * Build system prompt for EVE Online trading context
   */
  private buildSystemPrompt(context: any): string {
    const basePrompt = `You are an expert EVE Online trading assistant with deep knowledge of market mechanics, trading strategies, and risk management. You provide accurate, actionable trading advice based on market data analysis.

Key principles:
- Always consider risk vs reward in trading suggestions
- Factor in market volatility and liquidity
- Provide clear reasoning for recommendations
- Consider the user's budget and risk tolerance
- Be aware of EVE Online's unique market mechanics (regional markets, player-driven economy)`;

    if (context.userProfile) {
      const profile = context.userProfile;
      return `${basePrompt}

User Context:
- Experience Level: ${profile.tradingExperience || 'Unknown'}
- Risk Tolerance: ${profile.riskTolerance || 'MODERATE'}
- Available Budget: ${profile.availableBudget ? `${profile.availableBudget.toLocaleString()} ISK` : 'Not specified'}
- Preferred Regions: ${profile.preferredMarkets?.join(', ') || 'All regions'}`;
    }

    return basePrompt;
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(prompt: string, context: any): string {
    let fullPrompt = prompt;

    if (context.marketData) {
      fullPrompt += `\n\nMarket Data Context:\n${JSON.stringify(context.marketData, null, 2)}`;
    }

    if (context.analysisType) {
      fullPrompt += `\n\nAnalysis Type: ${context.analysisType}`;
    }

    return fullPrompt;
  }

  /**
   * Calculate confidence score based on response characteristics
   */
  private calculateConfidence(response: any): number {
    // Base confidence
    let confidence = 0.8;

    // Adjust based on response length (longer responses often more detailed)
    const content = response.content[0]?.text || '';
    if (content.length > 500) confidence += 0.1;
    if (content.length < 100) confidence -= 0.2;

    // Adjust based on token usage efficiency
    const efficiency = response.usage.output_tokens / response.usage.input_tokens;
    if (efficiency > 0.5) confidence += 0.05;
    if (efficiency < 0.1) confidence -= 0.1;

    return Math.max(0.1, Math.min(1.0, confidence));
  }
}
