import http from 'node:http';
import { URL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import { EsiClient } from './esiClient';
import { fetchForgeJitaOrderSnapshots } from './marketIngestion';
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

		const esi = new EsiClient({ dbPath, userAgent: config.userAgent });
		const { snapshots } = await fetchForgeJitaOrderSnapshots({ esi, maxPages });

		const { run, suggestions, usage } = await computeAnthropicBaselineSuggestions({
			snapshots,
			budget,
			options,
		});
		persistSuggestionsToSqlite(dbPath, run, suggestions);
		json(res, 200, {
			run,
			counts: { suggestions: suggestions.length },
			usage,
		});
	} catch (err: any) {
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
		const parsed = ListQuerySchema.safeParse({
			run_id: url.searchParams.get('run_id') ?? undefined,
			page: pageNum,
			limit: limitNum,
		});
		if (!parsed.success) {
			json(res, 400, { error: 'invalid_request', details: parsed.error.flatten() });
			return;
		}
		const { run_id, page, limit } = parsed.data;
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
			const totalRow = db
				.prepare(`SELECT COUNT(1) as cnt FROM suggested_order WHERE run_id = ?`)
				.get(run.run_id) as { cnt: number };
			const total = Number(totalRow?.cnt ?? 0);
			const offset = (page - 1) * limit;
			const rows = db
				.prepare(
					`SELECT suggestion_id, run_id, type_id, side, quantity, unit_price, expected_margin, rationale
					 FROM suggested_order
					 WHERE run_id = ?
					 ORDER BY expected_margin DESC
					 LIMIT ? OFFSET ?`,
				)
				.all(run.run_id, limit, offset);
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

	return http.createServer(async (req, res) => {
		try {
			const url = new URL(req.url ?? '/', 'http://localhost');
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
