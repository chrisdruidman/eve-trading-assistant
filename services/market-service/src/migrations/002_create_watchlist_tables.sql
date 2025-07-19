-- Create watchlist tables for user market monitoring

-- Watchlists table
CREATE TABLE IF NOT EXISTS watchlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Watchlist items table
CREATE TABLE IF NOT EXISTS watchlist_items (
    watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    type_id INTEGER NOT NULL,
    region_id INTEGER NOT NULL,
    target_buy_price DECIMAL(15,2),
    target_sell_price DECIMAL(15,2),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (watchlist_id, type_id, region_id)
);

-- Alert rules table
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
    type_id INTEGER NOT NULL,
    region_id INTEGER NOT NULL,
    condition VARCHAR(50) NOT NULL CHECK (condition IN ('PRICE_ABOVE', 'PRICE_BELOW', 'VOLUME_ABOVE', 'VOLUME_BELOW')),
    threshold DECIMAL(15,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    type_id INTEGER NOT NULL,
    region_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT false
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_watchlist_id ON watchlist_items(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_items_type_region ON watchlist_items(type_id, region_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_watchlist_id ON alert_rules(watchlist_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON alert_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_alert_rules_type_region ON alert_rules(type_id, region_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_rule_id ON alert_rules(id);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unacknowledged ON alerts(acknowledged) WHERE acknowledged = false;