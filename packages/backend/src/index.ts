export function helloBackend(): string {
	return 'backend-ready';
}

export type EsiCacheEntry = {
	cache_key: string;
	url: string;
	etag: string | null;
	expires_at: string | null; // ISO string
	last_modified: string | null; // RFC 1123 string
	fetched_at: string; // ISO string
	http_status: number;
};

export type FetchResult = {
	status: number;
	headers: Record<string, string>;
	body: unknown;
	fromCache: boolean;
};

export interface EsiHttp {
	fetchJson(
		url: string,
		options?: { method?: 'GET'; query?: Record<string, string | number | boolean> },
	): Promise<FetchResult>;
}

export { fetchForgeJitaOrderSnapshots } from './marketIngestion';
export { runSqliteMigrations } from './db/migrate';
export { createServer, startServer } from './server';
export {
	fetchForgePriceHistory,
	upsertPriceHistoryRows,
	loadForgePriceHistoryForTypes,
	selectRiskMetricsByType,
} from './priceHistory';
