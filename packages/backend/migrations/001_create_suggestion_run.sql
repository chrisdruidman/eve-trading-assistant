-- Create table for suggestion runs
CREATE TABLE IF NOT EXISTS suggestion_run (
	run_id TEXT PRIMARY KEY,
	started_at TEXT NOT NULL,
	finished_at TEXT,
	strategy TEXT NOT NULL,
	budget REAL NOT NULL
);


