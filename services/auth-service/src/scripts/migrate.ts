import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/eve_trading_dev',
});

async function createUsersTable() {
  const client = await pool.connect();

  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        username VARCHAR(30) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `);

    // Create updated_at trigger function
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create trigger for updated_at
    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('✅ Users table created successfully');
  } catch (error) {
    console.error('❌ Error creating users table:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function createEveCharactersTable() {
  const client = await pool.connect();

  try {
    // Create eve_characters table
    await client.query(`
      CREATE TABLE IF NOT EXISTS eve_characters (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        character_id BIGINT NOT NULL,
        character_name VARCHAR(255) NOT NULL,
        corporation_id BIGINT NOT NULL,
        alliance_id BIGINT,
        encrypted_api_key TEXT NOT NULL,
        scopes JSONB NOT NULL DEFAULT '[]',
        last_sync TIMESTAMP WITH TIME ZONE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        is_valid BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, character_id)
      );
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_eve_characters_user_id ON eve_characters(user_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_eve_characters_character_id ON eve_characters(character_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_eve_characters_expires_at ON eve_characters(expires_at);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_eve_characters_is_valid ON eve_characters(is_valid);
    `);

    // Create trigger for updated_at
    await client.query(`
      DROP TRIGGER IF EXISTS update_eve_characters_updated_at ON eve_characters;
      CREATE TRIGGER update_eve_characters_updated_at
        BEFORE UPDATE ON eve_characters
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('✅ EVE characters table created successfully');
  } catch (error) {
    console.error('❌ Error creating EVE characters table:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function runMigrations() {
  try {
    console.log('🚀 Running database migrations...');

    await createUsersTable();
    await createEveCharactersTable();

    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };
