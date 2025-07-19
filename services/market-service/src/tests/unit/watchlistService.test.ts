import { WatchlistService } from '../../services/watchlistService';
import { WatchlistRepository } from '../../models/watchlistRepository';
import { MarketDataRepository } from '../../models/marketDataRepository';
import { Watchlist, WatchlistItem, AlertRule } from '../../../../../shared/src/types';

// Mock the repositories
jest.mock('../../models/watchlistRepository');
jest.mock('../../models/marketDataRepository');

describe('WatchlistService', () => {
  let watchlistService: WatchlistService;
  let mockWatchlistRepo: jest.Mocked<WatchlistRepository>;
  let mockMarketDataRepo: jest.Mocked<MarketDataRepository>;

  beforeEach(() => {
    mockWatchlistRepo = {
      createWatchlist: jest.fn(),
      getUserWatchlists: jest.fn(),
      getWatchlist: jest.fn(),
      addItemToWatchlist: jest.fn(),
      createAlertRule: jest.fn(),
      getActiveAlertRules: jest.fn(),
      createAlert: jest.fn(),
    } as any;
    mockMarketDataRepo = {
      getMarketData: jest.fn(),
      getHistoricalData: jest.fn(),
    } as any;
    watchlistService = new WatchlistService(mockWatchlistRepo, mockMarketDataRepo);
  });

  describe('createWatchlist', () => {
    it('should create a new watchlist', async () => {
      const userId = 'user-123';
      const name = 'My Watchlist';
      const expectedWatchlist: Watchlist = {
        id: 'watchlist-123',
        userId,
        name,
        items: [],
        alerts: [],
      };

      mockWatchlistRepo.createWatchlist.mockResolvedValue(expectedWatchlist);

      const result = await watchlistService.createWatchlist(userId, name);

      expect(mockWatchlistRepo.createWatchlist).toHaveBeenCalledWith(userId, name);
      expect(result).toEqual(expectedWatchlist);
    });
  });

  describe('getUserWatchlists', () => {
    it('should return user watchlists', async () => {
      const userId = 'user-123';
      const expectedWatchlists: Watchlist[] = [
        {
          id: 'watchlist-1',
          userId,
          name: 'Watchlist 1',
          items: [],
          alerts: [],
        },
        {
          id: 'watchlist-2',
          userId,
          name: 'Watchlist 2',
          items: [],
          alerts: [],
        },
      ];

      mockWatchlistRepo.getUserWatchlists.mockResolvedValue(expectedWatchlists);

      const result = await watchlistService.getUserWatchlists(userId);

      expect(mockWatchlistRepo.getUserWatchlists).toHaveBeenCalledWith(userId);
      expect(result).toEqual(expectedWatchlists);
    });
  });

  describe('addItemToWatchlist', () => {
    it('should add item to watchlist when user owns it', async () => {
      const watchlistId = 'watchlist-123';
      const userId = 'user-123';
      const item: Omit<WatchlistItem, 'addedAt'> = {
        typeId: 34,
        regionId: 10000002,
        targetBuyPrice: 1000,
        targetSellPrice: 1200,
      };

      const mockWatchlist: Watchlist = {
        id: watchlistId,
        userId,
        name: 'Test Watchlist',
        items: [],
        alerts: [],
      };

      mockWatchlistRepo.getWatchlist.mockResolvedValue(mockWatchlist);
      mockWatchlistRepo.addItemToWatchlist.mockResolvedValue();

      await watchlistService.addItemToWatchlist(watchlistId, userId, item);

      expect(mockWatchlistRepo.getWatchlist).toHaveBeenCalledWith(watchlistId, userId);
      expect(mockWatchlistRepo.addItemToWatchlist).toHaveBeenCalledWith(watchlistId, item);
    });

    it('should throw error when user does not own watchlist', async () => {
      const watchlistId = 'watchlist-123';
      const userId = 'user-123';
      const item: Omit<WatchlistItem, 'addedAt'> = {
        typeId: 34,
        regionId: 10000002,
      };

      mockWatchlistRepo.getWatchlist.mockResolvedValue(null);

      await expect(watchlistService.addItemToWatchlist(watchlistId, userId, item)).rejects.toThrow(
        'Watchlist not found or access denied'
      );

      expect(mockWatchlistRepo.addItemToWatchlist).not.toHaveBeenCalled();
    });
  });

  describe('createAlertRule', () => {
    it('should create alert rule when user owns watchlist', async () => {
      const watchlistId = 'watchlist-123';
      const userId = 'user-123';
      const rule: Omit<AlertRule, 'id' | 'createdAt'> = {
        typeId: 34,
        regionId: 10000002,
        condition: 'PRICE_ABOVE',
        threshold: 1500,
        isActive: true,
      };

      const mockWatchlist: Watchlist = {
        id: watchlistId,
        userId,
        name: 'Test Watchlist',
        items: [],
        alerts: [],
      };

      const expectedAlertRule: AlertRule = {
        id: 'alert-123',
        ...rule,
        createdAt: new Date(),
      };

      mockWatchlistRepo.getWatchlist.mockResolvedValue(mockWatchlist);
      mockWatchlistRepo.createAlertRule.mockResolvedValue(expectedAlertRule);

      const result = await watchlistService.createAlertRule(watchlistId, userId, rule);

      expect(mockWatchlistRepo.getWatchlist).toHaveBeenCalledWith(watchlistId, userId);
      expect(mockWatchlistRepo.createAlertRule).toHaveBeenCalledWith(watchlistId, rule);
      expect(result).toEqual(expectedAlertRule);
    });

    it('should throw error when user does not own watchlist', async () => {
      const watchlistId = 'watchlist-123';
      const userId = 'user-123';
      const rule: Omit<AlertRule, 'id' | 'createdAt'> = {
        typeId: 34,
        regionId: 10000002,
        condition: 'PRICE_ABOVE',
        threshold: 1500,
        isActive: true,
      };

      mockWatchlistRepo.getWatchlist.mockResolvedValue(null);

      await expect(watchlistService.createAlertRule(watchlistId, userId, rule)).rejects.toThrow(
        'Watchlist not found or access denied'
      );

      expect(mockWatchlistRepo.createAlertRule).not.toHaveBeenCalled();
    });
  });

  describe('checkAndTriggerAlerts', () => {
    it('should trigger alerts when conditions are met', async () => {
      const mockActiveRules = [
        {
          id: 'rule-1',
          typeId: 34,
          regionId: 10000002,
          condition: 'PRICE_ABOVE' as const,
          threshold: 1000,
          isActive: true,
          createdAt: new Date(),
          watchlistId: 'watchlist-1',
          userId: 'user-1',
        },
      ];

      const mockMarketData = {
        typeId: 34,
        regionId: 10000002,
        buyOrders: [],
        sellOrders: [],
        lastUpdated: new Date(),
        volume: 100,
        averagePrice: 1200, // Above threshold
      };

      const expectedAlert = {
        id: 'alert-1',
        userId: 'user-1',
        ruleId: 'rule-1',
        typeId: 34,
        regionId: 10000002,
        message: 'Price alert: 34 in region 10000002 is now 1200.00 ISK (above 1000.00 ISK)',
        triggeredAt: new Date(),
        acknowledged: false,
      };

      mockWatchlistRepo.getActiveAlertRules.mockResolvedValue(mockActiveRules);
      mockMarketDataRepo.getMarketData.mockResolvedValue(mockMarketData);
      mockWatchlistRepo.createAlert.mockResolvedValue(expectedAlert);

      const result = await watchlistService.checkAndTriggerAlerts();

      expect(mockWatchlistRepo.getActiveAlertRules).toHaveBeenCalled();
      expect(mockMarketDataRepo.getMarketData).toHaveBeenCalledWith(10000002, 34);
      expect(mockWatchlistRepo.createAlert).toHaveBeenCalledWith({
        userId: 'user-1',
        ruleId: 'rule-1',
        typeId: 34,
        regionId: 10000002,
        message: expect.stringContaining('Price alert'),
        acknowledged: false,
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expectedAlert);
    });

    it('should not trigger alerts when conditions are not met', async () => {
      const mockActiveRules = [
        {
          id: 'rule-1',
          typeId: 34,
          regionId: 10000002,
          condition: 'PRICE_ABOVE' as const,
          threshold: 1500,
          isActive: true,
          createdAt: new Date(),
          watchlistId: 'watchlist-1',
          userId: 'user-1',
        },
      ];

      const mockMarketData = {
        typeId: 34,
        regionId: 10000002,
        buyOrders: [],
        sellOrders: [],
        lastUpdated: new Date(),
        volume: 100,
        averagePrice: 1200, // Below threshold
      };

      mockWatchlistRepo.getActiveAlertRules.mockResolvedValue(mockActiveRules);
      mockMarketDataRepo.getMarketData.mockResolvedValue(mockMarketData);

      const result = await watchlistService.checkAndTriggerAlerts();

      expect(mockWatchlistRepo.createAlert).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });
  });
});
