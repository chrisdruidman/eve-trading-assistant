import { describe, it, expect, vi, afterEach } from 'vitest';
import { helloBackend } from './index';
import { EsiClient, CircuitOpenError } from './esiClient';
import { runSqliteMigrations } from './db/migrate';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('backend smoke', () => {
	it('helloBackend returns readiness string', () => {
		expect(helloBackend()).toBe('backend-ready');
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('EsiClient caches ETag and treats 304 as cache hit', async () => {
		const client = new EsiClient({ dbPath: ':memory:' });

		const etag = 'W/"abc123"';
		const expires = new Date(Date.now() + 60_000).toUTCString();
		const lastModified = new Date().toUTCString();

		const fetchMock = vi.spyOn(globalThis, 'fetch');
		// First call: 200 with ETag and body
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: {
					etag,
					expires,
					'last-modified': lastModified,
				},
			}) as unknown as Response,
		);

		const first = await client.fetchJson('https://example.com/test');
		expect(first.status).toBe(200);
		expect(first.fromCache).toBe(false);
		expect(first.headers['etag']).toBe(etag);

		// Second call: 304 Not Modified
		fetchMock.mockResolvedValueOnce(
			new Response(null, {
				status: 304,
				headers: {
					etag,
				},
			}) as unknown as Response,
		);

		const second = await client.fetchJson('https://example.com/test');
		expect(second.status).toBe(304);
		expect(second.fromCache).toBe(true);
	});

	it('runSqliteMigrations creates required tables', async () => {
		// Use a temporary on-disk DB to persist within test scope
		const tmp = `test-db-${Date.now()}.sqlite`;
		const herePath = fileURLToPath(import.meta.url);
		const hereDir = path.dirname(herePath);
		const migrationsDir = path.resolve(hereDir, '../migrations');
		const result = runSqliteMigrations({
			dbPath: tmp,
			migrationsDir,
		});
		expect(Array.isArray(result.applied)).toBe(true);
		// Re-run should be idempotent and apply nothing new
		const result2 = runSqliteMigrations({
			dbPath: tmp,
			migrationsDir,
		});
		expect(result2.applied.length).toBe(0);
	});

	it('opens circuit on repeated 5xx/429 and degrades gracefully', async () => {
		const client = new EsiClient({
			dbPath: ':memory:',
			failureThreshold: 2,
			maxRetries: 0,
			minOpenDurationMs: 10,
		});
		const fetchMock = vi.spyOn(globalThis, 'fetch');
		fetchMock.mockResolvedValueOnce(
			new Response('server error', { status: 500 }) as unknown as Response,
		);
		await expect(client.fetchJson('https://example.com/unstable')).rejects.toBeInstanceOf(
			Error,
		);
		fetchMock.mockResolvedValueOnce(
			new Response('server error', { status: 500 }) as unknown as Response,
		);
		await expect(client.fetchJson('https://example.com/unstable')).rejects.toBeInstanceOf(
			Error,
		);
		// Now circuit should be open and reject immediately with CircuitOpenError
		await expect(client.fetchJson('https://example.com/unstable')).rejects.toBeInstanceOf(
			CircuitOpenError,
		);
	});
});
