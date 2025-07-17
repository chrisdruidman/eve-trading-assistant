import { Pool } from 'pg';
import {
  UserPreferences,
  NotificationPreferences,
  TradingPreferences,
} from '../../../../shared/src/types';

export interface UserPreferencesRecord {
  user_id: string;
  theme: 'light' | 'dark';
  email_notifications: boolean;
  in_app_notifications: boolean;
  push_notifications: boolean;
  risk_tolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  default_budget: number;
  preferred_regions: number[];
  created_at: Date;
  updated_at?: Date;
}

export class UserPreferencesRepository {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/eve_trading_dev',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async findByUserId(userId: string): Promise<UserPreferences | null> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT user_id, theme, email_notifications, in_app_notifications, push_notifications,
               risk_tolerance, default_budget, preferred_regions, created_at, updated_at
        FROM user_preferences
        WHERE user_id = $1
      `;

      const result = await client.query(query, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToPreferences(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async create(userId: string, preferences: UserPreferences): Promise<UserPreferences> {
    const client = await this.pool.connect();

    try {
      const query = `
        INSERT INTO user_preferences (
          user_id, theme, email_notifications, in_app_notifications, push_notifications,
          risk_tolerance, default_budget, preferred_regions, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
        RETURNING user_id, theme, email_notifications, in_app_notifications, push_notifications,
                  risk_tolerance, default_budget, preferred_regions, created_at, updated_at
      `;

      const values = [
        userId,
        preferences.theme,
        preferences.notifications.email,
        preferences.notifications.inApp,
        preferences.notifications.push,
        preferences.trading.riskTolerance,
        preferences.trading.defaultBudget,
        JSON.stringify(preferences.trading.preferredRegions),
      ];

      const result = await client.query(query, values);
      return this.mapRowToPreferences(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async update(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<UserPreferences | null> {
    const client = await this.pool.connect();

    try {
      const setParts: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (preferences.theme !== undefined) {
        setParts.push(`theme = $${paramIndex++}`);
        values.push(preferences.theme);
      }

      if (preferences.notifications?.email !== undefined) {
        setParts.push(`email_notifications = $${paramIndex++}`);
        values.push(preferences.notifications.email);
      }

      if (preferences.notifications?.inApp !== undefined) {
        setParts.push(`in_app_notifications = $${paramIndex++}`);
        values.push(preferences.notifications.inApp);
      }

      if (preferences.notifications?.push !== undefined) {
        setParts.push(`push_notifications = $${paramIndex++}`);
        values.push(preferences.notifications.push);
      }

      if (preferences.trading?.riskTolerance !== undefined) {
        setParts.push(`risk_tolerance = $${paramIndex++}`);
        values.push(preferences.trading.riskTolerance);
      }

      if (preferences.trading?.defaultBudget !== undefined) {
        setParts.push(`default_budget = $${paramIndex++}`);
        values.push(preferences.trading.defaultBudget);
      }

      if (preferences.trading?.preferredRegions !== undefined) {
        setParts.push(`preferred_regions = $${paramIndex++}`);
        values.push(JSON.stringify(preferences.trading.preferredRegions));
      }

      if (setParts.length === 0) {
        return await this.findByUserId(userId);
      }

      setParts.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(userId);

      const query = `
        UPDATE user_preferences
        SET ${setParts.join(', ')}
        WHERE user_id = $${paramIndex}
        RETURNING user_id, theme, email_notifications, in_app_notifications, push_notifications,
                  risk_tolerance, default_budget, preferred_regions, created_at, updated_at
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToPreferences(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async createDefault(userId: string): Promise<UserPreferences> {
    const defaultPreferences: UserPreferences = {
      theme: 'light',
      notifications: {
        email: true,
        inApp: true,
        push: false,
      },
      trading: {
        riskTolerance: 'MODERATE',
        defaultBudget: 1000000, // 1M ISK default
        preferredRegions: [10000002], // The Forge (Jita)
      },
    };

    return await this.create(userId, defaultPreferences);
  }

  async delete(userId: string): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      const query = `DELETE FROM user_preferences WHERE user_id = $1`;
      const result = await client.query(query, [userId]);

      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  private mapRowToPreferences(row: any): UserPreferences {
    return {
      theme: row.theme,
      notifications: {
        email: row.email_notifications,
        inApp: row.in_app_notifications,
        push: row.push_notifications,
      },
      trading: {
        riskTolerance: row.risk_tolerance,
        defaultBudget: row.default_budget,
        preferredRegions: Array.isArray(row.preferred_regions)
          ? row.preferred_regions
          : JSON.parse(row.preferred_regions || '[]'),
      },
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
