import http from 'node:http';
import { URL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { EsiClient, CircuitOpenError } from './esiClient';
import { fetchForgeJitaOrderSnapshots } from './marketIngestion';
import { selectRiskMetricsByType } from './priceHistory';
import { runSqliteMigrations } from './db/migrate';
import {
	computeAnthropicBaselineSuggestions,
	persistSuggestionsToSqlite,
} from '@eve-jita-ai/agent';
import DatabaseConstructor from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any));
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

		const esi = new EsiClient({
			dbPath,
			userAgent: config.userAgent,
			failureThreshold: process.env.ESI_CIRCUIT_FAILURE_THRESHOLD
				? Number(process.env.ESI_CIRCUIT_FAILURE_THRESHOLD)
				: undefined,
			halfOpenAfterMs: process.env.ESI_CIRCUIT_OPEN_AFTER_MS
				? Number(process.env.ESI_CIRCUIT_OPEN_AFTER_MS)
				: undefined,
			minOpenDurationMs: process.env.ESI_CIRCUIT_MIN_OPEN_MS
				? Number(process.env.ESI_CIRCUIT_MIN_OPEN_MS)
				: undefined,
			errorLimitOpenThreshold: process.env.ESI_CIRCUIT_ERROR_LIMIT_THRESHOLD
				? Number(process.env.ESI_CIRCUIT_ERROR_LIMIT_THRESHOLD)
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
		// Emit a concise metrics log for observability
		// eslint-disable-next-line no-console
		console.log(
			JSON.stringify({
				type: 'esi_metrics_summary',
				requests: esiMetrics.totalRequests,
				cache_hits_304: esiMetrics.totalCacheHits304,
				retries: esiMetrics.totalRetries,
				error_limit_remain: esiMetrics.lastErrorLimitRemain,
				error_limit_reset: esiMetrics.lastErrorLimitReset,
				last_status: esiMetrics.lastStatus,
				last_url: esiMetrics.lastUrl,
				circuit_state: (esiMetrics as any).circuit_state,
				circuit_opened_reason: (esiMetrics as any).circuit_opened_reason,
			}),
		);
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
				circuit_state: (esiMetrics as any).circuit_state,
				circuit_opened_reason: (esiMetrics as any).circuit_opened_reason,
			},
		});
	} catch (err: any) {
		if (err instanceof CircuitOpenError || err?.name === 'CircuitOpenError') {
			// Graceful degradation: return latest run metadata when circuit is open
			const db = new DatabaseConstructor(config.dbPath);
			try {
				const latest = selectLatestRun(db);
				json(res, 503, {
					error: 'circuit_open',
					message: String(err.message ?? 'ESI circuit open'),
					latest_run: latest,
					esi: err?.esi_metrics ?? null,
				});
				return;
			} finally {
				db.close();
			}
		}
		json(res, 500, { error: 'internal_error', message: String(err?.message ?? err) });
	}
}

function selectLatestRun(db: any): any | null {
	const row = db
		.prepare(
			`SELECT run_id, started_at, finished_at, strategy, budget
			 FROM suggestion_run
			 ORDER BY datetime(started_at) DESC
			 LIMIT 1`,
		)
		.get();
	return row ?? null;
}

async function handleListSuggestions(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	config: { dbPath: string },
): Promise<void> {
	try {
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
			let run = null as any;
			if (run_id) {
				run = db
					.prepare(
						`SELECT run_id, started_at, finished_at, strategy, budget FROM suggestion_run WHERE run_id = ?`,
					)
					.get(run_id);
			} else {
				run = selectLatestRun(db);
			}
			if (!run) {
				json(res, 404, { error: 'not_found', message: 'No suggestion run found' });
				return;
			}
			// Build dynamic filtering SQL for side and min_margin
			const whereClauses = ['run_id = ?'];
			const params: any[] = [run.run_id];
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
	} catch (err: any) {
		json(res, 500, { error: 'internal_error', message: String(err?.message ?? err) });
	}
}

export function createServer(config?: { dbPath?: string; userAgent?: string }): http.Server {
	const dbPath =
		config?.dbPath ?? process.env.SQLITE_DB_PATH ?? path.resolve('packages/backend/dev.sqlite');
	const userAgent = config?.userAgent ?? process.env.USER_AGENT ?? undefined;

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
		let filePath: string | null = null;
		if (url.pathname === '/' || url.pathname === '/index.html') {
			filePath = path.join(frontendPublicDir, 'index.html');
		} else if (url.pathname.startsWith('/assets/')) {
			// Map /assets/* to dist/src/*
			const rel = url.pathname.replace(/^\/assets\//, '');
			filePath = path.join(frontendDistDir, 'src', rel);
		} else {
			// Try to serve from public directly
			filePath = path.join(frontendPublicDir, url.pathname);
		}
		try {
			const stat = fs.statSync(filePath);
			if (!stat.isFile()) return false;
			const body = fs.readFileSync(filePath);
			res.writeHead(200, {
				'content-type': contentTypeFor(filePath),
				'content-length': String(body.length),
			});
			if (req.method === 'GET') res.end(body);
			else res.end();
			return true;
		} catch {
			return false;
		}
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
		} catch (err: any) {
			json(res, 500, { error: 'internal_error', message: String(err?.message ?? err) });
		}
	});
}

export function startServer(config?: {
	dbPath?: string;
	userAgent?: string;
	port?: number;
}): http.Server {
	const server = createServer({ dbPath: config?.dbPath, userAgent: config?.userAgent });
	const port = config?.port ?? (process.env.PORT ? Number(process.env.PORT) : 3000);
	server.listen(port, () => {
		// eslint-disable-next-line no-console
		console.log(`backend api listening on http://localhost:${port}`);
	});
	return server;
}

// Allow running directly with tsx/node
if (import.meta.url === `file://${__filename}`) {
	startServer();
}
