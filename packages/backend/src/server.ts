import http from 'node:http';
import { URL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import { z } from 'zod';

import { EsiClient, CircuitOpenError } from './esiClient';
import { fetchForgeJitaOrderSnapshots } from './marketIngestion';
import type { MarketOrderSnapshot } from './marketIngestion';
import { selectRiskMetricsByType } from './priceHistory';
import { runSqliteMigrations } from './db/migrate';
import {
	computeAnthropicBaselineSuggestions,
	persistSuggestionsToSqlite,
} from '@eve-jita-ai/agent';
import DatabaseConstructor from 'better-sqlite3';
import type { Database } from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env files
// 1) Try package-local .env (when running from packages/backend)
dotenv.config();
// 2) Fallback to monorepo root .env (when .env is placed at repository root)
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const RunRequestSchema = z.object({
	budget: z.number().positive(),
	options: z
		.object({
			brokerFee: z.number().min(0).max(1).optional(),
			salesTax: z.number().min(0).max(1).optional(),
			otherFeesBuffer: z.number().min(0).max(1).optional(),
			minVolume: z.number().min(0).optional(),
			perTypeBudgetCapPct: z.number().min(0).max(1).optional(),
			minSpreadPct: z.number().min(0).max(1).optional(),
			maxSuggestions: z.number().int().min(1).max(1000).optional(),
			model: z.string().optional(),
			maxTokens: z.number().int().min(1).optional(),
			temperature: z.number().min(0).max(2).optional(),
		})
		.optional(),
	maxPages: z.number().int().min(1).max(100).optional(),
});

const ListQuerySchema = z.object({
	run_id: z.string().optional(),
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(200).default(50),
	side: z.enum(['buy', 'sell']).optional(),
	min_margin: z.number().min(0).optional(),
});

function json(res: http.ServerResponse, status: number, body: unknown): void {
	const text = JSON.stringify(body);
	res.writeHead(status, {
		'content-type': 'application/json; charset=utf-8',
		'content-length': Buffer.byteLength(text).toString(),
	});
	res.end(text);
}

async function readJson<T>(req: http.IncomingMessage): Promise<T> {
	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		if (Buffer.isBuffer(chunk)) {
			chunks.push(chunk);
		} else {
			chunks.push(Buffer.from(String(chunk)));
		}
	}
	const raw = Buffer.concat(chunks).toString('utf8');
	return raw ? (JSON.parse(raw) as T) : ({} as T);
}

function resolveMigrationsDir(): string {
	return path.resolve(__dirname, '..', 'migrations');
}

function ensureSuggestionTables(dbPath: string): void {
	// Migrations runner will create these; this is a safety net for tests/dev.
	runSqliteMigrations({ dbPath, migrationsDir: resolveMigrationsDir() });
}

