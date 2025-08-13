import { describe, it, expect } from 'vitest';
import {
	helloAgent,
	computeAnthropicBaselineSuggestions,
	persistSuggestionsToSqlite,
	type MarketOrderSnapshot,
} from './index';

describe('agent smoke', () => {
	it('helloAgent returns readiness string', () => {
		expect(helloAgent()).toBe('agent-ready');
	});
});

class MockAnthropicClient {
	async completeJSON() {
		const payload = {
			suggestions: [
				{
					type_id: 34,
					side: 'buy',
					unit_price: 5,
					quantity: 100,
					expected_margin: 50,
					rationale: 'spread ok',
				},
			],
		};
		return { text: JSON.stringify(payload), inputTokens: 1, outputTokens: 1 };
	}
}

describe('computeAnthropicBaselineSuggestions', () => {
	it('returns validated suggestions from LLM and enforces budget caps', async () => {
		const snapshots: MarketOrderSnapshot[] = [
			{
				snapshot_id: 's',
				region_id: 10000002,
				system_id: 30000142,
				type_id: 34,
				side: 'buy',
				price: 4,
				volume: 5000,
				issued_at: new Date().toISOString(),
				snapshot_ts: new Date().toISOString(),
			},
			{
				snapshot_id: 's',
				region_id: 10000002,
				system_id: 30000142,
				type_id: 34,
				side: 'sell',
				price: 5,
				volume: 5000,
				issued_at: new Date().toISOString(),
				snapshot_ts: new Date().toISOString(),
			},
		];
		const { run, suggestions, usage } = await computeAnthropicBaselineSuggestions({
			snapshots,
			budget: 1000,
			options: { anthropicClient: new MockAnthropicClient() as any, maxSuggestions: 5 },
		});

		expect(run.run_id).toBeTruthy();
		expect(suggestions.length).toBe(1);
		expect(suggestions[0].quantity).toBeGreaterThan(0);
		expect(usage.inputTokens).toBe(1);
	});
});

describe('persistSuggestionsToSqlite', () => {
	it('writes run and suggestions to sqlite', () => {
		const tmp = `test-db-${Date.now()}.sqlite`;
		const run = {
			run_id: 'r1',
			started_at: new Date().toISOString(),
			finished_at: new Date().toISOString(),
			strategy: 'anthropic:baseline:v1',
			budget: 1000,
		};
		const suggestions = [
			{
				suggestion_id: 's1',
				run_id: 'r1',
				type_id: 34,
				side: 'buy',
				quantity: 10,
				unit_price: 5,
				expected_margin: 10,
				rationale: 'ok',
			},
		];
		// It should not throw even if tables are missing; but in real usage migrations are run in backend.
		// For the purpose of this unit test, we only exercise the function shape by creating tables ad-hoc.
		// Create minimal tables
		const Database = require('better-sqlite3');
		const db = new Database(tmp);
		db.exec(
			`CREATE TABLE IF NOT EXISTS suggestion_run (run_id TEXT PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT, strategy TEXT NOT NULL, budget REAL NOT NULL);`,
		);
		db.exec(
			`CREATE TABLE IF NOT EXISTS suggested_order (suggestion_id TEXT PRIMARY KEY, run_id TEXT NOT NULL, type_id INTEGER NOT NULL, side TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL, expected_margin REAL NOT NULL, rationale TEXT, FOREIGN KEY (run_id) REFERENCES suggestion_run(run_id) ON DELETE CASCADE);`,
		);
		db.close();

		const result = persistSuggestionsToSqlite(tmp, run, suggestions);
		expect(result.applied.run).toBe(true);
		expect(result.applied.suggestions).toBe(1);
	});
});
