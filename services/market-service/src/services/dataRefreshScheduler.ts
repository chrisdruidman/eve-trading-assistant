import { FastifyInstance } from 'fastify';
import { MarketDataFetcher } from './marketDataFetcher';
import { CacheManager } from '../utils/cacheManager';

interface RefreshStrategy {
  name: string;
  intervalMinutes: number;
  maxAgeMinutes: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  enabled: boolean;
}

interface RefreshMetrics {
  totalRefreshes: number;
  successfulRefreshes: number;
  failedRefreshes: number;
  averageRefreshTime: number;
  lastRefreshAt?: Date;
  nextRefreshAt?: Date;
  itemsRefreshed: number;
  itemsFailed: number;
}

export class DataRefreshScheduler {
  private fetcher: MarketDataFetcher;
  private cacheManager: CacheManager;
  private refreshInterval: ReturnType<typeof setInterval> | null = null;
  private metricsInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;
  private lastRefreshStart: Date | null = null;
  private metrics: RefreshMetrics = {
    totalRefreshes: 0,
    successfulRefreshes: 0,
    failedRefreshes: 0,
    averageRefreshTime: 0,
    itemsRefreshed: 0,
    itemsFailed: 0,
  };

  private strategies: RefreshStrategy[] = [
    {
      name: 'high-priority',
      intervalMinutes: 3, // Every 3 minutes for high-priority items
      maxAgeMinutes: 5,
      priority: 'HIGH',
      enabled: true,
    },
    {
      name: 'medium-priority',
      intervalMinutes: 10, // Every 10 minutes for medium-priority items
      maxAgeMinutes: 15,
      priority: 'MEDIUM',
      enabled: true,
    },
    {
      name: 'low-priority',
      intervalMinutes: 30, // Every 30 minutes for low-priority items
      maxAgeMinutes: 60,
      priority: 'LOW',
      enabled: true,
    },
  ];

  constructor(private fastify: FastifyInstance) {
    this.fetcher = new MarketDataFetcher(fastify);
    this.cacheManager = new CacheManager(fastify);
  }

