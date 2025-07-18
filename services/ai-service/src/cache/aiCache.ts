import { createClient, RedisClientType } from 'redis';
import { AIResponse } from '../../../../shared/src/types';
import crypto from 'crypto';

/**
 * AI Response Cache
 * Caches AI responses to reduce API costs and improve performance
 */
export class AICacheManager {
  private redis: RedisClientType;
  private defaultTTL = 3600; // 1 hour default TTL
  private keyPrefix = 'ai_cache:';

  constructor(redisUrl?: string) {
    this.redis = createClient({
      url: redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
    });

    this.redis.on('error', err => {
      console.error('Redis Cache Error:', err);
    });

    this.redis.on('connect', () => {
      console.log('AI Cache connected to Redis');
    });
  }

  /**
   * Initialize cache connection
   */
  async initialize(): Promise<void> {
    if (!this.redis.isOpen) {
      await this.redis.connect();
    }
  }

  /**
   * Generate cache key from prompt and context
   */
  private generateCacheKey(prompt: string, context: any, provider: string): string {
    const contextStr = JSON.stringify(context || {});
    const combined = `${provider}:${prompt}:${contextStr}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    return `${this.keyPrefix}${hash}`;
  }

  /**
   * Get cached AI response
   */
  async get(prompt: string, context: any, provider: string): Promise<AIResponse | null> {
    try {
      const key = this.generateCacheKey(prompt, context, provider);
      const cached = await this.redis.get(key);

      if (!cached) {
        return null;
      }

      const response: AIResponse = JSON.parse(cached);
      response.cached = true;

      console.log(`Cache HIT for provider ${provider}`);
      return response;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Store AI response in cache
   */
  async set(
    prompt: string,
    context: any,
    provider: string,
    response: AIResponse,
    ttl?: number
  ): Promise<void> {
    try {
      const key = this.generateCacheKey(prompt, context, provider);
      const cacheData = { ...response, cached: false }; // Store original cached flag

      await this.redis.setEx(key, ttl || this.defaultTTL, JSON.stringify(cacheData));

      console.log(`Cache SET for provider ${provider}, TTL: ${ttl || this.defaultTTL}s`);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Check if response should be cached based on content and cost
   */
  shouldCache(response: AIResponse, cost: number): boolean {
    // Cache expensive responses (> $0.01)
    if (cost > 0.01) return true;

    // Cache long responses (likely detailed analysis)
    if (response.content.length > 1000) return true;

    // Cache high-confidence responses
    if (response.confidence > 0.8) return true;

    // Don't cache error responses or very short responses
    if (response.content.length < 50) return false;

    return true;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      const totalKeys = keys.length;

      // Sample some keys to get size estimates
      const sampleSize = Math.min(10, totalKeys);
      let totalSize = 0;

      for (let i = 0; i < sampleSize; i++) {
        const key = keys[i];
        const value = await this.redis.get(key);
        if (value) {
          totalSize += Buffer.byteLength(value, 'utf8');
        }
      }

      const avgSize = sampleSize > 0 ? totalSize / sampleSize : 0;
      const estimatedTotalSize = avgSize * totalKeys;

      return {
        totalEntries: totalKeys,
        estimatedSizeBytes: Math.round(estimatedTotalSize),
        estimatedSizeMB: Math.round((estimatedTotalSize / (1024 * 1024)) * 100) / 100,
        avgEntrySizeBytes: Math.round(avgSize),
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalEntries: 0,
        estimatedSizeBytes: 0,
        estimatedSizeMB: 0,
        avgEntrySizeBytes: 0,
      };
    }
  }

  /**
   * Clear cache entries older than specified age
   */
  async cleanup(maxAgeHours: number = 24): Promise<number> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      let deletedCount = 0;

      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        const ageHours = (this.defaultTTL - ttl) / 3600;

        if (ageHours > maxAgeHours) {
          await this.redis.del(key);
          deletedCount++;
        }
      }

      console.log(`Cache cleanup: deleted ${deletedCount} entries older than ${maxAgeHours} hours`);
      return deletedCount;
    } catch (error) {
      console.error('Cache cleanup error:', error);
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        await this.redis.del(keys);
        console.log(`Cleared ${keys.length} cache entries`);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Close cache connection
   */
  async close(): Promise<void> {
    if (this.redis.isOpen) {
      await this.redis.quit();
    }
  }
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
  totalEntries: number;
  estimatedSizeBytes: number;
  estimatedSizeMB: number;
  avgEntrySizeBytes: number;
}
