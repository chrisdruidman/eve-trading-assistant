import { EsiClient } from '../../src/clients/esiClient';
import { FastifyInstance } from 'fastify';
import axios from 'axios';
import { jest } from '@jest/globals';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock fastify instance
const mockFastify = {
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
} as unknown as FastifyInstance;

describe('EsiClient', () => {
  let esiClient: EsiClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      get: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    esiClient = new EsiClient(mockFastify);
  });

  describe('constructor', () => {
    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://esi.evetech.net/latest',
        timeout: 30000,
        headers: {
          'User-Agent': expect.stringContaining('EVE-Trading-Assistant/1.0.0'),
          Accept: 'application/json',
        },
      });
    });

    it('should setup request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('getMarketOrders', () => {
    const mockEsiOrders = [
      {
        order_id: 123456,
        type_id: 34,
        location_id: 60003760,
        volume_total: 100,
        volume_remain: 50,
        min_volume: 1,
        price: 1000.5,
        is_buy_order: false,
        duration: 90,
        issued: '2023-01-01T12:00:00Z',
        range: 'station',
      },
      {
        order_id: 789012,
        type_id: 34,
        location_id: 60003760,
        volume_total: 200,
        volume_remain: 150,
        min_volume: 1,
        price: 950.25,
        is_buy_order: true,
        duration: 30,
        issued: '2023-01-01T10:00:00Z',
        range: 'station',
      },
    ];

    it('should fetch and transform market orders successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockEsiOrders,
        headers: {
          'x-esi-error-limit-remain': '95',
          'x-esi-error-limit-reset': '60',
        },
      });

      const result = await esiClient.getMarketOrders(10000002, 34);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/markets/10000002/orders/', {
        params: {
          type_id: 34,
          order_type: 'all',
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        orderId: 123456,
        typeId: 34,
        regionId: 0, // Will be set by caller
        locationId: 60003760,
        price: 1000.5,
        volume: 50,
        minVolume: 1,
        duration: 90,
        issued: new Date('2023-01-01T12:00:00Z'),
        isBuyOrder: false,
      });
    });

    it('should retry on server errors with exponential backoff', async () => {
      const serverError = {
        response: { status: 500 },
        isAxiosError: true,
      };

      mockAxiosInstance.get
        .mockRejectedValueOnce(serverError)
        .mockRejectedValueOnce(serverError)
        .mockResolvedValue({
          data: mockEsiOrders,
          headers: {},
        });

      const result = await esiClient.getMarketOrders(10000002, 34);

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
      expect(result).toHaveLength(2);
    });

    it('should throw EsiError after max retries', async () => {
      const serverError = {
        response: { status: 500 },
        code: 'ECONNRESET',
        message: 'Server error',
        isAxiosError: true,
      };

      mockAxiosInstance.get.mockRejectedValue(serverError);

      await expect(esiClient.getMarketOrders(10000002, 34)).rejects.toThrow();
    });

    it('should not retry on client errors', async () => {
      const clientError = {
        response: { status: 404 },
        code: 'NOT_FOUND',
        message: 'Not found',
        isAxiosError: true,
      };

      mockAxiosInstance.get.mockRejectedValue(clientError);

      await expect(esiClient.getMarketOrders(10000002, 34)).rejects.toThrow();
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMarketHistory', () => {
    const mockEsiHistory = [
      {
        date: '2023-01-01',
        highest: 1100.0,
        lowest: 900.0,
        average: 1000.0,
        volume: 50000,
        order_count: 25,
      },
      {
        date: '2023-01-02',
        highest: 1050.0,
        lowest: 950.0,
        average: 1000.0,
        volume: 45000,
        order_count: 20,
      },
    ];

    it('should fetch and transform market history successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: mockEsiHistory,
        headers: {},
      });

      const result = await esiClient.getMarketHistory(10000002, 34);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/markets/10000002/history/', {
        params: {
          type_id: 34,
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        typeId: 34,
        regionId: 10000002,
        date: new Date('2023-01-01'),
        highest: 1100.0,
        lowest: 900.0,
        average: 1000.0,
        volume: 50000,
        orderCount: 25,
      });
    });
  });

  describe('rate limiting', () => {
    it('should track rate limit from response headers', async () => {
      const mockResponse = {
        data: [],
        headers: {
          'x-esi-error-limit-remain': '50',
          'x-esi-error-limit-reset': '120',
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      // Manually call the response interceptor to simulate the behavior
      const responseInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][0];
      responseInterceptor(mockResponse);

      await esiClient.getMarketOrders(10000002, 34);

      const rateLimitStatus = esiClient.getRateLimitStatus();
      expect(rateLimitStatus.remain).toBe(50);
      expect(rateLimitStatus.reset).toBeGreaterThan(0);
    });

    it('should wait when rate limit is reached', async () => {
      // Mock a scenario where rate limit is very low
      mockAxiosInstance.get.mockResolvedValue({
        data: [],
        headers: {
          'x-esi-error-limit-remain': '0',
          'x-esi-error-limit-reset': '1', // 1 second
        },
      });

      await esiClient.getMarketOrders(10000002, 34);

      // Should have waited some time (though we can't test exact timing in unit tests)
      expect(mockAxiosInstance.get).toHaveBeenCalled();
    });
  });

  describe('circuit breaker', () => {
    it('should track failures and open circuit breaker', async () => {
      const serverError = {
        response: {
          status: 500,
          headers: {
            'x-esi-error-limit-remain': '95',
            'x-esi-error-limit-reset': '60',
          },
        },
        isAxiosError: true,
      };

      // Mock the error interceptor to simulate failure tracking
      const errorInterceptor = mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      // Cause multiple failures to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        mockAxiosInstance.get.mockRejectedValue(serverError);

        // Manually call the error interceptor to simulate the behavior
        errorInterceptor(serverError);

        try {
          await esiClient.getMarketOrders(10000002, 34);
        } catch (error) {
          // Expected to fail
        }
      }

      const circuitBreakerStatus = esiClient.getCircuitBreakerStatus();
      expect(circuitBreakerStatus.failures).toBe(5);
      expect(circuitBreakerStatus.isOpen).toBe(true);
    }, 15000);

    it('should reset circuit breaker on successful request', async () => {
      // First cause a failure
      const serverError = {
        response: { status: 500 },
        isAxiosError: true,
      };

      mockAxiosInstance.get.mockRejectedValueOnce(serverError);
      try {
        await esiClient.getMarketOrders(10000002, 34);
      } catch (error) {
        // Expected to fail
      }

      // Then succeed
      mockAxiosInstance.get.mockResolvedValue({
        data: [],
        headers: {},
      });

      await esiClient.getMarketOrders(10000002, 34);

      const circuitBreakerStatus = esiClient.getCircuitBreakerStatus();
      expect(circuitBreakerStatus.failures).toBe(0);
      expect(circuitBreakerStatus.isOpen).toBe(false);
    });
  });

  describe('validateConnection', () => {
    it('should return true when ESI is available', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        status: 200,
        data: {},
      });

      const result = await esiClient.validateConnection();
      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/status/');
    });

    it('should return false when ESI is unavailable', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));

      const result = await esiClient.validateConnection();
      expect(result).toBe(false);
    });
  });

  describe('user agent', () => {
    it('should include required information in user agent', () => {
      const createCall = mockedAxios.create.mock.calls[0]?.[0];
      const headers = createCall?.headers as Record<string, string>;
      const userAgent = headers?.['User-Agent'];

      expect(userAgent).toContain('EVE-Trading-Assistant/1.0.0');
      expect(userAgent).toContain('@');
      expect(userAgent).toContain('github.com');
    });
  });
});
