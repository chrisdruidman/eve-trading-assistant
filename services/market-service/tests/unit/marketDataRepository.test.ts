import { MarketDataRepository } from '../../src/models/marketDataRepository';
import { MarketData } from '../../../../shared/src/types';

// Mock Fastify instance
const mockFastify = {
  db: {
    query: jest.fn(),
    getClient: jest.fn(),
  },
} as any;

describe('MarketDataRepository', () => {
  let repository: MarketDataRepository;
  let mockClient: any;

  beforeEach(() => {
    repository = new MarketDataRepository(mockFastify);
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockFastify.db.getClient.mockResolvedValue(mockClient);
    jest.clearAllMocks();
  });

  describe('getMarketData', () => {
    it('should return null when no market data exists', async () => {
      mockFastify.db.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.getMarketData(10000002, 34);

      expect(result).toBeNull();
      expect(mockFastify.db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM market_data'),
        [34, 10000002]
      );
    });

    it('should return market data with orders when data exists', async () => {
      const mockMarketData = {
        type_id: 34,
        region_id: 10000002,
        last_updated: new Date(),
        volume: 1000,
        average_price: '100.50',
      };

      const mockOrders = [
        {
          order_id: 123,
          type_id: 34,
          region_id: 10000002,
          location_id: 60003760,
          price: '99.99',
          volume: 100,
          min_volume: 1,
          duration: 90,
          issued: new Date(),
          is_buy_order: true,
        },
        {
          order_id: 124,
          type_id: 34,
          region_id: 10000002,
          location_id: 60003760,
          price: '101.00',
          volume: 50,
          min_volume: 1,
          duration: 90,
          issued: new Date(),
          is_buy_order: false,
        },
      ];

      // Mock both database queries that getMarketData makes
      mockFastify.db.query
        .mockResolvedValueOnce({ rows: [mockMarketData] }) // First query for market_data
        .mockResolvedValueOnce({ rows: mockOrders }); // Second query for market_orders

      const result = await repository.getMarketData(10000002, 34);

      expect(result).toBeDefined();
      expect(result?.typeId).toBe(34);
      expect(result?.regionId).toBe(10000002);
      expect(result?.buyOrders).toHaveLength(1);
      expect(result?.sellOrders).toHaveLength(1);
      expect(result?.averagePrice).toBe(100.5);
      expect(result?.buyOrders[0]?.price).toBe(99.99);
      expect(result?.sellOrders[0]?.price).toBe(101.0);
    });
  });

  describe('saveMarketData', () => {
    it('should save market data and orders in a transaction', async () => {
      const marketData: MarketData = {
        typeId: 34,
        regionId: 10000002,
        lastUpdated: new Date(),
        volume: 1000,
        averagePrice: 100.5,
        buyOrders: [
          {
            orderId: 123,
            typeId: 34,
            regionId: 10000002,
            locationId: 60003760,
            price: 99.99,
            volume: 100,
            minVolume: 1,
            duration: 90,
            issued: new Date(),
            isBuyOrder: true,
          },
        ],
        sellOrders: [
          {
            orderId: 124,
            typeId: 34,
            regionId: 10000002,
            locationId: 60003760,
            price: 101.0,
            volume: 50,
            minVolume: 1,
            duration: 90,
            issued: new Date(),
            isBuyOrder: false,
          },
        ],
      };

      await repository.saveMarketData(marketData);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO market_data'),
        expect.arrayContaining([34, 10000002])
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM market_orders'),
        [34, 10000002]
      );
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const marketData: MarketData = {
        typeId: 34,
        regionId: 10000002,
        lastUpdated: new Date(),
        volume: 1000,
        averagePrice: 100.5,
        buyOrders: [],
        sellOrders: [],
      };

      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.saveMarketData(marketData)).rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
