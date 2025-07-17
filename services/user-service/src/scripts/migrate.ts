import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/eve_trading_dev',
});

async function createUserPreferencesTable() {
  const client = await pool.connect();

  try {
    console.log('Creating user_preferences table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        theme VARCHAR(10) NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
        email_notifications BOOLEAN NOT NULL DEFAULT true,
        in_app_notifications BOOLEAN NOT NULL DEFAULT true,
        push_notifications BOOLEAN NOT NULL DEFAULT false,
        risk_tolerance VARCHAR(20) NOT NULL DEFAULT 'MODERATE' CHECK (risk_tolerance IN ('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE')),
        default_budget BIGINT NOT NULL DEFAULT 1000000,
        preferred_regions JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE
      );
    `);

    console.log('✅ user_preferences table created successfully');

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
    `);

    console.log('✅ user_preferences indexes created successfully');

    // Add deleted_at column to users table if it doesn't exist (for soft deletes)
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
    `);

    console.log('✅ Added deleted_at column to users table');

    // Create index for soft delete queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;
    `);

    console.log('✅ Created index for soft delete queries');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function runMigrations() {
  try {
    console.log('🚀 Starting user service migrations...');

    await createUserPreferencesTable();

    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations };
