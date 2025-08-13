import crypto from 'node:crypto';

import type { EsiHttp } from './index';

export type MarketOrderSnapshot = {
	readonly snapshot_id: string;
	readonly region_id: number;
	readonly system_id: number;
	readonly type_id: number;
	readonly side: 'buy' | 'sell';
	readonly price: number;
	readonly volume: number;
	readonly issued_at: string; // ISO string from ESI `issued`
	readonly snapshot_ts: string; // ISO timestamp when snapshot was taken
};

type EsiOrder = {
	order_id: number;
	type_id: number;
	location_id: number;
	system_id: number;
	is_buy_order: boolean;
	price: number;
	volume_remain: number;
	issued: string; // ISO
};

const ESI_BASE = 'https://esi.evetech.net/latest';
const THE_FORGE_REGION_ID = 10000002;
const JITA_SYSTEM_ID = 30000142;

export type FetchJitaSnapshotsParams = {
	esi: EsiHttp;
	maxPages?: number;
};

export type FetchJitaSnapshotsResult = {
	snapshots: MarketOrderSnapshot[];
	lastModified: string | null;
};

function generateSnapshotId(): string {
	if ('randomUUID' in crypto) {
		return (crypto as unknown as { randomUUID: () => string }).randomUUID();
	}
	return crypto
		.createHash('sha256')
		.update(String(Math.random()) + Date.now())
		.digest('hex');
}

export async function fetchForgeJitaOrderSnapshots(
	params: FetchJitaSnapshotsParams,
): Promise<FetchJitaSnapshotsResult> {
	const { esi, maxPages } = params;
	const baseUrl = `${ESI_BASE}/markets/${THE_FORGE_REGION_ID}/orders/`;

	// Attempt up to 2 full pagination passes to obtain a consistent Last-Modified across pages.
	for (let attempt = 0; attempt < 2; attempt += 1) {
		const page1 = await esi.fetchJson(baseUrl, { query: { page: 1 } });
		const pagesHeader = page1.headers['x-pages'];
		let inferredPages = Number(pagesHeader ?? 1);
		if (!Number.isFinite(inferredPages) || inferredPages < 1) {
			inferredPages = 1;
		}
		const limit = maxPages ?? inferredPages;
		const totalPages = Math.min(inferredPages, limit);
		const targetLastModified = page1.headers['last-modified'] ?? null;

		const orders: EsiOrder[] = [];
		if (Array.isArray(page1.body)) {
			orders.push(...(page1.body as EsiOrder[]));
		}

		let consistent = true;
		for (let page = 2; page <= totalPages; page += 1) {
			const res = await esi.fetchJson(baseUrl, { query: { page } });
			const lm = res.headers['last-modified'] ?? null;
			if (lm !== targetLastModified) {
				consistent = false;
			}
			if (Array.isArray(res.body)) {
				orders.push(...(res.body as EsiOrder[]));
			}
		}

		if (!consistent) {
			continue; // redo pagination
		}

		const snapshotTs = new Date().toISOString();
		const snapshots: MarketOrderSnapshot[] = orders
			.filter((o) => o.system_id === JITA_SYSTEM_ID)
			.map((o) => ({
				snapshot_id: generateSnapshotId(),
				region_id: THE_FORGE_REGION_ID,
				system_id: o.system_id,
				type_id: o.type_id,
				side: o.is_buy_order ? 'buy' : 'sell',
				price: o.price,
				volume: o.volume_remain,
				issued_at: o.issued,
				snapshot_ts: snapshotTs,
			}));

		return { snapshots, lastModified: targetLastModified };
	}

	// If still inconsistent, return best-effort from the last attempt; this should be rare.
	const fallback = await esi.fetchJson(baseUrl, { query: { page: 1 } });
	const fallbackOrders: EsiOrder[] = Array.isArray(fallback.body)
		? (fallback.body as EsiOrder[])
		: [];
	const snapshotTs = new Date().toISOString();
	return {
		snapshots: fallbackOrders
			.filter((o) => o.system_id === JITA_SYSTEM_ID)
			.map((o) => ({
				snapshot_id: generateSnapshotId(),
				region_id: THE_FORGE_REGION_ID,
				system_id: o.system_id,
				type_id: o.type_id,
				side: o.is_buy_order ? 'buy' : 'sell',
				price: o.price,
				volume: o.volume_remain,
				issued_at: o.issued,
				snapshot_ts: snapshotTs,
			})),
		lastModified: fallback.headers['last-modified'] ?? null,
	};
}
