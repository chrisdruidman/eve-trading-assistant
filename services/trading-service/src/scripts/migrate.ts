import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/eve_trading_dev',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function createTradingTables() {
  const client = await pool.connect();

  try {
    console.log('Creating trading service tables...');

    // Create trading_plans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS trading_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        budget DECIMAL(15,2) NOT NULL CHECK (budget > 0),
        allocated_budget DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (allocated_budget >= 0),
        available_budget DECIMAL(15,2) GENERATED ALWAYS AS (budget - allocated_budget) STORED,
        risk_tolerance VARCHAR(20) NOT NULL CHECK (risk_tolerance IN ('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE')),
        preferred_regions INTEGER[] DEFAULT ARRAY[10000002],
        excluded_items INTEGER[] DEFAULT ARRAY[]::INTEGER[],
        max_investment_per_trade DECIMAL(15,2),
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        
        -- Performance tracking
        total_trades INTEGER NOT NULL DEFAULT 0,
        successful_trades INTEGER NOT NULL DEFAULT 0,
        total_profit DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_investment DECIMAL(15,2) NOT NULL DEFAULT 0,
        
        -- Constraints
        CONSTRAINT fk_trading_plans_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT chk_allocated_budget_lte_budget CHECK (allocated_budget <= budget),
        CONSTRAINT chk_max_investment_positive CHECK (max_investment_per_trade IS NULL OR max_investment_per_trade > 0)
      );
    `);

    // Create trading_suggestions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS trading_suggestions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id UUID NOT NULL,
        item_id INTEGER NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        buy_price DECIMAL(15,2) NOT NULL CHECK (buy_price > 0),
        sell_price DECIMAL(15,2) NOT NULL CHECK (sell_price > 0),
        expected_profit DECIMAL(15,2) NOT NULL,
        profit_margin DECIMAL(5,4) NOT NULL CHECK (profit_margin >= 0),
        risk_level VARCHAR(10) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
        required_investment DECIMAL(15,2) NOT NULL CHECK (required_investment > 0),
        time_to_profit INTEGER NOT NULL CHECK (time_to_profit > 0),
        confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        buy_region_id INTEGER NOT NULL,
        sell_region_id INTEGER NOT NULL,
        buy_location_id BIGINT,
        sell_location_id BIGINT,
        quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ALLOCATED', 'EXECUTED', 'CANCELLED', 'EXPIRED')),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        allocated_at TIMESTAMP WITH TIME ZONE,
        executed_at TIMESTAMP WITH TIME ZONE,
        
        CONSTRAINT fk_trading_suggestions_plan_id FOREIGN KEY (plan_id) REFERENCES trading_plans(id) ON DELETE CASCADE
      );
    `);

    // Create executed_trades table
    await client.query(`
      CREATE TABLE IF NOT EXISTS executed_trades (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        plan_id UUID,
        suggestion_id UUID,
        item_id INTEGER NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        buy_price DECIMAL(15,2) NOT NULL CHECK (buy_price > 0),
        sell_price DECIMAL(15,2),
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        buy_location_id BIGINT,
        sell_location_id BIGINT,
        investment_amount DECIMAL(15,2) NOT NULL CHECK (investment_amount > 0),
        actual_profit DECIMAL(15,2),
        profit_margin DECIMAL(5,4),
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'BOUGHT', 'COMPLETED', 'CANCELLED')),
        executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        
        CONSTRAINT fk_executed_trades_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_executed_trades_plan_id FOREIGN KEY (plan_id) REFERENCES trading_plans(id) ON DELETE SET NULL,
        CONSTRAINT fk_executed_trades_suggestion_id FOREIGN KEY (suggestion_id) REFERENCES trading_suggestions(id) ON DELETE SET NULL
      );
    `);

    // Create budget_allocations table for tracking budget usage
    await client.query(`
      CREATE TABLE IF NOT EXISTS budget_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id UUID NOT NULL,
        suggestion_id UUID NOT NULL,
        allocated_amount DECIMAL(15,2) NOT NULL CHECK (allocated_amount > 0),
        allocated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        released_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RELEASED', 'EXECUTED')),
        
        CONSTRAINT fk_budget_allocations_plan_id FOREIGN KEY (plan_id) REFERENCES trading_plans(id) ON DELETE CASCADE,
        CONSTRAINT fk_budget_allocations_suggestion_id FOREIGN KEY (suggestion_id) REFERENCES trading_suggestions(id) ON DELETE CASCADE,
        CONSTRAINT uk_budget_allocations_suggestion UNIQUE (suggestion_id)
      );
    `);

    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trading_plans_user_id ON trading_plans(user_id);
      CREATE INDEX IF NOT EXISTS idx_trading_plans_status ON trading_plans(status);
      CREATE INDEX IF NOT EXISTS idx_trading_plans_created_at ON trading_plans(created_at);
      
      CREATE INDEX IF NOT EXISTS idx_trading_suggestions_plan_id ON trading_suggestions(plan_id);
      CREATE INDEX IF NOT EXISTS idx_trading_suggestions_status ON trading_suggestions(status);
      CREATE INDEX IF NOT EXISTS idx_trading_suggestions_item_id ON trading_suggestions(item_id);
      
      CREATE INDEX IF NOT EXISTS idx_executed_trades_user_id ON executed_trades(user_id);
      CREATE INDEX IF NOT EXISTS idx_executed_trades_plan_id ON executed_trades(plan_id);
      CREATE INDEX IF NOT EXISTS idx_executed_trades_status ON executed_trades(status);
      CREATE INDEX IF NOT EXISTS idx_executed_trades_executed_at ON executed_trades(executed_at);
      
      CREATE INDEX IF NOT EXISTS idx_budget_allocations_plan_id ON budget_allocations(plan_id);
      CREATE INDEX IF NOT EXISTS idx_budget_allocations_status ON budget_allocations(status);
    `);

    // Create trigger to update updated_at timestamp
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
      
      DROP TRIGGER IF EXISTS update_trading_plans_updated_at ON trading_plans;
      CREATE TRIGGER update_trading_plans_updated_at
        BEFORE UPDATE ON trading_plans
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    console.log('Trading service tables created successfully!');
  } catch (error) {
    console.error('Error creating trading service tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await createTradingTables();
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

export { createTradingTables };
