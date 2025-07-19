import { AlertMonitoringService } from '../../services/alertMonitoringService';
import { WatchlistService } from '../../services/watchlistService';
import { Alert } from '../../../../../shared/src/types';

// Mock the watchlist service
jest.mock('../../services/watchlistService');

describe('AlertMonitoringService', () => {
  let alertMonitoringService: AlertMonitoringService;
  let mockWatchlistService: jest.Mocked<WatchlistService>;

  beforeEach(() => {
    mockWatchlistService = new WatchlistService(
      {} as any,
      {} as any
    ) as jest.Mocked<WatchlistService>;
    alertMonitoringService = new AlertMonitoringService(mockWatchlistService, 1000); // 1 second for testing

    // Clear all timers
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    alertMonitoringService.stop();
    jest.useRealTimers();
  });

  describe('start', () => {
    it('should start the monitoring service', () => {
      expect(alertMonitoringService.isServiceRunning()).toBe(false);

      alertMonitoringService.start();

      expect(alertMonitoringService.isServiceRunning()).toBe(true);
    });

    it('should not start if already running', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      alertMonitoringService.start();
      alertMonitoringService.start(); // Try to start again

      expect(consoleSpy).toHaveBeenCalledWith('Alert monitoring service is already running');
      consoleSpy.mockRestore();
    });

    it('should run initial check and schedule periodic checks', async () => {
      const mockAlerts: Alert[] = [
        {
          id: 'alert-1',
          userId: 'user-1',
          ruleId: 'rule-1',
          typeId: 34,
          regionId: 10000002,
          message: 'Test alert',
          triggeredAt: new Date(),
          acknowledged: false,
        },
      ];

      mockWatchlistService.checkAndTriggerAlerts.mockResolvedValue(mockAlerts);

      alertMonitoringService.start();

      // Wait for initial check
      await Promise.resolve();

      expect(mockWatchlistService.checkAndTriggerAlerts).toHaveBeenCalledTimes(1);

      // Fast-forward time to trigger scheduled check
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(mockWatchlistService.checkAndTriggerAlerts).toHaveBeenCalledTimes(2);
    });
  });

  describe('stop', () => {
    it('should stop the monitoring service', () => {
      alertMonitoringService.start();
      expect(alertMonitoringService.isServiceRunning()).toBe(true);

      alertMonitoringService.stop();

      expect(alertMonitoringService.isServiceRunning()).toBe(false);
    });

    it('should not stop if not running', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      alertMonitoringService.stop();

      expect(consoleSpy).toHaveBeenCalledWith('Alert monitoring service is not running');
      consoleSpy.mockRestore();
    });
  });

  describe('triggerManualCheck', () => {
    it('should trigger manual alert check', async () => {
      const mockAlerts: Alert[] = [
        {
          id: 'alert-1',
          userId: 'user-1',
          ruleId: 'rule-1',
          typeId: 34,
          regionId: 10000002,
          message: 'Test alert',
          triggeredAt: new Date(),
          acknowledged: false,
        },
      ];

      mockWatchlistService.checkAndTriggerAlerts.mockResolvedValue(mockAlerts);

      const result = await alertMonitoringService.triggerManualCheck();

      expect(mockWatchlistService.checkAndTriggerAlerts).toHaveBeenCalled();
      expect(result).toEqual(mockAlerts);
    });
  });

  describe('getStatus', () => {
    it('should return correct status when not running', () => {
      const status = alertMonitoringService.getStatus();

      expect(status).toEqual({
        isRunning: false,
        checkIntervalMs: 1000,
        nextCheckIn: undefined,
      });
    });

    it('should return correct status when running', () => {
      alertMonitoringService.start();
      const status = alertMonitoringService.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.checkIntervalMs).toBe(1000);
      expect(status.nextCheckIn).toBe(1000);
    });
  });

  describe('updateCheckInterval', () => {
    it('should update check interval', () => {
      alertMonitoringService.updateCheckInterval(2000);

      const status = alertMonitoringService.getStatus();
      expect(status.checkIntervalMs).toBe(2000);
    });

    it('should restart service if it was running', () => {
      alertMonitoringService.start();
      expect(alertMonitoringService.isServiceRunning()).toBe(true);

      alertMonitoringService.updateCheckInterval(2000);

      expect(alertMonitoringService.isServiceRunning()).toBe(true);
      const status = alertMonitoringService.getStatus();
      expect(status.checkIntervalMs).toBe(2000);
    });

    it('should throw error for invalid interval', () => {
      expect(() => {
        alertMonitoringService.updateCheckInterval(30000); // Less than 1 minute
      }).toThrow('Check interval must be at least 60000ms (1 minute)');
    });
  });
});
