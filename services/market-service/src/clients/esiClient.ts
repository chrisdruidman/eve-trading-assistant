import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { FastifyInstance } from 'fastify';
import { MarketOrder, PriceHistory, EsiError } from '../../../../shared/src/types';

interface EsiRateLimit {
  remain: number;
  reset: number;
}

interface EsiMarketOrder {
  order_id: number;
  type_id: number;
  location_id: number;
  volume_total: number;
  volume_remain: number;
  min_volume: number;
  price: number;
  is_buy_order: boolean;
  duration: number;
  issued: string;
  range: string;
}

interface EsiHistoryEntry {
  date: string;
  highest: number;
  lowest: number;
  average: number;
  volume: number;
  order_count: number;
}

export class EsiClient {
  private client: AxiosInstance;
  private rateLimitRemain: number = 100;
  private rateLimitReset: number = 0;
  private circuitBreakerFailures: number = 0;
  private circuitBreakerLastFailure: number = 0;
  private readonly maxFailures = 5;
  private readonly circuitBreakerTimeout = 60000; // 1 minute

  constructor(private fastify: FastifyInstance) {
    this.client = axios.create({
      baseURL: 'https://esi.evetech.net/latest',
      timeout: 30000,
      headers: {
        'User-Agent': this.buildUserAgent(),
        Accept: 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private buildUserAgent(): string {
    const appName = 'EVE-Trading-Assistant';
    const version = '1.0.0';
    const contact = process.env['ESI_CONTACT_EMAIL'] || 'admin@example.com';
    const repository = 'https://github.com/your-org/eve-trading-assistant';

    return `${appName}/${version} (${contact}; +${repository})`;
  }

  private setupInterceptors(): void {
    // Request interceptor for rate limiting
    this.client.interceptors.request.use(async config => {
      await this.checkRateLimit();
      return config;
    });

    // Response interceptor for rate limit tracking and error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        this.updateRateLimitFromHeaders(response);
        this.resetCircuitBreaker();
        return response;
      },
      (error: AxiosError) => {
        this.handleResponseError(error);
        return Promise.reject(error);
      }
    );
  }

  private updateRateLimitFromHeaders(response: AxiosResponse): void {
    const remainHeader = response.headers['x-esi-error-limit-remain'];
    const resetHeader = response.headers['x-esi-error-limit-reset'];

    if (remainHeader) {
      this.rateLimitRemain = parseInt(remainHeader, 10);
    }
    if (resetHeader) {
      this.rateLimitReset = Date.now() + parseInt(resetHeader, 10) * 1000;
    }

    this.fastify.log.debug(
      {
        remain: this.rateLimitRemain,
        resetIn: Math.max(0, this.rateLimitReset - Date.now()) / 1000,
      },
      'ESI rate limit updated'
    );
  }

  private async checkRateLimit(): Promise<void> {
    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      throw new Error('ESI circuit breaker is open - too many recent failures');
    }

    // Check rate limit
    if (this.rateLimitRemain <= 1) {
      const waitTime = Math.max(0, this.rateLimitReset - Date.now());
      if (waitTime > 0) {
        this.fastify.log.warn({ waitTime }, 'Rate limit reached, waiting');
        await this.sleep(waitTime);
      }
    }
  }

  private isCircuitBreakerOpen(): boolean {
    if (this.circuitBreakerFailures >= this.maxFailures) {
      const timeSinceLastFailure = Date.now() - this.circuitBreakerLastFailure;
      if (timeSinceLastFailure < this.circuitBreakerTimeout) {
        return true;
      } else {
        // Reset circuit breaker after timeout
        this.circuitBreakerFailures = 0;
      }
    }
    return false;
  }

  private resetCircuitBreaker(): void {
    if (this.circuitBreakerFailures > 0) {
      this.fastify.log.info('ESI circuit breaker reset - successful request');
      this.circuitBreakerFailures = 0;
    }
  }

  private handleResponseError(error: AxiosError): void {
    const status = error.response?.status;

    if (status && status >= 500) {
      this.circuitBreakerFailures++;
      this.circuitBreakerLastFailure = Date.now();

      this.fastify.log.warn(
        {
          failures: this.circuitBreakerFailures,
          maxFailures: this.maxFailures,
          status,
        },
        'ESI server error - incrementing circuit breaker failures'
      );
    }

    // Update rate limit even on errors
    if (error.response) {
      this.updateRateLimitFromHeaders(error.response);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async executeWithBackoff<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          break;
        }

        const isRetryable = this.isRetryableError(error as AxiosError);
        if (!isRetryable) {
          break;
        }

        const delay = this.calculateBackoffDelay(attempt);
        this.fastify.log.warn(
          {
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            delay,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          'ESI request failed, retrying with backoff'
        );

        await this.sleep(delay);
      }
    }

    throw this.createEsiError(lastError!);
  }