async function handleRunSuggestion(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	config: { dbPath: string; userAgent?: string },
): Promise<void> {
	try {
		const parsed = RunRequestSchema.safeParse(await readJson(req));
		if (!parsed.success) {
			json(res, 400, { error: 'invalid_request', details: parsed.error.flatten() });
			return;
		}
		const { budget, options, maxPages } = parsed.data;
		const dbPath = config.dbPath;
		ensureSuggestionTables(dbPath);

		// This legacy handler is retained for direct-fetch mode, but T-17 requires stored snapshots.
		// For safety, we keep the old path behind an env toggle if needed in the future.
		const directFetch = process.env['ALLOW_RUN_DIRECT_FETCH'] === '1';
		if (directFetch) {
			const esi = new EsiClient({
				dbPath,
				userAgent: config.userAgent,
				failureThreshold: process.env['ESI_CIRCUIT_FAILURE_THRESHOLD']
					? Number(process.env['ESI_CIRCUIT_FAILURE_THRESHOLD'])
					: undefined,
				halfOpenAfterMs: process.env['ESI_CIRCUIT_OPEN_AFTER_MS']
					? Number(process.env['ESI_CIRCUIT_OPEN_AFTER_MS'])
					: undefined,
				minOpenDurationMs: process.env['ESI_CIRCUIT_MIN_OPEN_MS']
					? Number(process.env['ESI_CIRCUIT_MIN_OPEN_MS'])
					: undefined,
				errorLimitOpenThreshold: process.env['ESI_CIRCUIT_ERROR_LIMIT_THRESHOLD']
					? Number(process.env['ESI_CIRCUIT_ERROR_LIMIT_THRESHOLD'])
					: undefined,
			});
			const { snapshots } = await fetchForgeJitaOrderSnapshots({ esi, maxPages });
			const typeIds = Array.from(new Set(snapshots.map((s) => s.type_id)));
			const riskByType = selectRiskMetricsByType({ dbPath, typeIds });
			const { run, suggestions, usage } = await computeAnthropicBaselineSuggestions({
				snapshots,
				budget,
				options,
				riskByType,
			});
			persistSuggestionsToSqlite(dbPath, run, suggestions);
			const esiMetrics = esi.getMetrics();
			json(res, 200, {
				run,
				counts: { suggestions: suggestions.length },
				usage,
				esi: {
					requests: esiMetrics.totalRequests,
					cache_hits_304: esiMetrics.totalCacheHits304,
					retries: esiMetrics.totalRetries,
					error_limit_remain: esiMetrics.lastErrorLimitRemain,
					error_limit_reset: esiMetrics.lastErrorLimitReset,
					circuit_state: esiMetrics.circuit_state,
					circuit_opened_reason: esiMetrics.circuit_opened_reason,
				},
			});
			return;
		}

		// Stored snapshot path (default)
		const state = (globalThis as any).__JITA_SNAPSHOT__ as
			| {
					snapshots: { type_id: number }[];
					fetched_at: string;
			  }
			| null
			| undefined;
		if (!state || !state.snapshots?.length) {
			// No snapshot yet; degrade gracefully with 503
			const db = new DatabaseConstructor(dbPath);
			try {
				const latest = selectLatestRun(db);
				json(res, 503, {
					error: 'no_snapshot_available',
					message:
						'No market snapshot is available yet. Please try again after the next scheduled fetch completes.',
					latest_run: latest,
					market_snapshot_used: false,
				});
				return;
			} finally {
				db.close();
			}
		}
		const snapshots = state.snapshots as any[];
		const snapshotTs = state.fetched_at;
		const ageMs = Date.now() - new Date(snapshotTs).getTime();
		const typeIds = Array.from(new Set(snapshots.map((s) => s.type_id)));
		const riskByType = selectRiskMetricsByType({ dbPath, typeIds });
		const { run, suggestions, usage } = await computeAnthropicBaselineSuggestions({
			snapshots: snapshots as any,
			budget,
			options,
			riskByType,
		});
		persistSuggestionsToSqlite(dbPath, run, suggestions);
		json(res, 200, {
			run,
			counts: { suggestions: suggestions.length },
			usage,
			market_snapshot_used: true,
			snapshot_age_ms: ageMs,
			snapshot_timestamp: snapshotTs,
		});
	} catch (err) {
		if (
			err instanceof CircuitOpenError ||
			(err as unknown as { name?: string })?.name === 'CircuitOpenError'
		) {
			// Graceful degradation: return latest run metadata when circuit is open
			const db = new DatabaseConstructor(config.dbPath);
			try {
				const latest = selectLatestRun(db);
				json(res, 503, {
					error: 'circuit_open',
					message: String((err as Error).message ?? 'ESI circuit open'),
					latest_run: latest,
					esi: (err as unknown as { esi_metrics?: unknown }).esi_metrics ?? null,
				});
				return;
			} finally {
				db.close();
			}
		}
		json(res, 500, {
			error: 'internal_error',
			message: String((err as Error)?.message ?? err),
		});
	}
}

