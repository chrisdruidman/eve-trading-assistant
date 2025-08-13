import crypto from 'node:crypto';

import type { EsiCacheEntry, EsiHttp, FetchResult } from './index';
import { SqliteCache } from './cache/sqliteCache';

const DEFAULT_USER_AGENT =
	'eve-jita-ai-trader/0.1.0 (+https://github.com/chrisdruidman/eve-jita-ai-trader)';

function createCacheKey(
	url: string,
	query: Record<string, string | number | boolean> | undefined,
): string {
	const normalized = query
		? new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString()
		: '';
	const id = normalized ? `${url}?${normalized}` : url;
	return crypto.createHash('sha256').update(id).digest('hex');
}

function headersToRecord(headers: Headers): Record<string, string> {
	const record: Record<string, string> = {};
	headers.forEach((value, key) => {
		record[key.toLowerCase()] = value;
	});
	return record;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeBackoffDelayMs(attempt: number, baseMs = 250, capMs = 30_000): number {
	const exp = Math.min(capMs, baseMs * 2 ** attempt);
	const jitter = Math.random() * exp;
	return jitter;
}

export class EsiClient implements EsiHttp {
	private readonly cache: SqliteCache;
	private readonly userAgent: string;

	constructor(params: { dbPath: string; userAgent?: string }) {
		this.cache = new SqliteCache(params.dbPath);
		this.userAgent = params.userAgent ?? DEFAULT_USER_AGENT;
	}

	async fetchJson(
		url: string,
		options?: { method?: 'GET'; query?: Record<string, string | number | boolean> },
	): Promise<FetchResult> {
		const method = options?.method ?? 'GET';
		const query = options?.query;
		const cacheKey = createCacheKey(url, query);

		const search = query
			? `?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString()}`
			: '';
		const fullUrl = `${url}${search}`;

		const existing = this.cache.get(cacheKey);

		let attempt = 0;
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const headers: Record<string, string> = {
				'user-agent': this.userAgent,
			};
			if (existing?.etag) {
				headers['if-none-match'] = existing.etag;
			}
			// In browsers, we would also add X-User-Agent, but this runs server-side.

			const response = await fetch(fullUrl, {
				method,
				headers,
			});

			const headersRecord = headersToRecord(response.headers);

			if (response.status === 304 && existing) {
				return {
					status: 304,
					headers: headersRecord,
					body: null,
					fromCache: true,
				};
			}

			if (response.status >= 500 || response.status === 429) {
				const delay = computeBackoffDelayMs(attempt);
				attempt += 1;
				await sleep(delay);
				continue;
			}

			const text = await response.text();
			const body = text.length ? JSON.parse(text) : null;

			const entry: EsiCacheEntry = {
				cache_key: cacheKey,
				url: fullUrl,
				etag: headersRecord['etag'] ?? null,
				expires_at: headersRecord['expires'] ?? null,
				last_modified: headersRecord['last-modified'] ?? null,
				fetched_at: new Date().toISOString(),
				http_status: response.status,
			};
			this.cache.upsert(entry);

			return {
				status: response.status,
				headers: headersRecord,
				body,
				fromCache: false,
			};
		}
	}
}
