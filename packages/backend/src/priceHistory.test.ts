import { describe, it, expect, vi, afterEach } from 'vitest';
import { EsiClient } from './esiClient';
import { fetchForgePriceHistory, upsertPriceHistoryRows } from './priceHistory';
import DatabaseConstructor from 'better-sqlite3';

describe('price history loader', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('fetches and maps ESI price history rows', async () => {
		const client = new EsiClient({ dbPath: ':memory:' });
		const payload = [
			{
				date: '2024-06-01',
				average: 10.5,
				highest: 11.0,
				lowest: 10.0,
				order_count: 100,
				volume: 5000,
			},
			{
				date: '2024-06-02',
				average: 10.8,
				highest: 11.2,
				lowest: 10.2,
				order_count: 120,
				volume: 6000,
			},
		];
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response(JSON.stringify(payload), { status: 200 }) as unknown as Response,
		);

		const rows = await fetchForgePriceHistory({ esi: client, typeId: 34 });
		expect(rows.length).toBe(2);
		expect(rows[0]).toEqual({ date: '2024-06-01', average: 10.5, volume: 5000 });
		expect(rows[1]).toEqual({ date: '2024-06-02', average: 10.8, volume: 6000 });
	});

	it('upserts rows keyed by (region_id, type_id, day)', () => {
		const dbPath = ':memory:';
		const db = new DatabaseConstructor(dbPath);
		try {
			db.exec(`CREATE TABLE price_history_daily (
                region_id INTEGER NOT NULL,
                type_id INTEGER NOT NULL,
                day TEXT NOT NULL,
                avg_price REAL NOT NULL,
                volume INTEGER NOT NULL,
                PRIMARY KEY (region_id, type_id, day)
            );`);
		} finally {
			db.close();
		}
		const res1 = upsertPriceHistoryRows({
			dbPath,
			regionId: 10000002,
			typeId: 34,
			rows: [
				{ date: '2024-06-01', average: 10.5, volume: 5000 },
				{ date: '2024-06-02', average: 10.8, volume: 6000 },
			],
		});
		expect(res1.upserts).toBe(2);

		// Upsert again with changed values to verify update
		const res2 = upsertPriceHistoryRows({
			dbPath,
			regionId: 10000002,
			typeId: 34,
			rows: [{ date: '2024-06-01', average: 11.0, volume: 7000 }],
		});
		expect(res2.upserts).toBe(1);

		const db2 = new DatabaseConstructor(dbPath);
		try {
			const row = db2
				.prepare(
					`SELECT avg_price, volume FROM price_history_daily WHERE region_id=? AND type_id=? AND day=?`,
				)
				.get(10000002, 34, '2024-06-01') as { avg_price: number; volume: number };
			expect(row.avg_price).toBe(11.0);
			expect(row.volume).toBe(7000);
		} finally {
			db2.close();
		}
	});
});
