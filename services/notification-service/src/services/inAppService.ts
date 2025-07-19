import { RedisClientType } from 'redis';
import { Notification } from '../../../shared/src/types';

export class InAppService {
  constructor(private redis: RedisClientType) {}

  async storeNotification(notification: Notification): Promise<void> {
    const key = `notifications:${notification.userId}`;

    // Store notification data
    await this.redis.hSet(`notification:${notification.id}`, {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      createdAt: notification.createdAt.toISOString(),
      data: JSON.stringify(notification.data || {}),
    });

    // Add to user's notification list (sorted by timestamp)
    await this.redis.zAdd(key, {
      score: notification.createdAt.getTime(),
      value: notification.id,
    });

    // Set expiration for individual notification (30 days)
    await this.redis.expire(`notification:${notification.id}`, 30 * 24 * 60 * 60);

    // Publish real-time notification
    await this.publishRealTimeNotification(notification);
  }

  async getNotifications(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    } = {}
  ): Promise<Notification[]> {
    const { limit = 50, offset = 0 } = options;
    const key = `notifications:${userId}`;

    // Get notification IDs (newest first)
    const notificationIds = await this.redis.zRevRange(key, offset, offset + limit - 1);

    if (notificationIds.length === 0) {
      return [];
    }

    // Get notification details
    const notifications: Notification[] = [];
    for (const id of notificationIds) {
      const data = await this.redis.hGetAll(`notification:${id}`);
      if (Object.keys(data).length > 0) {
        const notification: Notification = {
          id: data.id,
          userId: data.userId,
          type: data.type as any,
          title: data.title,
          message: data.message,
          priority: data.priority as any,
          channels: [], // In-app notifications don't need channel info
          createdAt: new Date(data.createdAt),
          readAt: data.readAt ? new Date(data.readAt) : undefined,
          data: data.data ? JSON.parse(data.data) : undefined,
        };

        // Filter unread if requested
        if (!options.unreadOnly || !notification.readAt) {
          notifications.push(notification);
        }
      }
    }

    return notifications;
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    // Verify notification belongs to user
    const data = await this.redis.hGetAll(`notification:${notificationId}`);
    if (!data.id || data.userId !== userId) {
      throw new Error('Notification not found or access denied');
    }

    // Mark as read
    await this.redis.hSet(`notification:${notificationId}`, 'readAt', new Date().toISOString());

    // Update unread count
    await this.updateUnreadCount(userId);
  }

  async markAllAsRead(userId: string): Promise<void> {
    const key = `notifications:${userId}`;
    const notificationIds = await this.redis.zRange(key, 0, -1);

    // Mark all notifications as read
    const pipeline = this.redis.multi();
    for (const id of notificationIds) {
      pipeline.hSet(`notification:${id}`, 'readAt', new Date().toISOString());
    }
    await pipeline.exec();

    // Reset unread count
    await this.redis.set(`unread_count:${userId}`, '0');
  }

  async getUnreadCount(userId: string): Promise<number> {
    const count = await this.redis.get(`unread_count:${userId}`);
    return count ? parseInt(count, 10) : 0;
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    // Verify notification belongs to user
    const data = await this.redis.hGetAll(`notification:${notificationId}`);
    if (!data.id || data.userId !== userId) {
      throw new Error('Notification not found or access denied');
    }

    // Remove from user's notification list
    await this.redis.zRem(`notifications:${userId}`, notificationId);

    // Delete notification data
    await this.redis.del(`notification:${notificationId}`);

    // Update unread count if it was unread
    if (!data.readAt) {
      await this.updateUnreadCount(userId);
    }
  }

  async cleanupOldNotifications(daysOld: number = 30): Promise<number> {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    let cleanedCount = 0;

    // Get all user notification keys
    const userKeys = await this.redis.keys('notifications:*');

    for (const key of userKeys) {
      // Remove old notifications from sorted set
      const removed = await this.redis.zRemRangeByScore(key, 0, cutoffTime);
      cleanedCount += removed;
    }

    return cleanedCount;
  }

  private async updateUnreadCount(userId: string): Promise<void> {
    const key = `notifications:${userId}`;
    const notificationIds = await this.redis.zRange(key, 0, -1);

    let unreadCount = 0;
    for (const id of notificationIds) {
      const readAt = await this.redis.hGet(`notification:${id}`, 'readAt');
      if (!readAt) {
        unreadCount++;
      }
    }

    await this.redis.set(`unread_count:${userId}`, unreadCount.toString());
  }

  private async publishRealTimeNotification(notification: Notification): Promise<void> {
    // Publish to Redis pub/sub for real-time updates
    const channel = `user:${notification.userId}:notifications`;
    const message = JSON.stringify({
      type: 'NEW_NOTIFICATION',
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        createdAt: notification.createdAt,
      },
    });

    await this.redis.publish(channel, message);
  }

  async subscribeToUserNotifications(
    userId: string,
    callback: (notification: any) => void
  ): Promise<() => void> {
    const channel = `user:${userId}:notifications`;
    const subscriber = this.redis.duplicate();

    await subscriber.connect();
    await subscriber.subscribe(channel, message => {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (error) {
        console.error('Error parsing real-time notification:', error);
      }
    });

    // Return unsubscribe function
    return async () => {
      await subscriber.unsubscribe(channel);
      await subscriber.quit();
    };
  }

  async getBatchedNotifications(userId: string, batchSize: number = 10): Promise<Notification[]> {
    const key = `notifications:${userId}`;

    // Get recent unread notifications
    const notificationIds = await this.redis.zRevRange(key, 0, batchSize - 1);
    const notifications: Notification[] = [];

    for (const id of notificationIds) {
      const data = await this.redis.hGetAll(`notification:${id}`);
      if (Object.keys(data).length > 0 && !data.readAt) {
        notifications.push({
          id: data.id,
          userId: data.userId,
          type: data.type as any,
          title: data.title,
          message: data.message,
          priority: data.priority as any,
          channels: [],
          createdAt: new Date(data.createdAt),
          data: data.data ? JSON.parse(data.data) : undefined,
        });
      }
    }

    return notifications;
  }
}