  private isRetryableError(error: AxiosError): boolean {
    if (!error.response) {
      return true; // Network errors are retryable
    }

    const status = error.response.status;

    // Retry on server errors and rate limit errors
    return status >= 500 || status === 420 || status === 429;
  }

  private calculateBackoffDelay(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 16000; // 16 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return delay + jitter;
  }

  private createEsiError(error: Error): EsiError {
    const esiError = new Error(error.message) as EsiError;
    esiError.name = 'EsiError';

    if (error instanceof Error && 'response' in error) {
      const axiosError = error as AxiosError;
      esiError.status = axiosError.response?.status || 0;
      esiError.code = axiosError.code || 'UNKNOWN';

      const retryAfter = axiosError.response?.headers['retry-after'];
      if (retryAfter) {
        esiError.retryAfter = parseInt(retryAfter, 10);
      }
    } else {
      esiError.status = 0;
      esiError.code = 'NETWORK_ERROR';
    }

    return esiError;
  }

  async getMarketOrders(regionId: number, typeId: number): Promise<MarketOrder[]> {
    return this.executeWithBackoff(async () => {
      this.fastify.log.debug({ regionId, typeId }, 'Fetching market orders from ESI');

      const response = await this.client.get<EsiMarketOrder[]>(`/markets/${regionId}/orders/`, {
        params: {
          type_id: typeId,
          order_type: 'all',
        },
      });

      const orders = response.data.map(this.transformMarketOrder.bind(this));

      this.fastify.log.debug(
        {
          regionId,
          typeId,
          orderCount: orders.length,
        },
        'Successfully fetched market orders from ESI'
      );

      return orders;
    });
  }

  private transformMarketOrder(esiOrder: EsiMarketOrder): MarketOrder {
    return {
      orderId: esiOrder.order_id,
      typeId: esiOrder.type_id,
      regionId: 0, // Will be set by caller
      locationId: esiOrder.location_id,
      price: esiOrder.price,
      volume: esiOrder.volume_remain,
      minVolume: esiOrder.min_volume,
      duration: esiOrder.duration,
      issued: new Date(esiOrder.issued),
      isBuyOrder: esiOrder.is_buy_order,
    };
  }

  async getMarketHistory(regionId: number, typeId: number): Promise<PriceHistory[]> {
    return this.executeWithBackoff(async () => {
      this.fastify.log.debug({ regionId, typeId }, 'Fetching market history from ESI');

      const response = await this.client.get<EsiHistoryEntry[]>(`/markets/${regionId}/history/`, {
        params: {
          type_id: typeId,
        },
      });

      const history = response.data.map(entry =>
        this.transformHistoryEntry(entry, regionId, typeId)
      );

      this.fastify.log.debug(
        {
          regionId,
          typeId,
          historyCount: history.length,
        },
        'Successfully fetched market history from ESI'
      );

      return history;
    });
  }

  private transformHistoryEntry(
    entry: EsiHistoryEntry,
    regionId: number,
    typeId: number
  ): PriceHistory {
    return {
      typeId,
      regionId,
      date: new Date(entry.date),
      highest: entry.highest,
      lowest: entry.lowest,
      average: entry.average,
      volume: entry.volume,
      orderCount: entry.order_count,
    };
  }

  async validateConnection(): Promise<boolean> {
    try {
      await this.executeWithBackoff(async () => {
        const response = await this.client.get('/status/');
        return response.status === 200;
      });
      return true;
    } catch (error) {
      this.fastify.log.error({ error }, 'ESI connection validation failed');
      return false;
    }
  }

  getRateLimitStatus(): EsiRateLimit {
    return {
      remain: this.rateLimitRemain,
      reset: Math.max(0, this.rateLimitReset - Date.now()) / 1000,
    };
  }

  getCircuitBreakerStatus(): {
    isOpen: boolean;
    failures: number;
    maxFailures: number;
    resetIn?: number;
  } {
    const isOpen = this.isCircuitBreakerOpen();
    const result: {
      isOpen: boolean;
      failures: number;
      maxFailures: number;
      resetIn?: number;
    } = {
      isOpen,
      failures: this.circuitBreakerFailures,
      maxFailures: this.maxFailures,
    };

    if (isOpen) {
      result.resetIn =
        Math.max(0, this.circuitBreakerTimeout - (Date.now() - this.circuitBreakerLastFailure)) /
        1000;
    }

    return result;
  }
}
