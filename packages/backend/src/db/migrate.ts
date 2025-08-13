import fs from 'node:fs';
import path from 'node:path';
import DatabaseConstructor from 'better-sqlite3';
import type { Database as SqliteDatabase } from 'better-sqlite3';

function ensureMigrationsTable(db: SqliteDatabase): void {
	db.prepare(
		`CREATE TABLE IF NOT EXISTS schema_migrations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			filename TEXT NOT NULL UNIQUE,
			applied_at TEXT NOT NULL
		)`,
	).run();
}

function listSqlMigrations(migrationsDir: string): string[] {
	if (!fs.existsSync(migrationsDir)) {
		return [];
	}
	return fs
		.readdirSync(migrationsDir)
		.filter((f) => f.toLowerCase().endsWith('.sql'))
		.sort();
}

export function runSqliteMigrations(params: { dbPath: string; migrationsDir: string }): {
	applied: string[];
} {
	const { dbPath, migrationsDir } = params;
	const db = new DatabaseConstructor(dbPath);
	try {
		db.pragma('foreign_keys = ON');
		ensureMigrationsTable(db);

		const appliedRows = db
			.prepare('SELECT filename FROM schema_migrations ORDER BY filename ASC')
			.all() as { filename: string }[];
		const alreadyApplied = new Set(appliedRows.map((r) => r.filename));

		const migrations = listSqlMigrations(migrationsDir);
		const applied: string[] = [];
		const transaction = db.transaction((filename: string, sql: string) => {
			db.exec(sql);
			db.prepare('INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)').run(
				filename,
				new Date().toISOString(),
			);
		});

		for (const filename of migrations) {
			if (alreadyApplied.has(filename)) continue;
			const full = path.join(migrationsDir, filename);
			const sql = fs.readFileSync(full, 'utf8');
			transaction(filename, sql);
			applied.push(filename);
		}

		return { applied };
	} finally {
		db.close();
	}
}
