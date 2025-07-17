import { FastifyInstance } from 'fastify';
import { MarketDataFetcher } from './marketDataFetcher';

export class DataRefreshScheduler {
  private fetcher: MarketDataFetcher;
  private refreshInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(private fastify: FastifyInstance) {
    this.fetcher = new MarketDataFetcher(fastify);
  }

  start(intervalMinutes: number = 5): void {
    if (this.isRunning) {
      this.fastify.log.warn('Data refresh scheduler is already running');
      return;
    }

    this.isRunning = true;
    const intervalMs = intervalMinutes * 60 * 1000;

    this.fastify.log.info({ intervalMinutes }, 'Starting data refresh scheduler');

    this.refreshInterval = setInterval(async () => {
      await this.performRefresh();
    }, intervalMs);

    // Perform initial refresh after a short delay
    setTimeout(() => {
      this.performRefresh();
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

    this.isRunning = false;
  }

  private async performRefresh(): Promise<void> {
    try {
      this.fastify.log.debug('Starting scheduled data refresh');

      const result = await this.fetcher.refreshStaleData(10); // Refresh data older than 10 minutes

      this.fastify.log.info(
        {
          refreshed: result.refreshed,
          failed: result.failed,
          errorCount: result.errors.length,
        },
        'Completed scheduled data refresh'
      );

      if (result.errors.length > 0) {
        this.fastify.log.warn(
          {
            errors: result.errors.slice(0, 5), // Log first 5 errors to avoid spam
          },
          'Some items failed to refresh during scheduled refresh'
        );
      }
    } catch (error) {
      this.fastify.log.error(
        {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Scheduled data refresh failed'
      );
    }
  }

  getStatus(): {
    isRunning: boolean;
    nextRefreshIn?: number;
  } {
    return {
      isRunning: this.isRunning,
      // Note: We can't easily get the exact time until next refresh with setInterval
      // In a production system, you might want to use a more sophisticated scheduler
    };
  }
}
