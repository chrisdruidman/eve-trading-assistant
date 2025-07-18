import OpenAI from 'openai';
import { BaseAIProvider } from './base';
import { AIResponse } from '../../../../shared/src/types';

/**
 * OpenAI GPT Provider
 * Secondary AI provider for failover scenarios
 */
export class OpenAIProvider extends BaseAIProvider {
  readonly name = 'openai';
  protected apiKey: string;
  protected override baseUrl?: string;
  private client: OpenAI;
  private model = 'gpt-4-turbo-preview';

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
    this.client = new OpenAI({
      apiKey: this.apiKey,
    });
  }

  /**
   * Generate response using OpenAI GPT
   */
  async generateResponse(prompt: string, context: any = {}): Promise<AIResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const userPrompt = this.buildUserPrompt(prompt, context);

      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: context.maxTokens || 4000,
        temperature: context.temperature || 0.7,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const choice = response.choices[0];
      if (!choice?.message?.content) {
        throw this.createError('No content in OpenAI response', 'INVALID_RESPONSE');
      }

      return {
        content: choice.message.content,
        confidence: this.calculateConfidence(response),
        provider: this.name,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        cached: false,
      };
    } catch (error: any) {
      if (error.status === 429) {
        throw this.createError('Rate limit exceeded', 'RATE_LIMIT', true);
      } else if (error.status === 401) {
        throw this.createError('Invalid API key', 'AUTH_ERROR', false);
      } else if (error.status >= 500) {
        throw this.createError('OpenAI service unavailable', 'SERVICE_ERROR', true);
      } else {
        throw this.createError(`OpenAI API error: ${error.message}`, 'API_ERROR', false);
      }
    }
  }

  /**
   * Estimate cost for OpenAI API call
   * Based on GPT-4 Turbo pricing: $10/1M input tokens, $30/1M output tokens
   */
  estimateCost(prompt: string): number {
    const inputTokens = this.estimateTokens(prompt);
    const estimatedOutputTokens = Math.min(inputTokens * 0.5, 4000); // Estimate output as 50% of input, max 4000

    const inputCost = (inputTokens / 1000000) * 10; // $10 per 1M tokens
    const outputCost = (estimatedOutputTokens / 1000000) * 30; // $30 per 1M tokens

    return inputCost + outputCost;
  }

  /**
   * Perform health check by making a simple API call
   */
  protected async performHealthCheck(): Promise<void> {
    try {
      await this.client.chat.completions.create({
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
      throw new Error(`OpenAI health check failed: ${error.message}`);
    }
  }

  /**
   * Build system prompt for EVE Online trading context
   */
  private buildSystemPrompt(context: any): string {
    const basePrompt = `You are an expert EVE Online trading assistant with comprehensive knowledge of market mechanics, trading strategies, and risk management. You analyze market data and provide actionable trading advice.

Core expertise:
- EVE Online market dynamics and regional variations
- Risk assessment and portfolio management
- Profit optimization strategies
- Market trend analysis and prediction
- Budget-conscious trading approaches

Guidelines:
- Always provide clear reasoning for recommendations
- Consider market liquidity and volatility
- Factor in transportation costs and time
- Account for user's risk tolerance and budget constraints
- Explain complex concepts in accessible terms`;

    if (context.userProfile) {
      const profile = context.userProfile;
      return `${basePrompt}

Current User Profile:
- Trading Experience: ${profile.tradingExperience || 'Not specified'}
- Risk Tolerance: ${profile.riskTolerance || 'MODERATE'}
- Available Budget: ${profile.availableBudget ? `${profile.availableBudget.toLocaleString()} ISK` : 'Not specified'}
- Target Regions: ${profile.preferredMarkets?.join(', ') || 'All regions'}
- Trading Goals: ${profile.tradingGoals?.join(', ') || 'General profit maximization'}`;
    }

    return basePrompt;
  }

  /**
   * Build user prompt with context
   */
  private buildUserPrompt(prompt: string, context: any): string {
    let fullPrompt = prompt;

    if (context.marketData) {
      fullPrompt += `\n\nRelevant Market Data:\n${JSON.stringify(context.marketData, null, 2)}`;
    }

    if (context.analysisType) {
      fullPrompt += `\n\nRequested Analysis: ${context.analysisType}`;
    }

    if (context.constraints) {
      fullPrompt += `\n\nConstraints: ${JSON.stringify(context.constraints, null, 2)}`;
    }

    return fullPrompt;
  }

  /**
   * Calculate confidence score based on response characteristics
   */
  private calculateConfidence(response: any): number {
    // Base confidence for OpenAI
    let confidence = 0.75;

    const choice = response.choices[0];

    // Adjust based on finish reason
    if (choice?.finish_reason === 'stop') confidence += 0.1;
    if (choice?.finish_reason === 'length') confidence -= 0.1;

    // Adjust based on response content quality indicators
    const content = choice?.message?.content || '';
    if (content.includes('analysis') || content.includes('recommendation')) confidence += 0.05;
    if (content.length > 500) confidence += 0.05;
    if (content.length < 100) confidence -= 0.15;

    // Adjust based on token usage
    const usage = response.usage;
    if (usage) {
      const efficiency = usage.completion_tokens / usage.prompt_tokens;
      if (efficiency > 0.3 && efficiency < 2.0) confidence += 0.05;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }
}