function selectLatestRun(db: Database): {
	run_id: string;
	started_at: string;
	finished_at: string | null;
	strategy: string;
	budget: number;
} | null {
	const row = db
		.prepare(
			`SELECT run_id, started_at, finished_at, strategy, budget
			 FROM suggestion_run
			 ORDER BY datetime(started_at) DESC
			 LIMIT 1`,
		)
		.get() as
		| {
				run_id: string;
				started_at: string;
				finished_at: string | null;
				strategy: string;
				budget: number;
		  }
		| undefined;
	return row ?? null;
}

async function handleListSuggestions(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	config: { dbPath: string },
): Promise<void> {
	try {
		// Ensure tables exist so first GET before any POST run doesn't 500
		ensureSuggestionTables(config.dbPath);
		const url = new URL(req.url ?? '/', 'http://localhost');
		const pageNum = Number(url.searchParams.get('page') ?? '1');
		const limitNum = Number(url.searchParams.get('limit') ?? '50');
		const sideParam = url.searchParams.get('side');
		const minMarginNum = Number(url.searchParams.get('min_margin') ?? '');
		const parsed = ListQuerySchema.safeParse({
			run_id: url.searchParams.get('run_id') ?? undefined,
			page: pageNum,
			limit: limitNum,
			side:
				sideParam === 'buy' || sideParam === 'sell'
					? (sideParam as 'buy' | 'sell')
					: undefined,
			min_margin:
				Number.isFinite(minMarginNum) && minMarginNum >= 0 ? minMarginNum : undefined,
		});
		if (!parsed.success) {
			json(res, 400, { error: 'invalid_request', details: parsed.error.flatten() });
			return;
		}
		const { run_id, page, limit, side, min_margin } = parsed.data;
		const db = new DatabaseConstructor(config.dbPath);
		try {
			let run: {
				run_id: string;
				started_at: string;
				finished_at: string | null;
				strategy: string;
				budget: number;
			} | null = null;
			if (run_id) {
				run = db
					.prepare(
						`SELECT run_id, started_at, finished_at, strategy, budget FROM suggestion_run WHERE run_id = ?`,
					)
					.get(run_id) as {
					run_id: string;
					started_at: string;
					finished_at: string | null;
					strategy: string;
					budget: number;
				} | null;
			} else {
				run = selectLatestRun(db);
			}
			if (!run) {
				json(res, 404, { error: 'not_found', message: 'No suggestion run found' });
				return;
			}
			// Build dynamic filtering SQL for side and min_margin
			const whereClauses = ['run_id = ?'];
			const params: unknown[] = [run.run_id];
			if (side) {
				whereClauses.push('side = ?');
				params.push(side);
			}
			if (typeof min_margin === 'number') {
				whereClauses.push('expected_margin >= ?');
				params.push(min_margin);
			}
			const whereSql = whereClauses.join(' AND ');
			const totalRow = db
				.prepare(`SELECT COUNT(1) as cnt FROM suggested_order WHERE ${whereSql}`)
				.get(...params) as { cnt: number };
			const total = Number(totalRow?.cnt ?? 0);
			const offset = (page - 1) * limit;
			const rows = db
				.prepare(
					`SELECT suggestion_id, run_id, type_id, side, quantity, unit_price, expected_margin, rationale
					 FROM suggested_order
					 WHERE ${whereSql}
					 ORDER BY expected_margin DESC
					 LIMIT ? OFFSET ?`,
				)
				.all(...params, limit, offset);
			json(res, 200, {
				run,
				suggestions: rows,
				page,
				limit,
				total,
				hasMore: offset + rows.length < total,
			});
		} finally {
			db.close();
		}
	} catch (err) {
		const e = err as Error;
		json(res, 500, { error: 'internal_error', message: String(e?.message ?? err) });
	}
}

