const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/eve_trading_dev',
  });

  try {
    const client = await pool.connect();

    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Get list of executed migrations
    const executedResult = await client.query('SELECT filename FROM migrations');
    const executedMigrations = new Set(executedResult.rows.map(row => row.filename));

    // Read migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`Found ${migrationFiles.length} migration files`);

    // Execute pending migrations
    for (const filename of migrationFiles) {
      if (executedMigrations.has(filename)) {
        console.log(`Skipping already executed migration: ${filename}`);
        continue;
      }

      console.log(`Executing migration: ${filename}`);
      const migrationPath = path.join(migrationsDir, filename);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(migrationSQL);
        await client.query('INSERT INTO migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
        console.log(`Successfully executed migration: ${filename}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    client.release();
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
