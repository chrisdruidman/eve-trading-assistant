-- Create table for suggested orders linked to a run
CREATE TABLE IF NOT EXISTS suggested_order (
	suggestion_id TEXT PRIMARY KEY,
	run_id TEXT NOT NULL,
	type_id INTEGER NOT NULL,
	side TEXT NOT NULL CHECK (side IN ('buy','sell')),
	quantity INTEGER NOT NULL CHECK (quantity >= 0),
	unit_price REAL NOT NULL CHECK (unit_price >= 0),
	expected_margin REAL NOT NULL,
	rationale TEXT,
	FOREIGN KEY (run_id) REFERENCES suggestion_run(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_suggested_order_run_id ON suggested_order(run_id);
CREATE INDEX IF NOT EXISTS idx_suggested_order_type_id ON suggested_order(type_id);