export function createServer(config?: { dbPath?: string; userAgent?: string }): http.Server {
	const dbPath =
		config?.dbPath ??
		process.env['SQLITE_DB_PATH'] ??
		path.resolve(__dirname, '..', 'dev.sqlite');
	const userAgent = config?.userAgent ?? process.env['USER_AGENT'] ?? undefined;

	// Market snapshot scheduler configuration
	const snapshotIntervalMs = process.env['MARKET_SNAPSHOT_INTERVAL_MS']
		? Number(process.env['MARKET_SNAPSHOT_INTERVAL_MS'])
		: 300_000; // default 5 minutes
	const snapshotStaleMs = process.env['MARKET_SNAPSHOT_STALE_MS']
		? Number(process.env['MARKET_SNAPSHOT_STALE_MS'])
		: 300_000; // default 5 minutes

	type JitaSnapshotRecord = {
		snapshots: MarketOrderSnapshot[];
		last_modified: string | null;
		fetched_at: string; // ISO timestamp when scheduler fetched
	};

	let latestSnapshot: JitaSnapshotRecord | null = null;

	async function fetchAndStoreSnapshots(): Promise<void> {
		const startedAt = Date.now();
		// eslint-disable-next-line no-console
		console.log(JSON.stringify({ type: 'market_snapshot_fetch_start', started_at: startedAt }));
		const esi = new EsiClient({
			dbPath,
			userAgent,
			failureThreshold: process.env['ESI_CIRCUIT_FAILURE_THRESHOLD']
				? Number(process.env['ESI_CIRCUIT_FAILURE_THRESHOLD'])
				: undefined,
			halfOpenAfterMs: process.env['ESI_CIRCUIT_OPEN_AFTER_MS']
				? Number(process.env['ESI_CIRCUIT_OPEN_AFTER_MS'])
				: undefined,
			minOpenDurationMs: process.env['ESI_CIRCUIT_MIN_OPEN_MS']
				? Number(process.env['ESI_CIRCUIT_MIN_OPEN_MS'])
				: undefined,
			errorLimitOpenThreshold: process.env['ESI_CIRCUIT_ERROR_LIMIT_THRESHOLD']
				? Number(process.env['ESI_CIRCUIT_ERROR_LIMIT_THRESHOLD'])
				: undefined,
		});
		try {
			const { snapshots, lastModified } = await fetchForgeJitaOrderSnapshots({ esi });
			latestSnapshot = {
				snapshots,
				last_modified: lastModified,
				fetched_at: new Date().toISOString(),
			};
			// Expose globally so request handlers can access without refactor
			(globalThis as any).__JITA_SNAPSHOT__ = latestSnapshot;
			const durationMs = Date.now() - startedAt;
			const m = esi.getMetrics();
			// eslint-disable-next-line no-console
			console.log(
				JSON.stringify({
					type: 'market_snapshot_fetch_success',
					duration_ms: durationMs,
					snapshot_items: snapshots.length,
					last_modified: lastModified,
					esi_requests: m.totalRequests,
					esi_cache_hits_304: m.totalCacheHits304,
					esi_retries: m.totalRetries,
					error_limit_remain: m.lastErrorLimitRemain,
					error_limit_reset: m.lastErrorLimitReset,
				}),
			);
		} catch (err) {
			const durationMs = Date.now() - startedAt;
			// eslint-disable-next-line no-console
			console.log(
				JSON.stringify({
					type: 'market_snapshot_fetch_failure',
					duration_ms: durationMs,
					error: String((err as Error)?.message ?? err),
				}),
			);
		}
	}

	// Start scheduler (non-blocking) with immediate fetch on boot
	try {
		// eslint-disable-next-line no-console
		console.log(
			JSON.stringify({
				type: 'market_snapshot_scheduler_start',
				interval_ms: snapshotIntervalMs,
				stale_ms: snapshotStaleMs,
			}),
		);
		// Fire and forget initial fetch
		// Avoid blocking server start
		void fetchAndStoreSnapshots();
		setInterval(
			() => {
				void fetchAndStoreSnapshots();
			},
			Math.max(15_000, snapshotIntervalMs),
		); // guard against overly aggressive settings
	} catch {
		// ignore scheduler errors at startup
	}

	// Static file roots
	const frontendPublicDir = path.resolve(__dirname, '..', '..', 'frontend', 'public');
	const frontendDistDir = path.resolve(__dirname, '..', '..', 'frontend', 'dist');

	function contentTypeFor(filePath: string): string {
		const ext = path.extname(filePath).toLowerCase();
		switch (ext) {
			case '.html':
				return 'text/html; charset=utf-8';
			case '.js':
				return 'text/javascript; charset=utf-8';
			case '.css':
				return 'text/css; charset=utf-8';
			case '.map':
				return 'application/json; charset=utf-8';
			case '.json':
				return 'application/json; charset=utf-8';
			default:
				return 'application/octet-stream';
		}
	}

	function tryServeStatic(
		req: http.IncomingMessage,
		res: http.ServerResponse,
		url: URL,
	): boolean {
		if (req.method !== 'GET' && req.method !== 'HEAD') return false;
		const tryFilesInOrder: string[] = [];
		if (url.pathname === '/' || url.pathname === '/index.html') {
			// Prefer Vite build output when present
			tryFilesInOrder.push(path.join(frontendDistDir, 'index.html'));
			tryFilesInOrder.push(path.join(frontendPublicDir, 'index.html'));
		} else if (url.pathname.startsWith('/assets/')) {
			// Map /assets/* to Vite dist/assets/*
			const rel = url.pathname.replace(/^\/assets\//, '');
			tryFilesInOrder.push(path.join(frontendDistDir, 'assets', rel));
		} else {
			// Try Vite dist first, then public as fallback
			tryFilesInOrder.push(path.join(frontendDistDir, url.pathname));
			tryFilesInOrder.push(path.join(frontendPublicDir, url.pathname));
		}
		for (const filePath of tryFilesInOrder) {
			try {
				const stat = fs.statSync(filePath);
				if (!stat.isFile()) continue;
				const body = fs.readFileSync(filePath);
				res.writeHead(200, {
					'content-type': contentTypeFor(filePath),
					'content-length': String(body.length),
				});
				if (req.method === 'GET') res.end(body);
				else res.end();
				return true;
			} catch {
				continue;
			}
		}
		return false;
	}

	return http.createServer(async (req, res) => {
		try {
			const url = new URL(req.url ?? '/', 'http://localhost');
			// Serve static frontend first
			if (tryServeStatic(req, res, url)) return;
			if (req.method === 'POST' && url.pathname === '/api/suggestions/run') {
				await handleRunSuggestion(req, res, { dbPath, userAgent });
				return;
			}
			if (req.method === 'GET' && url.pathname === '/api/suggestions') {
				await handleListSuggestions(req, res, { dbPath });
				return;
			}
			json(res, 404, { error: 'not_found' });
		} catch (err) {
			const e = err as Error;
			json(res, 500, { error: 'internal_error', message: String(e?.message ?? err) });
		}
	});
}

export function startServer(config?: {
	dbPath?: string;
	userAgent?: string;
	port?: number;
}): http.Server {
	const server = createServer({ dbPath: config?.dbPath, userAgent: config?.userAgent });
	const port = config?.port ?? (process.env['PORT'] ? Number(process.env['PORT']) : 3000);
	server.listen(port, () => {
		// eslint-disable-next-line no-console
		console.log(`backend api listening on http://localhost:${port}`);
	});
	return server;
}

// Allow running directly with tsx/node (cross-platform)
try {
	const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
	if (entry && entry === path.resolve(__filename)) {
		startServer();
	}
} catch {
	// ignore
}
