import { Pool } from 'pg';

export interface UserRecord {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt?: Date;
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

  async create(userData: Omit<UserRecord, 'updatedAt'>): Promise<UserRecord> {
    const client = await this.pool.connect();

    try {
      const query = `
        INSERT INTO users (id, email, username, password_hash, created_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, username, password_hash, created_at, updated_at
      `;

      const values = [
        userData.id,
        userData.email,
        userData.username,
        userData.passwordHash,
        userData.createdAt,
      ];

      const result = await client.query(query, values);
      return this.mapRowToUser(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT id, email, username, password_hash, created_at, updated_at
        FROM users
        WHERE email = $1
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

  async findByUsername(username: string): Promise<UserRecord | null> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT id, email, username, password_hash, created_at, updated_at
        FROM users
        WHERE username = $1
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

  async findById(id: string): Promise<UserRecord | null> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT id, email, username, password_hash, created_at, updated_at
        FROM users
        WHERE id = $1
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

  async updateLastLogin(id: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      const query = `
        UPDATE users
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;

      await client.query(query, [id]);
    } finally {
      client.release();
    }
  }

  async delete(id: string): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      const query = `DELETE FROM users WHERE id = $1`;
      const result = await client.query(query, [id]);

      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  private mapRowToUser(row: any): UserRecord {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      passwordHash: row.password_hash,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
