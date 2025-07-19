import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/eve_trading_dev',
  });

  try {
    console.log('Starting database migrations...');

    // Create migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    // Get list of executed migrations
    const executedResult = await pool.query('SELECT filename FROM migrations ORDER BY id');
    const executedMigrations = new Set(executedResult.rows.map(row => row.filename));

    // Migration files to run
    const migrationFiles = ['001_create_market_tables.sql', '002_create_watchlist_tables.sql'];

    for (const filename of migrationFiles) {
      if (executedMigrations.has(filename)) {
        console.log(`Skipping ${filename} (already executed)`);
        continue;
      }

      console.log(`Executing ${filename}...`);

      const migrationPath = join(__dirname, '../migrations', filename);
      const migrationSQL = readFileSync(migrationPath, 'utf8');

      // Execute migration in a transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(migrationSQL);
        await client.query('INSERT INTO migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        console.log(`✓ ${filename} executed successfully`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

export { runMigrations };
