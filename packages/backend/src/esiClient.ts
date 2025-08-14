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
	private readonly backoffBaseMs: number;
	private readonly backoffCapMs: number;
	private readonly maxRetries: number;

	// Circuit breaker fields
	private readonly failureThreshold: number;
	private readonly halfOpenAfterMs: number;
	private readonly errorLimitOpenThreshold: number;
	private readonly minOpenDurationMs: number;

	private circuitState: 'closed' | 'open' | 'half_open' = 'closed';
	private consecutiveFailures = 0;
	private openedAtMs: number | null = null;
	private openedReason: string | null = null;

	private metrics = {
		totalRequests: 0,
		totalCacheHits304: 0,
		totalRetries: 0,
		lastErrorLimitRemain: null as number | null,
		lastErrorLimitReset: null as number | null,
		lastStatus: null as number | null,
		lastUrl: null as string | null,
	};

	constructor(params: {
		dbPath: string;
		userAgent?: string;
		backoffBaseMs?: number;
		backoffCapMs?: number;
		maxRetries?: number;
		failureThreshold?: number;
		halfOpenAfterMs?: number;
		errorLimitOpenThreshold?: number;
		minOpenDurationMs?: number;
	}) {
		this.cache = new SqliteCache(params.dbPath);
		this.userAgent = params.userAgent ?? DEFAULT_USER_AGENT;
		this.backoffBaseMs = params.backoffBaseMs ?? 250;
		this.backoffCapMs = params.backoffCapMs ?? 30_000;
		this.maxRetries = params.maxRetries ?? 6;
		this.failureThreshold = params.failureThreshold ?? 5;
		this.halfOpenAfterMs = params.halfOpenAfterMs ?? 60_000; // 1m
		this.errorLimitOpenThreshold = params.errorLimitOpenThreshold ?? 2; // remain <= 2 -> open
		this.minOpenDurationMs = params.minOpenDurationMs ?? 30_000; // stay open at least 30s
	}

	getMetrics(): Readonly<{
		totalRequests: number;
		totalCacheHits304: number;
		totalRetries: number;
		lastErrorLimitRemain: number | null;
		lastErrorLimitReset: number | null;
		lastStatus: number | null;
		lastUrl: string | null;
		circuit_state?: 'closed' | 'open' | 'half_open';
		circuit_failures?: number;
		circuit_opened_at?: number | null;
		circuit_opened_reason?: string | null;
	}> {
		return {
			...this.metrics,
			circuit_state: this.circuitState,
			circuit_failures: this.consecutiveFailures,
			circuit_opened_at: this.openedAtMs,
			circuit_opened_reason: this.openedReason,
		};
	}

	private transitionCircuit(state: 'closed' | 'open' | 'half_open', reason: string): void {
		if (this.circuitState === state) return;
		this.circuitState = state;
		if (state === 'open') {
			this.openedAtMs = Date.now();
			this.openedReason = reason;
		} else if (state === 'closed') {
			this.openedAtMs = null;
			this.openedReason = null;
		}
		// eslint-disable-next-line no-console
		console.log(
			JSON.stringify({
				type: 'esi_circuit_update',
				state,
				reason,
				failures: this.consecutiveFailures,
				opened_at: this.openedAtMs,
			}),
		);
	}

	private isCircuitOpen(): boolean {
		if (this.circuitState === 'open') {
			const now = Date.now();
			const openedAt = this.openedAtMs ?? now;
			// Remain open at least minOpenDurationMs, then allow half-open probes
			if (now - openedAt < this.minOpenDurationMs) {
				return true;
			}
			if (now - openedAt >= this.halfOpenAfterMs) {
				this.transitionCircuit('half_open', 'cooldown_elapsed');
				return false; // allow a probe
			}
			return true;
		}
		return false;
	}

	async fetchJson(
		url: string,
		options?: { method?: 'GET'; query?: Record<string, string | number | boolean> },
	): Promise<FetchResult> {
		if (this.isCircuitOpen()) {
			const err = new CircuitOpenError(
				`ESI circuit is open (reason=${this.openedReason ?? 'unknown'})`,
			);
			(err as any).esi_metrics = this.getMetrics();
			throw err;
		}
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
			// Track error-limit headers when present
			if (headersRecord['x-esi-error-limit-remain']) {
				const remain = Number(headersRecord['x-esi-error-limit-remain']);
				if (Number.isFinite(remain)) this.metrics.lastErrorLimitRemain = remain;
			}
			if (headersRecord['x-esi-error-limit-reset']) {
				const reset = Number(headersRecord['x-esi-error-limit-reset']);
				if (Number.isFinite(reset)) this.metrics.lastErrorLimitReset = reset;
			}

			if (response.status === 304 && existing) {
				this.metrics.totalCacheHits304 += 1;
				this.metrics.totalRequests += 1;
				this.metrics.lastStatus = 304;
				this.metrics.lastUrl = fullUrl;
				return {
					status: 304,
					headers: headersRecord,
					body: null,
					fromCache: true,
				};
			}

			if (response.status >= 500 || response.status === 429) {
				if (attempt >= this.maxRetries) {
					// Give up after max retries
					this.metrics.totalRequests += 1;
					this.metrics.lastStatus = response.status;
					this.metrics.lastUrl = fullUrl;
					this.consecutiveFailures += 1;
					if (this.consecutiveFailures >= this.failureThreshold) {
						this.transitionCircuit('open', `failures_ge_${this.failureThreshold}`);
					}
					break;
				}
				const delay = computeBackoffDelayMs(attempt, this.backoffBaseMs, this.backoffCapMs);
				attempt += 1;
				this.metrics.totalRetries += 1;
				this.consecutiveFailures += 1;
				// eslint-disable-next-line no-console
				console.log(
					JSON.stringify({
						type: 'esi_backoff',
						status: response.status,
						attempt,
						delay_ms: Math.floor(delay),
						url: fullUrl,
						error_limit_remain: this.metrics.lastErrorLimitRemain,
						error_limit_reset: this.metrics.lastErrorLimitReset,
					}),
				);
				await sleep(delay);
				continue;
			}

			// Preemptive open when error-limit is critically low
			if (
				this.metrics.lastErrorLimitRemain !== null &&
				this.metrics.lastErrorLimitRemain <= this.errorLimitOpenThreshold
			) {
				this.transitionCircuit(
					'open',
					`error_limit_remain_le_${this.errorLimitOpenThreshold}`,
				);
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

			this.metrics.totalRequests += 1;
			this.metrics.lastStatus = response.status;
			this.metrics.lastUrl = fullUrl;
			// Emit a lightweight telemetry log when error-limit headers present
			if (
				this.metrics.lastErrorLimitRemain !== null ||
				this.metrics.lastErrorLimitReset !== null
			) {
				// eslint-disable-next-line no-console
				console.log(
					JSON.stringify({
						type: 'esi_request',
						status: response.status,
						url: fullUrl,
						cache_hit: false,
						error_limit_remain: this.metrics.lastErrorLimitRemain,
						error_limit_reset: this.metrics.lastErrorLimitReset,
					}),
				);
			}

			// Success path resets circuit (including 304 cache hit which jumps earlier)
			this.consecutiveFailures = 0;
			if (this.circuitState === 'half_open' || this.circuitState === 'open') {
				this.transitionCircuit('closed', 'successful_probe');
			}
			return {
				status: response.status,
				headers: headersRecord,
				body,
				fromCache: false,
			};
		}
		// If we exit the loop without returning, signal failure
		throw new Error('ESI request failed after max retries or circuit open');
	}
}

export class CircuitOpenError extends Error {}
