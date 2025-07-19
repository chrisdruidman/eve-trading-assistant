import { WatchlistRepository } from '../models/watchlistRepository';
import { MarketDataRepository } from '../models/marketDataRepository';
import { Watchlist, WatchlistItem, AlertRule, Alert } from '../../../shared/src/types';

export class WatchlistService {
  constructor(
    private watchlistRepo: WatchlistRepository,
    private marketDataRepo: MarketDataRepository
  ) {}

  async createWatchlist(userId: string, name: string): Promise<Watchlist> {
    return await this.watchlistRepo.createWatchlist(userId, name);
  }

  async getUserWatchlists(userId: string): Promise<Watchlist[]> {
    return await this.watchlistRepo.getUserWatchlists(userId);
  }

  async getWatchlist(watchlistId: string, userId: string): Promise<Watchlist | null> {
    return await this.watchlistRepo.getWatchlist(watchlistId, userId);
  }

  async addItemToWatchlist(
    watchlistId: string,
    userId: string,
    item: Omit<WatchlistItem, 'addedAt'>
  ): Promise<void> {
    // Verify user owns the watchlist
    const watchlist = await this.watchlistRepo.getWatchlist(watchlistId, userId);
    if (!watchlist) {
      throw new Error('Watchlist not found or access denied');
    }

    await this.watchlistRepo.addItemToWatchlist(watchlistId, item);
  }

  async removeItemFromWatchlist(
    watchlistId: string,
    userId: string,
    typeId: number,
    regionId: number
  ): Promise<void> {
    // Verify user owns the watchlist
    const watchlist = await this.watchlistRepo.getWatchlist(watchlistId, userId);
    if (!watchlist) {
      throw new Error('Watchlist not found or access denied');
    }

    await this.watchlistRepo.removeItemFromWatchlist(watchlistId, typeId, regionId);
  }

  async createAlertRule(
    watchlistId: string,
    userId: string,
    rule: Omit<AlertRule, 'id' | 'createdAt'>
  ): Promise<AlertRule> {
    // Verify user owns the watchlist
    const watchlist = await this.watchlistRepo.getWatchlist(watchlistId, userId);
    if (!watchlist) {
      throw new Error('Watchlist not found or access denied');
    }

    return await this.watchlistRepo.createAlertRule(watchlistId, rule);
  }

  async updateAlertRule(
    ruleId: string,
    userId: string,
    updates: Partial<Pick<AlertRule, 'threshold' | 'isActive'>>
  ): Promise<void> {
    // Verify user owns the alert rule through watchlist ownership
    const activeRules = await this.watchlistRepo.getActiveAlertRules();
    const rule = activeRules.find(r => r.id === ruleId && r.userId === userId);

    if (!rule) {
      throw new Error('Alert rule not found or access denied');
    }

    await this.watchlistRepo.updateAlertRule(ruleId, updates);
  }

  async deleteAlertRule(ruleId: string, userId: string): Promise<void> {
    // Verify user owns the alert rule through watchlist ownership
    const activeRules = await this.watchlistRepo.getActiveAlertRules();
    const rule = activeRules.find(r => r.id === ruleId && r.userId === userId);

    if (!rule) {
      throw new Error('Alert rule not found or access denied');
    }

    await this.watchlistRepo.deleteAlertRule(ruleId);
  }

  async getUserAlerts(userId: string, limit: number = 50): Promise<Alert[]> {
    return await this.watchlistRepo.getUserAlerts(userId, limit);
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await this.watchlistRepo.acknowledgeAlert(alertId, userId);
  }

  async deleteWatchlist(watchlistId: string, userId: string): Promise<void> {
    await this.watchlistRepo.deleteWatchlist(watchlistId, userId);
  }

  async getWatchlistPerformance(
    watchlistId: string,
    userId: string,
    days: number = 30
  ): Promise<{
    items: Array<{
      typeId: number;
      regionId: number;
      currentPrice: number;
      priceChange: number;
      priceChangePercent: number;
      volumeChange: number;
      targetBuyPrice?: number;
      targetSellPrice?: number;
    }>;
    summary: {
      totalItems: number;
      itemsAboveTarget: number;
      itemsBelowTarget: number;
      averagePriceChange: number;
    };
  }> {
    const watchlist = await this.watchlistRepo.getWatchlist(watchlistId, userId);
    if (!watchlist) {
      throw new Error('Watchlist not found or access denied');
    }

    const performanceItems = [];
    let totalPriceChange = 0;
    let itemsAboveTarget = 0;
    let itemsBelowTarget = 0;

    for (const item of watchlist.items) {
      try {
        // Get current market data
        const currentData = await this.marketDataRepo.getMarketData(item.regionId, item.typeId);

        // Get historical data for comparison
        const historicalData = await this.marketDataRepo.getHistoricalData(
          item.regionId,
          item.typeId,
          days
        );

        if (currentData && historicalData.length > 0) {
          const oldestData = historicalData[historicalData.length - 1];
          if (oldestData) {
            const priceChange = currentData.averagePrice - oldestData.average;
            const priceChangePercent = (priceChange / oldestData.average) * 100;
            const volumeChange = currentData.volume - oldestData.volume;

            // Check target price performance
            if (item.targetBuyPrice && currentData.averagePrice <= item.targetBuyPrice) {
              itemsBelowTarget++;
            }
            if (item.targetSellPrice && currentData.averagePrice >= item.targetSellPrice) {
              itemsAboveTarget++;
            }

            totalPriceChange += priceChangePercent;

            performanceItems.push({
              typeId: item.typeId,
              regionId: item.regionId,
              currentPrice: currentData.averagePrice,
              priceChange,
              priceChangePercent,
              volumeChange,
              targetBuyPrice: item.targetBuyPrice,
              targetSellPrice: item.targetSellPrice,
            });
          }
        }
      } catch (error) {
        console.error(`Error getting performance data for item ${item.typeId}:`, error);
        // Continue with other items even if one fails
      }
    }

    return {
      items: performanceItems,
      summary: {
        totalItems: watchlist.items.length,
        itemsAboveTarget,
        itemsBelowTarget,
        averagePriceChange:
          performanceItems.length > 0 ? totalPriceChange / performanceItems.length : 0,
      },
    };
  }

