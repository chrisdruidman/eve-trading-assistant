import { Pool } from 'pg';
import { Notification, NotificationChannel } from '../../../shared/dist/types';

export class NotificationRepository {
  constructor(private db: Pool) {}

  async create(notification: Omit<Notification, 'id' | 'createdAt'>): Promise<Notification> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Insert notification
      const notificationResult = await client.query(
        `INSERT INTO notifications (user_id, type, title, message, priority, data, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         RETURNING id, created_at`,
        [
          notification.userId,
          notification.type,
          notification.title,
          notification.message,
          notification.priority,
          JSON.stringify(notification.data || {}),
        ]
      );

      const notificationId = notificationResult.rows[0].id;
      const createdAt = notificationResult.rows[0].created_at;

      // Insert notification channels
      for (const channel of notification.channels) {
        await client.query(
          `INSERT INTO notification_channels (notification_id, type, address, delivered)
           VALUES ($1, $2, $3, $4)`,
          [notificationId, channel.type, channel.address, channel.delivered]
        );
      }

      await client.query('COMMIT');

      return {
        ...notification,
        id: notificationId,
        createdAt,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<Notification | null> {
    const result = await this.db.query(
      `SELECT n.*, 
              COALESCE(
                json_agg(
                  json_build_object(
                    'type', nc.type,
                    'address', nc.address,
                    'delivered', nc.delivered,
                    'deliveredAt', nc.delivered_at,
                    'error', nc.error
                  )
                ) FILTER (WHERE nc.id IS NOT NULL), 
                '[]'
              ) as channels
       FROM notifications n
       LEFT JOIN notification_channels nc ON n.id = nc.notification_id
       WHERE n.id = $1
       GROUP BY n.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      priority: row.priority,
      channels: row.channels,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      readAt: row.read_at,
      data: row.data,
    };
  }

  async findByUserId(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    } = {}
  ): Promise<Notification[]> {
    const { limit = 50, offset = 0, unreadOnly = false } = options;

    let query = `
      SELECT n.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'type', nc.type,
                   'address', nc.address,
                   'delivered', nc.delivered,
                   'deliveredAt', nc.delivered_at,
                   'error', nc.error
                 )
               ) FILTER (WHERE nc.id IS NOT NULL), 
               '[]'
             ) as channels
      FROM notifications n
      LEFT JOIN notification_channels nc ON n.id = nc.notification_id
      WHERE n.user_id = $1
    `;

    const params: any[] = [userId];

    if (unreadOnly) {
      query += ' AND n.read_at IS NULL';
    }

    query += `
      GROUP BY n.id
      ORDER BY n.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const result = await this.db.query(query, params);

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      priority: row.priority,
      channels: row.channels,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      readAt: row.read_at,
      data: row.data,
    }));
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await this.db.query('UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2', [
      id,
      userId,
    ]);
  }

  async markAsSent(id: string): Promise<void> {
    await this.db.query('UPDATE notifications SET sent_at = NOW() WHERE id = $1', [id]);
  }

  async updateChannelDelivery(
    notificationId: string,
    channelType: string,
    delivered: boolean,
    error?: string
  ): Promise<void> {
    await this.db.query(
      `UPDATE notification_channels 
       SET delivered = $3, delivered_at = CASE WHEN $3 THEN NOW() ELSE NULL END, error = $4
       WHERE notification_id = $1 AND type = $2`,
      [notificationId, channelType, delivered, error]
    );
  }

  async getPendingNotifications(limit: number = 100): Promise<Notification[]> {
    const result = await this.db.query(
      `SELECT n.*, 
              COALESCE(
                json_agg(
                  json_build_object(
                    'type', nc.type,
                    'address', nc.address,
                    'delivered', nc.delivered,
                    'deliveredAt', nc.delivered_at,
                    'error', nc.error
                  )
                ) FILTER (WHERE nc.id IS NOT NULL), 
                '[]'
              ) as channels
       FROM notifications n
       LEFT JOIN notification_channels nc ON n.id = nc.notification_id
       WHERE n.sent_at IS NULL
       GROUP BY n.id
       ORDER BY n.priority DESC, n.created_at ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      priority: row.priority,
      channels: row.channels,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      readAt: row.read_at,
      data: row.data,
    }));
  }

  async deleteOldNotifications(daysOld: number): Promise<number> {
    const result = await this.db.query(
      'DELETE FROM notifications WHERE created_at < NOW() - INTERVAL $1 DAY',
      [daysOld]
    );
    return result.rowCount || 0;
  }
}
