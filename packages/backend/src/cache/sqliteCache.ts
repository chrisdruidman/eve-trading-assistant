import DatabaseConstructor from 'better-sqlite3';
import type { Database as SqliteDatabase } from 'better-sqlite3';

import type { EsiCacheEntry } from '../index';

export class SqliteCache {
	private readonly db: SqliteDatabase;

	constructor(filePath: string) {
		this.db = new DatabaseConstructor(filePath);
		this.db.pragma('journal_mode = WAL');
		this.ensureSchema();
	}

	private ensureSchema(): void {
		this.db
			.prepare(
				`CREATE TABLE IF NOT EXISTS esi_cache_entry (
                    cache_key TEXT PRIMARY KEY,
                    url TEXT NOT NULL,
                    etag TEXT,
                    expires_at TEXT,
                    last_modified TEXT,
                    fetched_at TEXT NOT NULL,
                    http_status INTEGER NOT NULL
                )`,
			)
			.run();
		this.db
			.prepare('CREATE INDEX IF NOT EXISTS idx_esi_cache_url ON esi_cache_entry(url)')
			.run();
	}

	upsert(entry: EsiCacheEntry): void {
		this.db
			.prepare(
				`INSERT INTO esi_cache_entry (cache_key, url, etag, expires_at, last_modified, fetched_at, http_status)
                 VALUES (@cache_key, @url, @etag, @expires_at, @last_modified, @fetched_at, @http_status)
                 ON CONFLICT(cache_key) DO UPDATE SET
                    url=excluded.url,
                    etag=excluded.etag,
                    expires_at=excluded.expires_at,
                    last_modified=excluded.last_modified,
                    fetched_at=excluded.fetched_at,
                    http_status=excluded.http_status`,
			)
			.run(entry);
	}

	get(cacheKey: string): EsiCacheEntry | undefined {
		const row = this.db
			.prepare('SELECT * FROM esi_cache_entry WHERE cache_key = ?')
			.get(cacheKey) as EsiCacheEntry | undefined;
		return row;
	}
}
