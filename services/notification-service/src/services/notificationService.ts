import { RedisClientType } from 'redis';
import {
  Notification,
  NotificationChannel,
  NotificationPreferences,
} from '../../../shared/dist/types';
import { NotificationRepository } from '../models/notificationRepository';
import { PreferenceRepository, NotificationSchedule } from '../models/preferenceRepository';
import { EmailService } from './emailService';
import { InAppService } from './inAppService';

export interface NotificationRequest {
  userId: string;
  type: 'MARKET_ALERT' | 'TRADING_OPPORTUNITY' | 'SYSTEM_UPDATE' | 'ACCOUNT_NOTICE';
  title: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  data?: any;
  channels?: ('EMAIL' | 'IN_APP' | 'PUSH')[];
}

export class NotificationService {
  private schedulerInterval?: NodeJS.Timeout | undefined;
  private batchProcessorInterval?: NodeJS.Timeout | undefined;

  constructor(
    private notificationRepository: NotificationRepository,
    private preferenceRepository: PreferenceRepository,
    private emailService: EmailService,
    private inAppService: InAppService,
    private redis: RedisClientType
  ) {}

  async sendNotification(
    request: NotificationRequest
  ): Promise<{ success: boolean; notificationId?: string; error?: string }> {
    try {
      // Get user preferences
      const preferences = await this.preferenceRepository.getPreferences(request.userId);
      const schedule = await this.preferenceRepository.getSchedule(request.userId);

      // Check daily limits
      const dailyCount = await this.preferenceRepository.getDailyNotificationCount(request.userId);
      if (dailyCount >= schedule.maxDailyNotifications) {
        return { success: false, error: 'Daily notification limit exceeded' };
      }

      // Check quiet hours for non-urgent notifications
      if (request.priority !== 'URGENT') {
        const isQuietHours = await this.preferenceRepository.isInQuietHours(request.userId);
        if (isQuietHours) {
          // Queue for later delivery
          await this.queueForLaterDelivery(request, schedule);
          return { success: true };
        }
      }

      // Determine channels based on preferences and request
      const channels = this.determineChannels(request, preferences);

      // Create notification
      const notification = await this.notificationRepository.create({
        userId: request.userId,
        type: request.type,
        title: request.title,
        message: request.message,
        priority: request.priority,
        channels,
        data: request.data,
      });

      // Send through appropriate channels
      await this.deliverNotification(notification);

      return { success: true, notificationId: notification.id };
    } catch (error) {
      console.error('Failed to send notification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendBatchNotification(
    requests: NotificationRequest[]
  ): Promise<{ success: boolean; results: any[] }> {
    const results = [];

    for (const request of requests) {
      const result = await this.sendNotification(request);
      results.push({ request, result });
    }

    return { success: true, results };
  }

  async getNotifications(
    userId: string,
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
  ): Promise<Notification[]> {
    return this.notificationRepository.findByUserId(userId, options);
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepository.markAsRead(notificationId, userId);
    await this.inAppService.markAsRead(notificationId, userId);
  }

  async markAllAsRead(userId: string): Promise<void> {
    // Mark all in database
    const notifications = await this.notificationRepository.findByUserId(userId, {
      unreadOnly: true,
    });
    for (const notification of notifications) {
      await this.notificationRepository.markAsRead(notification.id, userId);
    }

    // Mark all in Redis
    await this.inAppService.markAllAsRead(userId);
  }

  async updatePreferences(userId: string, preferences: NotificationPreferences): Promise<void> {
    await this.preferenceRepository.updatePreferences(userId, preferences);
  }

  async updateSchedule(schedule: NotificationSchedule): Promise<void> {
    await this.preferenceRepository.updateSchedule(schedule);
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.inAppService.getUnreadCount(userId);
  }

  async startScheduler(): Promise<void> {
    // Process pending notifications every 30 seconds
    this.schedulerInterval = setInterval(async () => {
      try {
        await this.processPendingNotifications();
      } catch (error) {
        console.error('Error processing pending notifications:', error);
      }
    }, 30000);

    // Process batched notifications every 5 minutes
    this.batchProcessorInterval = setInterval(async () => {
      try {
        await this.processBatchedNotifications();
      } catch (error) {
        console.error('Error processing batched notifications:', error);
      }
    }, 300000);

    console.log('Notification scheduler started');
  }

  async stopScheduler(): Promise<void> {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = undefined;
    }

    if (this.batchProcessorInterval) {
      clearInterval(this.batchProcessorInterval);
      this.batchProcessorInterval = undefined;
    }

    console.log('Notification scheduler stopped');
  }

  private determineChannels(
    request: NotificationRequest,
    preferences: NotificationPreferences
  ): NotificationChannel[] {
    const channels: NotificationChannel[] = [];

    // Use requested channels if specified, otherwise use preferences
    const requestedChannels = request.channels || [];

    if (requestedChannels.length === 0) {
      // Use user preferences
      if (preferences.email) requestedChannels.push('EMAIL');
      if (preferences.inApp) requestedChannels.push('IN_APP');
      if (preferences.push) requestedChannels.push('PUSH');
    }

    // Always include in-app for urgent notifications
    if (request.priority === 'URGENT' && !requestedChannels.includes('IN_APP')) {
      requestedChannels.push('IN_APP');
    }

    for (const channelType of requestedChannels) {
      channels.push({
        type: channelType,
        address: this.getChannelAddress(channelType, request.userId),
        delivered: false,
      });
    }

    return channels;
  }

  private getChannelAddress(channelType: string, userId: string): string {
    switch (channelType) {
      case 'EMAIL':
        return `user:${userId}:email`; // Will be resolved later
      case 'IN_APP':
        return `user:${userId}:app`;
      case 'PUSH':
        return `user:${userId}:push`;
      default:
        return '';
    }
  }

  private async deliverNotification(notification: Notification): Promise<void> {
    const deliveryPromises = notification.channels.map(async (channel: NotificationChannel) => {
      try {
        switch (channel.type) {
          case 'EMAIL':
            await this.deliverEmail(notification);
            break;
          case 'IN_APP':
            await this.deliverInApp(notification);
            break;
          case 'PUSH':
            await this.deliverPush(notification);
            break;
        }

        await this.notificationRepository.updateChannelDelivery(
          notification.id,
          channel.type,
          true
        );
      } catch (error) {
        console.error(`Failed to deliver ${channel.type} notification:`, error);
        await this.notificationRepository.updateChannelDelivery(
          notification.id,
          channel.type,
          false,
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    });

    await Promise.allSettled(deliveryPromises);
    await this.notificationRepository.markAsSent(notification.id);
  }

  private async deliverEmail(notification: Notification): Promise<void> {
    // Get user email from user service (simplified for now)
    const userEmail = await this.getUserEmail(notification.userId);
    if (!userEmail) {
      throw new Error('User email not found');
    }

    const result = await this.emailService.sendNotification(notification, userEmail);
    if (!result.success) {
      throw new Error(result.error || 'Email delivery failed');
    }
  }

  private async deliverInApp(notification: Notification): Promise<void> {
    await this.inAppService.storeNotification(notification);
  }

  private async deliverPush(notification: Notification): Promise<void> {
    // Push notification implementation would go here
    // For now, just log that it would be sent
    console.log(
      `Push notification would be sent to user ${notification.userId}: ${notification.title}`
    );
  }

  private async getUserEmail(userId: string): Promise<string | null> {
    // This would typically call the user service
    // For now, return a placeholder
    return `user-${userId}@example.com`;
  }

  private async queueForLaterDelivery(
    request: NotificationRequest,
    _schedule: NotificationSchedule
  ): Promise<void> {
    const queueKey = `notification_queue:${request.userId}`;
    const queueData = {
      ...request,
      queuedAt: new Date().toISOString(),
    };

    await this.redis.lPush(queueKey, JSON.stringify(queueData));
  }

  private async processPendingNotifications(): Promise<void> {
    const notifications = await this.notificationRepository.getPendingNotifications(50);

    for (const notification of notifications) {
      await this.deliverNotification(notification);
    }
  }

  private async processBatchedNotifications(): Promise<void> {
    // Get all user queue keys
    const queueKeys = await this.redis.keys('notification_queue:*');

    for (const queueKey of queueKeys) {
      const userId = queueKey.split(':')[1];
      if (!userId) continue;

      const schedule = await this.preferenceRepository.getSchedule(userId);

      if (!schedule.enableBatching) {
        continue;
      }

      // Check if it's time to send batched notifications
      const isQuietHours = await this.preferenceRepository.isInQuietHours(userId);
      if (isQuietHours) {
        continue;
      }

      // Get queued notifications
      const queuedItems = await this.redis.lRange(queueKey, 0, -1);
      if (queuedItems.length === 0) {
        continue;
      }

      // Parse and send as batch
      const requests = queuedItems.map(item => JSON.parse(item));
      await this.sendBatchNotification(requests);

      // Clear the queue
      await this.redis.del(queueKey);
    }
  }

  async cleanupOldNotifications(
    daysOld: number = 30
  ): Promise<{ database: number; redis: number }> {
    const databaseCleaned = await this.notificationRepository.deleteOldNotifications(daysOld);
    const redisCleaned = await this.inAppService.cleanupOldNotifications(daysOld);

    return { database: databaseCleaned, redis: redisCleaned };
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    return this.preferenceRepository.getPreferences(userId);
  }

  async getSchedule(userId: string): Promise<NotificationSchedule> {
    return this.preferenceRepository.getSchedule(userId);
  }
}