  start(intervalMinutes: number = 5): void {
    if (this.isRunning) {
      this.fastify.log.warn('Data refresh scheduler is already running');
      return;
    }

    this.isRunning = true;
    const intervalMs = intervalMinutes * 60 * 1000;

    this.fastify.log.info(
      { intervalMinutes, strategies: this.strategies },
      'Starting intelligent data refresh scheduler'
    );

    // Start the main refresh cycle
    this.refreshInterval = setInterval(async () => {
      await this.performIntelligentRefresh();
    }, intervalMs);

    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.logMetrics();
    }, 300000); // Every 5 minutes

    // Perform initial refresh after a short delay
    setTimeout(() => {
      this.performIntelligentRefresh();
    }, 30000); // 30 seconds
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.fastify.log.info('Stopping data refresh scheduler');

    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    this.isRunning = false;
  }

  private async performIntelligentRefresh(): Promise<void> {
    const startTime = Date.now();
    this.lastRefreshStart = new Date();
    this.metrics.totalRefreshes++;

    try {
      this.fastify.log.debug('Starting intelligent scheduled data refresh');

      let totalRefreshed = 0;
      let totalFailed = 0;
      const allErrors: string[] = [];

      // Execute refresh strategies based on priority and timing
      for (const strategy of this.strategies) {
        if (!strategy.enabled) {
          continue;
        }

        // Check if it's time to run this strategy
        if (this.shouldRunStrategy(strategy)) {
          this.fastify.log.debug(
            { strategy: strategy.name, maxAge: strategy.maxAgeMinutes },
            'Executing refresh strategy'
          );

          const result = await this.fetcher.refreshStaleData(strategy.maxAgeMinutes);

          totalRefreshed += result.refreshed;
          totalFailed += result.failed;
          allErrors.push(...result.errors);

          // Add delay between strategies to prevent overwhelming the system
          if (result.refreshed > 0) {
            await this.sleep(2000); // 2 second delay
          }
        }
      }

      // Update metrics
      const refreshTime = Date.now() - startTime;
      this.updateRefreshMetrics(true, refreshTime, totalRefreshed, totalFailed);

      this.fastify.log.info(
        {
          refreshed: totalRefreshed,
          failed: totalFailed,
          errorCount: allErrors.length,
          duration: refreshTime,
        },
        'Completed intelligent scheduled data refresh'
      );

      if (allErrors.length > 0) {
        this.fastify.log.warn(
          {
            errors: allErrors.slice(0, 5), // Log first 5 errors to avoid spam
            totalErrors: allErrors.length,
          },
          'Some items failed to refresh during scheduled refresh'
        );
      }
    } catch (error) {
      const refreshTime = Date.now() - startTime;
      this.updateRefreshMetrics(false, refreshTime, 0, 0);

      this.fastify.log.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: refreshTime,
        },
        'Intelligent scheduled data refresh failed'
      );
    }
  }

  private shouldRunStrategy(strategy: RefreshStrategy): boolean {
    // For now, run all enabled strategies on each cycle
    // In a more sophisticated implementation, you could track last run times
    // and only run strategies when their interval has elapsed
    return strategy.enabled;
  }

  private updateRefreshMetrics(
    success: boolean,
    duration: number,
    itemsRefreshed: number,
    itemsFailed: number
  ): void {
    if (success) {
      this.metrics.successfulRefreshes++;
    } else {
      this.metrics.failedRefreshes++;
    }

    this.metrics.itemsRefreshed += itemsRefreshed;
    this.metrics.itemsFailed += itemsFailed;
    this.metrics.lastRefreshAt = new Date();

    // Update average refresh time
    const totalSuccessfulRefreshes = this.metrics.successfulRefreshes;
    if (totalSuccessfulRefreshes > 0) {
      this.metrics.averageRefreshTime =
        (this.metrics.averageRefreshTime * (totalSuccessfulRefreshes - 1) + duration) /
        totalSuccessfulRefreshes;
    }
  }

  private logMetrics(): void {
    const cacheStats = this.cacheManager.getMetrics();

    this.fastify.log.info(
      {
        refreshMetrics: this.metrics,
        cacheMetrics: cacheStats,
      },
      'Data refresh and cache metrics'
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus(): {
    isRunning: boolean;
    metrics: RefreshMetrics;
    strategies: RefreshStrategy[];
    lastRefreshStart?: Date;
  } {
    return {
      isRunning: this.isRunning,
      metrics: { ...this.metrics },
      strategies: [...this.strategies],
      ...(this.lastRefreshStart && { lastRefreshStart: this.lastRefreshStart }),
    };
  }

  getMetrics(): RefreshMetrics {
    return { ...this.metrics };
  }

  updateStrategy(strategyName: string, updates: Partial<RefreshStrategy>): boolean {
    const strategy = this.strategies.find(s => s.name === strategyName);
    if (!strategy) {
      return false;
    }

    Object.assign(strategy, updates);
    this.fastify.log.info({ strategyName, updates }, 'Updated refresh strategy');
    return true;
  }

  async forceRefresh(maxAgeMinutes?: number): Promise<{
    refreshed: number;
    failed: number;
    errors: string[];
    duration: number;
  }> {
    const startTime = Date.now();

    this.fastify.log.info({ maxAgeMinutes }, 'Starting forced data refresh');

    try {
      const result = await this.fetcher.refreshStaleData(maxAgeMinutes || 0);
      const duration = Date.now() - startTime;

      if (result) {
        this.fastify.log.info(
          {
            refreshed: result.refreshed,
            failed: result.failed,
            duration,
          },
          'Completed forced data refresh'
        );

        return {
          ...result,
          duration,
        };
      } else {
        // Handle case where result is undefined
        this.fastify.log.warn('Force refresh returned undefined result');
        return {
          refreshed: 0,
          failed: 0,
          errors: [],
          duration,
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.fastify.log.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          duration,
        },
        'Forced data refresh failed'
      );
      throw error;
    }
  }
}
