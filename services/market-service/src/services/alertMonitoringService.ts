import { WatchlistService } from './watchlistService';
import { Alert } from '../../../shared/src/types';

export class AlertMonitoringService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private watchlistService: WatchlistService,
    private checkIntervalMs: number = 5 * 60 * 1000 // 5 minutes default
  ) {}

  start(): void {
    if (this.isRunning) {
      console.log('Alert monitoring service is already running');
      return;
    }

    console.log('Starting alert monitoring service...');
    this.isRunning = true;

    // Run initial check
    this.checkAlerts().catch(error => {
      console.error('Error in initial alert check:', error);
    });

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.checkAlerts().catch(error => {
        console.error('Error in scheduled alert check:', error);
      });
    }, this.checkIntervalMs);

    console.log(`Alert monitoring service started with ${this.checkIntervalMs}ms interval`);
  }

  stop(): void {
    if (!this.isRunning) {
      console.log('Alert monitoring service is not running');
      return;
    }

    console.log('Stopping alert monitoring service...');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('Alert monitoring service stopped');
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }

  private async checkAlerts(): Promise<void> {
    try {
      console.log('Checking for triggered alerts...');
      const triggeredAlerts = await this.watchlistService.checkAndTriggerAlerts();

      if (triggeredAlerts.length > 0) {
        console.log(`Found ${triggeredAlerts.length} triggered alerts`);

        // Process each triggered alert
        for (const alert of triggeredAlerts) {
          await this.processTriggeredAlert(alert);
        }
      } else {
        console.log('No alerts triggered');
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }

  private async processTriggeredAlert(alert: Alert): Promise<void> {
    try {
      console.log(`Processing alert ${alert.id} for user ${alert.userId}`);

      // Here you would typically:
      // 1. Send notification to notification service
      // 2. Log the alert for monitoring
      // 3. Update any metrics

      // For now, we'll just log the alert details
      console.log(`Alert triggered: ${alert.message}`);

      // In a real implementation, you might call the notification service:
      // await this.notificationService.sendAlert(alert);
    } catch (error) {
      console.error(`Error processing alert ${alert.id}:`, error);
    }
  }

  // Method to manually trigger alert check (useful for testing)
  async triggerManualCheck(): Promise<Alert[]> {
    console.log('Manual alert check triggered');
    return await this.watchlistService.checkAndTriggerAlerts();
  }

  // Method to get service status
  getStatus(): {
    isRunning: boolean;
    checkIntervalMs: number;
    nextCheckIn?: number;
  } {
    const status: {
      isRunning: boolean;
      checkIntervalMs: number;
      nextCheckIn?: number;
    } = {
      isRunning: this.isRunning,
      checkIntervalMs: this.checkIntervalMs,
    };

    if (this.isRunning && this.intervalId) {
      // This is an approximation since we can't get exact timing from setInterval
      status.nextCheckIn = this.checkIntervalMs;
    }

    return status;
  }

  // Method to update check interval (requires restart)
  updateCheckInterval(newIntervalMs: number): void {
    if (newIntervalMs < 60000) {
      // Minimum 1 minute
      throw new Error('Check interval must be at least 60000ms (1 minute)');
    }

    const wasRunning = this.isRunning;

    if (wasRunning) {
      this.stop();
    }

    this.checkIntervalMs = newIntervalMs;

    if (wasRunning) {
      this.start();
    }

    console.log(`Alert monitoring interval updated to ${newIntervalMs}ms`);
  }
}