  // Method to check alerts and trigger notifications
  async checkAndTriggerAlerts(): Promise<Alert[]> {
    const activeRules = await this.watchlistRepo.getActiveAlertRules();
    const triggeredAlerts: Alert[] = [];

    for (const rule of activeRules) {
      try {
        const marketData = await this.marketDataRepo.getMarketData(rule.regionId, rule.typeId);

        if (!marketData) continue;

        let shouldTrigger = false;
        let message = '';

        switch (rule.condition) {
          case 'PRICE_ABOVE':
            if (marketData.averagePrice > rule.threshold) {
              shouldTrigger = true;
              message = `Price alert: ${rule.typeId} in region ${rule.regionId} is now ${marketData.averagePrice.toFixed(2)} ISK (above ${rule.threshold.toFixed(2)} ISK)`;
            }
            break;
          case 'PRICE_BELOW':
            if (marketData.averagePrice < rule.threshold) {
              shouldTrigger = true;
              message = `Price alert: ${rule.typeId} in region ${rule.regionId} is now ${marketData.averagePrice.toFixed(2)} ISK (below ${rule.threshold.toFixed(2)} ISK)`;
            }
            break;
          case 'VOLUME_ABOVE':
            if (marketData.volume > rule.threshold) {
              shouldTrigger = true;
              message = `Volume alert: ${rule.typeId} in region ${rule.regionId} volume is now ${marketData.volume} (above ${rule.threshold})`;
            }
            break;
          case 'VOLUME_BELOW':
            if (marketData.volume < rule.threshold) {
              shouldTrigger = true;
              message = `Volume alert: ${rule.typeId} in region ${rule.regionId} volume is now ${marketData.volume} (below ${rule.threshold})`;
            }
            break;
        }

        if (shouldTrigger) {
          const alert = await this.watchlistRepo.createAlert({
            userId: rule.userId,
            ruleId: rule.id,
            typeId: rule.typeId,
            regionId: rule.regionId,
            message,
            acknowledged: false,
          });

          triggeredAlerts.push(alert);
        }
      } catch (error) {
        console.error(`Error checking alert rule ${rule.id}:`, error);
        // Continue with other rules even if one fails
      }
    }

    return triggeredAlerts;
  }

  async getMarketChangeAnalysis(
    userId: string,
    days: number = 7
  ): Promise<{
    significantChanges: Array<{
      typeId: number;
      regionId: number;
      priceChange: number;
      priceChangePercent: number;
      volumeChange: number;
      trend: 'UPWARD' | 'DOWNWARD' | 'STABLE';
      significance: 'HIGH' | 'MEDIUM' | 'LOW';
    }>;
    summary: {
      totalItemsTracked: number;
      significantChanges: number;
      averageChange: number;
    };
  }> {
    const watchlists = await this.watchlistRepo.getUserWatchlists(userId);
    const allItems = watchlists.flatMap(w => w.items);
    const changes = [];
    let totalChange = 0;
    let significantChangeCount = 0;

    for (const item of allItems) {
      try {
        const historicalData = await this.marketDataRepo.getHistoricalData(
          item.regionId,
          item.typeId,
          days
        );

        if (historicalData.length >= 2) {
          const latest = historicalData[0];
          const oldest = historicalData[historicalData.length - 1];

          if (latest && oldest) {
            const priceChange = latest.average - oldest.average;
            const priceChangePercent = (priceChange / oldest.average) * 100;
            const volumeChange = latest.volume - oldest.volume;

            // Determine trend
            let trend: 'UPWARD' | 'DOWNWARD' | 'STABLE' = 'STABLE';
            if (Math.abs(priceChangePercent) > 1) {
              trend = priceChangePercent > 0 ? 'UPWARD' : 'DOWNWARD';
            }

            // Determine significance
            let significance: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
            const absChange = Math.abs(priceChangePercent);
            if (absChange > 20) {
              significance = 'HIGH';
              significantChangeCount++;
            } else if (absChange > 10) {
              significance = 'MEDIUM';
              significantChangeCount++;
            }

            totalChange += priceChangePercent;

            changes.push({
              typeId: item.typeId,
              regionId: item.regionId,
              priceChange,
              priceChangePercent,
              volumeChange,
              trend,
              significance,
            });
          }
        }
      } catch (error) {
        console.error(`Error analyzing market change for item ${item.typeId}:`, error);
      }
    }

    // Sort by significance and price change
    changes.sort((a, b) => {
      const significanceOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      if (significanceOrder[a.significance] !== significanceOrder[b.significance]) {
        return significanceOrder[b.significance] - significanceOrder[a.significance];
      }
      return Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent);
    });

    return {
      significantChanges: changes,
      summary: {
        totalItemsTracked: allItems.length,
        significantChanges: significantChangeCount,
        averageChange: allItems.length > 0 ? totalChange / allItems.length : 0,
      },
    };
  }
}
