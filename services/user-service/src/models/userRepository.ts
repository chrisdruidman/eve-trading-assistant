import { Pool } from 'pg';
import { User } from '../../../../shared/src/types';

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  created_at: Date;
  updated_at?: Date;
  deleted_at?: Date;
}

export class UserRepository {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/eve_trading_dev',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async findById(id: string): Promise<UserRecord | null> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT id, email, username, created_at, updated_at, deleted_at
        FROM users
        WHERE id = $1 AND deleted_at IS NULL
      `;

      const result = await client.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT id, email, username, created_at, updated_at, deleted_at
        FROM users
        WHERE email = $1 AND deleted_at IS NULL
      `;

      const result = await client.query(query, [email]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async updateProfile(
    id: string,
    updates: { username?: string; email?: string }
  ): Promise<UserRecord | null> {
    const client = await this.pool.connect();

    try {
      const setParts: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.username !== undefined) {
        setParts.push(`username = $${paramIndex++}`);
        values.push(updates.username);
      }

      if (updates.email !== undefined) {
        setParts.push(`email = $${paramIndex++}`);
        values.push(updates.email);
      }

      if (setParts.length === 0) {
        return await this.findById(id);
      }

      setParts.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `
        UPDATE users
        SET ${setParts.join(', ')}
        WHERE id = $${paramIndex} AND deleted_at IS NULL
        RETURNING id, email, username, created_at, updated_at, deleted_at
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async softDelete(id: string): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      const query = `
        UPDATE users
        SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
      `;

      const result = await client.query(query, [id]);
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  async hardDelete(id: string): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      // Start transaction for GDPR compliance - delete all related data
      await client.query('BEGIN');

      // Delete user preferences
      await client.query('DELETE FROM user_preferences WHERE user_id = $1', [id]);

      // Delete EVE characters
      await client.query('DELETE FROM eve_characters WHERE user_id = $1', [id]);

      // Delete trading plans
      await client.query('DELETE FROM trading_plans WHERE user_id = $1', [id]);

      // Delete watchlists
      await client.query('DELETE FROM watchlists WHERE user_id = $1', [id]);

      // Delete notifications
      await client.query('DELETE FROM notifications WHERE user_id = $1', [id]);

      // Delete sessions
      await client.query('DELETE FROM user_sessions WHERE user_id = $1', [id]);

      // Finally delete the user
      const result = await client.query('DELETE FROM users WHERE id = $1', [id]);

      await client.query('COMMIT');
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getUserDataForExport(id: string): Promise<any> {
    const client = await this.pool.connect();

    try {
      // Get all user data for GDPR export
      const userData: any = {};

      // User profile
      const userResult = await client.query(
        'SELECT id, email, username, created_at, updated_at FROM users WHERE id = $1',
        [id]
      );
      userData.profile = userResult.rows[0] || null;

      // User preferences
      const prefsResult = await client.query('SELECT * FROM user_preferences WHERE user_id = $1', [
        id,
      ]);
      userData.preferences = prefsResult.rows[0] || null;

      // EVE characters (without sensitive API keys)
      const charactersResult = await client.query(
        'SELECT character_id, character_name, corporation_id, alliance_id, scopes, last_sync FROM eve_characters WHERE user_id = $1',
        [id]
      );
      userData.eveCharacters = charactersResult.rows;

      // Trading plans
      const plansResult = await client.query(
        'SELECT id, budget, risk_tolerance, created_at, status FROM trading_plans WHERE user_id = $1',
        [id]
      );
      userData.tradingPlans = plansResult.rows;

      // Watchlists
      const watchlistsResult = await client.query(
        'SELECT id, name, created_at FROM watchlists WHERE user_id = $1',
        [id]
      );
      userData.watchlists = watchlistsResult.rows;

      return userData;
    } finally {
      client.release();
    }
  }

  private mapRowToUser(row: any): UserRecord {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    };
  }

  async findByUsername(username: string): Promise<UserRecord | null> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT id, email, username, created_at, updated_at, deleted_at
        FROM users
        WHERE username = $1 AND deleted_at IS NULL
      `;

      const result = await client.query(query, [username]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToUser(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async updatePassword(id: string, hashedPassword: string): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      const query = `
        UPDATE users
        SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND deleted_at IS NULL
      `;

      const result = await client.query(query, [hashedPassword, id]);
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  async deactivateAccount(id: string): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      const query = `
        UPDATE users
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
      `;

      const result = await client.query(query, [id]);
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  async reactivateAccount(id: string): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      const query = `
        UPDATE users
        SET is_active = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
      `;

      const result = await client.query(query, [id]);
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
