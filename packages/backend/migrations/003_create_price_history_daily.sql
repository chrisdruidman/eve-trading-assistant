-- Create table to store daily price history for The Forge (and potentially other regions)
-- Merge/update keyed by (region_id, type_id, day)

CREATE TABLE IF NOT EXISTS price_history_daily (
    region_id INTEGER NOT NULL,
    type_id INTEGER NOT NULL,
    day TEXT NOT NULL, -- YYYY-MM-DD per ESI history 'date'
    avg_price REAL NOT NULL,
    volume INTEGER NOT NULL,
    PRIMARY KEY (region_id, type_id, day)
);

CREATE INDEX IF NOT EXISTS idx_price_history_daily_type_day
    ON price_history_daily(type_id, day);


