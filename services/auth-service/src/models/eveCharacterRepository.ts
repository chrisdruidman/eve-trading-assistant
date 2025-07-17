import { Pool } from 'pg';
import { EveCharacter } from '../../../../shared/src/types';

export interface EveCharacterRecord {
  id: string;
  userId: string;
  characterId: number;
  characterName: string;
  corporationId: number;
  allianceId?: number;
  encryptedApiKey: string;
  scopes: string[];
  lastSync: Date;
  expiresAt: Date;
  isValid: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export class EveCharacterRepository {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/eve_trading_dev',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async create(
    characterData: Omit<EveCharacterRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<EveCharacterRecord> {
    const client = await this.pool.connect();

    try {
      const query = `
        INSERT INTO eve_characters (
          user_id, character_id, character_name, corporation_id, alliance_id,
          encrypted_api_key, scopes, last_sync, expires_at, is_valid, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
        RETURNING *
      `;

      const values = [
        characterData.userId,
        characterData.characterId,
        characterData.characterName,
        characterData.corporationId,
        characterData.allianceId,
        characterData.encryptedApiKey,
        JSON.stringify(characterData.scopes),
        characterData.lastSync,
        characterData.expiresAt,
        characterData.isValid,
      ];

      const result = await client.query(query, values);
      return this.mapRowToCharacter(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findByUserId(userId: string): Promise<EveCharacterRecord[]> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT * FROM eve_characters
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;

      const result = await client.query(query, [userId]);
      return result.rows.map(row => this.mapRowToCharacter(row));
    } finally {
      client.release();
    }
  }

  async findByCharacterId(characterId: number): Promise<EveCharacterRecord | null> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT * FROM eve_characters
        WHERE character_id = $1
      `;

      const result = await client.query(query, [characterId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToCharacter(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async findByUserIdAndCharacterId(
    userId: string,
    characterId: number
  ): Promise<EveCharacterRecord | null> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT * FROM eve_characters
        WHERE user_id = $1 AND character_id = $2
      `;

      const result = await client.query(query, [userId, characterId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToCharacter(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async updateApiKey(
    userId: string,
    characterId: number,
    encryptedApiKey: string,
    expiresAt: Date,
    scopes: string[]
  ): Promise<EveCharacterRecord | null> {
    const client = await this.pool.connect();

    try {
      const query = `
        UPDATE eve_characters
        SET encrypted_api_key = $3, expires_at = $4, scopes = $5, is_valid = true, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND character_id = $2
        RETURNING *
      `;

      const values = [userId, characterId, encryptedApiKey, expiresAt, JSON.stringify(scopes)];
      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToCharacter(result.rows[0]);
    } finally {
      client.release();
    }
  }

  async updateLastSync(userId: string, characterId: number): Promise<void> {
    const client = await this.pool.connect();

    try {
      const query = `
        UPDATE eve_characters
        SET last_sync = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND character_id = $2
      `;

      await client.query(query, [userId, characterId]);
    } finally {
      client.release();
    }
  }

  async markAsInvalid(userId: string, characterId: number): Promise<void> {
    const client = await this.pool.connect();

    try {
      const query = `
        UPDATE eve_characters
        SET is_valid = false, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND character_id = $2
      `;

      await client.query(query, [userId, characterId]);
    } finally {
      client.release();
    }
  }

  async findExpiringSoon(daysAhead: number = 7): Promise<EveCharacterRecord[]> {
    const client = await this.pool.connect();

    try {
      const query = `
        SELECT * FROM eve_characters
        WHERE is_valid = true
        AND expires_at <= CURRENT_TIMESTAMP + INTERVAL '${daysAhead} days'
        AND expires_at > CURRENT_TIMESTAMP
        ORDER BY expires_at ASC
      `;

      const result = await client.query(query);
      return result.rows.map(row => this.mapRowToCharacter(row));
    } finally {
      client.release();
    }
  }

  async delete(userId: string, characterId: number): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      const query = `
        DELETE FROM eve_characters
        WHERE user_id = $1 AND character_id = $2
      `;

      const result = await client.query(query, [userId, characterId]);
      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  private mapRowToCharacter(row: any): EveCharacterRecord {
    return {
      id: row.id,
      userId: row.user_id,
      characterId: row.character_id,
      characterName: row.character_name,
      corporationId: row.corporation_id,
      allianceId: row.alliance_id,
      encryptedApiKey: row.encrypted_api_key,
      scopes: JSON.parse(row.scopes || '[]'),
      lastSync: row.last_sync,
      expiresAt: row.expires_at,
      isValid: row.is_valid,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
