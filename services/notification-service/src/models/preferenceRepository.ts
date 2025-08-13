import { Pool } from 'pg';
import { NotificationPreferences } from '../../../shared/dist/types';

export interface NotificationSchedule {
  userId: string;
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string; // HH:MM format
  timezone: string;
  maxDailyNotifications: number;
  enableBatching: boolean;
  batchIntervalMinutes: number;
}

export class PreferenceRepository {
  constructor(private db: Pool) {}

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const result = await this.db.query(
      'SELECT email, in_app, push FROM notification_preferences WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Return default preferences
      return {
        email: true,
        inApp: true,
        push: false,
      };
    }

    const row = result.rows[0];
    return {
      email: row.email,
      inApp: row.in_app,
      push: row.push,
    };
  }

  async updatePreferences(userId: string, preferences: NotificationPreferences): Promise<void> {
    await this.db.query(
      `INSERT INTO notification_preferences (user_id, email, in_app, push, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         email = EXCLUDED.email,
         in_app = EXCLUDED.in_app,
         push = EXCLUDED.push,
         updated_at = EXCLUDED.updated_at`,
      [userId, preferences.email, preferences.inApp, preferences.push]
    );
  }

  async getSchedule(userId: string): Promise<NotificationSchedule> {
    const result = await this.db.query(
      `SELECT quiet_hours_start, quiet_hours_end, timezone, 
              max_daily_notifications, enable_batching, batch_interval_minutes
       FROM notification_schedules WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Return default schedule
      return {
        userId,
        timezone: 'UTC',
        maxDailyNotifications: 50,
        enableBatching: false,
        batchIntervalMinutes: 60,
      };
    }

    const row = result.rows[0];
    return {
      userId,
      quietHoursStart: row.quiet_hours_start,
      quietHoursEnd: row.quiet_hours_end,
      timezone: row.timezone,
      maxDailyNotifications: row.max_daily_notifications,
      enableBatching: row.enable_batching,
      batchIntervalMinutes: row.batch_interval_minutes,
    };
  }

  async updateSchedule(schedule: NotificationSchedule): Promise<void> {
    await this.db.query(
      `INSERT INTO notification_schedules (
         user_id, quiet_hours_start, quiet_hours_end, timezone,
         max_daily_notifications, enable_batching, batch_interval_minutes, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         quiet_hours_start = EXCLUDED.quiet_hours_start,
         quiet_hours_end = EXCLUDED.quiet_hours_end,
         timezone = EXCLUDED.timezone,
         max_daily_notifications = EXCLUDED.max_daily_notifications,
         enable_batching = EXCLUDED.enable_batching,
         batch_interval_minutes = EXCLUDED.batch_interval_minutes,
         updated_at = EXCLUDED.updated_at`,
      [
        schedule.userId,
        schedule.quietHoursStart,
        schedule.quietHoursEnd,
        schedule.timezone,
        schedule.maxDailyNotifications,
        schedule.enableBatching,
        schedule.batchIntervalMinutes,
      ]
    );
  }

  async getDailyNotificationCount(userId: string): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) as count
       FROM notifications
       WHERE user_id = $1 AND created_at >= CURRENT_DATE`,
      [userId]
    );

    return parseInt(result.rows[0].count, 10);
  }

  async isInQuietHours(userId: string): Promise<boolean> {
    const schedule = await this.getSchedule(userId);

    if (!schedule.quietHoursStart || !schedule.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const userTime = new Intl.DateTimeFormat('en-US', {
      timeZone: schedule.timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    }).format(now);

    const currentTime = userTime.replace(':', '');
    const quietStart = schedule.quietHoursStart.replace(':', '');
    const quietEnd = schedule.quietHoursEnd.replace(':', '');

    // Handle quiet hours that span midnight
    if (quietStart > quietEnd) {
      return currentTime >= quietStart || currentTime <= quietEnd;
    } else {
      return currentTime >= quietStart && currentTime <= quietEnd;
    }
  }
}
