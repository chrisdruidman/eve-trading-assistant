import type { EsiHttp } from './index';
import DatabaseConstructor from 'better-sqlite3';

const ESI_BASE = 'https://esi.evetech.net/latest';
const THE_FORGE_REGION_ID = 10000002;

export type PriceHistoryRow = {
	readonly date: string; // YYYY-MM-DD
	readonly average: number; // avg_price per ESI
	readonly volume: number;
};

export async function fetchForgePriceHistory(params: {
	esi: EsiHttp;
	typeId: number;
}): Promise<PriceHistoryRow[]> {
	const { esi, typeId } = params;
	const url = `${ESI_BASE}/markets/${THE_FORGE_REGION_ID}/history/`;
	const res = await esi.fetchJson(url, { query: { type_id: typeId } });
	if (!Array.isArray(res.body)) return [];
	// ESI fields are: date (YYYY-MM-DD), average, highest, lowest, order_count, volume
	return (res.body as any[]).map((r) => ({
		date: String(r.date),
		average: Number(r.average),
		volume: Number(r.volume),
	}));
}

export function upsertPriceHistoryRows(params: {
	dbPath: string;
	regionId: number;
	typeId: number;
	rows: PriceHistoryRow[];
}): { upserts: number } {
	const { dbPath, regionId, typeId, rows } = params;
	const db = new DatabaseConstructor(dbPath);
	try {
		db.pragma('foreign_keys = ON');
		const stmt = db.prepare(
			`INSERT INTO price_history_daily (region_id, type_id, day, avg_price, volume)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(region_id, type_id, day) DO UPDATE SET
               avg_price = excluded.avg_price,
               volume = excluded.volume`,
		);
		const tx = db.transaction((batch: PriceHistoryRow[]) => {
			for (const row of batch) {
				stmt.run(regionId, typeId, row.date, row.average, row.volume);
			}
		});
		tx(rows);
		return { upserts: rows.length };
	} finally {
		db.close();
	}
}

export async function loadForgePriceHistoryForTypes(params: {
	dbPath: string;
	esi: EsiHttp;
	typeIds: number[];
}): Promise<{ processed: number }> {
	const { dbPath, esi, typeIds } = params;
	let processed = 0;
	for (const typeId of typeIds) {
		const rows = await fetchForgePriceHistory({ esi, typeId });
		if (rows.length) {
			upsertPriceHistoryRows({ dbPath, regionId: THE_FORGE_REGION_ID, typeId, rows });
		}
		processed += 1;
	}
	return { processed };
}
