-- Market Data Service Database Schema
-- Creates tables for storing EVE Online market data

-- Market data summary table
CREATE TABLE IF NOT EXISTS market_data (
    type_id INTEGER NOT NULL,
    region_id INTEGER NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    volume BIGINT NOT NULL DEFAULT 0,
    average_price DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (type_id, region_id)
);

-- Market orders table
CREATE TABLE IF NOT EXISTS market_orders (
    order_id BIGINT PRIMARY KEY,
    type_id INTEGER NOT NULL,
    region_id INTEGER NOT NULL,
    location_id BIGINT NOT NULL,
    price DECIMAL(15,2) NOT NULL,
    volume INTEGER NOT NULL,
    min_volume INTEGER NOT NULL DEFAULT 1,
    duration INTEGER NOT NULL,
    issued TIMESTAMP WITH TIME ZONE NOT NULL,
    is_buy_order BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    FOREIGN KEY (type_id, region_id) REFERENCES market_data(type_id, region_id) ON DELETE CASCADE
);

-- Price history table (partitioned by date for performance)
CREATE TABLE IF NOT EXISTS price_history (
    type_id INTEGER NOT NULL,
    region_id INTEGER NOT NULL,
    date DATE NOT NULL,
    highest DECIMAL(15,2) NOT NULL,
    lowest DECIMAL(15,2) NOT NULL,
    average DECIMAL(15,2) NOT NULL,
    volume BIGINT NOT NULL DEFAULT 0,
    order_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (type_id, region_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_market_data_last_updated ON market_data(last_updated);
CREATE INDEX IF NOT EXISTS idx_market_orders_type_region ON market_orders(type_id, region_id);
CREATE INDEX IF NOT EXISTS idx_market_orders_price ON market_orders(price);
CREATE INDEX IF NOT EXISTS idx_market_orders_is_buy ON market_orders(is_buy_order);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(date);
CREATE INDEX IF NOT EXISTS idx_price_history_type_region_date ON price_history(type_id, region_id, date);

-- Update trigger for market_data
CREATE OR REPLACE FUNCTION update_market_data_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_market_data_timestamp
    BEFORE UPDATE ON market_data
    FOR EACH ROW
    EXECUTE FUNCTION update_market_data_timestamp();

-- Comments for documentation
COMMENT ON TABLE market_data IS 'Summary of market data for each item type in each region';
COMMENT ON TABLE market_orders IS 'Individual market orders from EVE Online ESI API';
COMMENT ON TABLE price_history IS 'Historical price data aggregated by day';

COMMENT ON COLUMN market_data.type_id IS 'EVE Online item type ID';
COMMENT ON COLUMN market_data.region_id IS 'EVE Online region ID';
COMMENT ON COLUMN market_data.volume IS 'Total volume traded in the last 24 hours';
COMMENT ON COLUMN market_data.average_price IS 'Volume-weighted average price';

COMMENT ON COLUMN market_orders.order_id IS 'Unique order ID from EVE Online';
COMMENT ON COLUMN market_orders.location_id IS 'Station or structure ID where order is placed';
COMMENT ON COLUMN market_orders.is_buy_order IS 'TRUE for buy orders, FALSE for sell orders';

COMMENT ON COLUMN price_history.highest IS 'Highest price traded on this date';
COMMENT ON COLUMN price_history.lowest IS 'Lowest price traded on this date';
COMMENT ON COLUMN price_history.average IS 'Volume-weighted average price for this date';
COMMENT ON COLUMN price_history.order_count IS 'Number of orders that contributed to this data';