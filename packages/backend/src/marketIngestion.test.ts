import { describe, it, expect, vi, afterEach } from 'vitest';
import { EsiClient } from './esiClient';
import { fetchForgeJitaOrderSnapshots } from './marketIngestion';

describe('market ingestion', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('fetches paginated orders, enforces consistent Last-Modified, filters to Jita', async () => {
		const client = new EsiClient({ dbPath: ':memory:' });

		const lastModified = new Date().toUTCString();

		const page1Orders = [
			{
				order_id: 1,
				type_id: 34,
				location_id: 60003760,
				system_id: 30000142, // Jita
				is_buy_order: true,
				price: 4.5,
				volume_remain: 1000,
				issued: new Date(Date.now() - 60_000).toISOString(),
			},
			{
				order_id: 2,
				type_id: 35,
				location_id: 60003760,
				system_id: 30000144, // not Jita
				is_buy_order: false,
				price: 10,
				volume_remain: 50,
				issued: new Date(Date.now() - 120_000).toISOString(),
			},
		];

		const page2Orders = [
			{
				order_id: 3,
				type_id: 36,
				location_id: 60003760,
				system_id: 30000142, // Jita
				is_buy_order: false,
				price: 9.9,
				volume_remain: 10,
				issued: new Date(Date.now() - 30_000).toISOString(),
			},
		];

		const fetchMock = vi.spyOn(globalThis, 'fetch');

		// First attempt: inconsistent Last-Modified across pages to trigger retry
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify(page1Orders), {
				status: 200,
				headers: { 'x-pages': '2', 'last-modified': lastModified },
			}) as unknown as Response,
		);
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify(page2Orders), {
				status: 200,
				headers: { 'last-modified': new Date(Date.now() + 1000).toUTCString() },
			}) as unknown as Response,
		);

		// Second attempt: consistent across pages
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify(page1Orders), {
				status: 200,
				headers: { 'x-pages': '2', 'last-modified': lastModified },
			}) as unknown as Response,
		);
		fetchMock.mockResolvedValueOnce(
			new Response(JSON.stringify(page2Orders), {
				status: 200,
				headers: { 'last-modified': lastModified },
			}) as unknown as Response,
		);

		const { snapshots, lastModified: lm } = await fetchForgeJitaOrderSnapshots({ esi: client });
		expect(lm).toBe(lastModified);
		// Only orders from Jita should be included: 2 orders across 2 pages
		expect(snapshots.length).toBe(2);
		const sides = new Set(snapshots.map((s) => s.side));
		expect(sides.has('buy')).toBe(true);
		expect(sides.has('sell')).toBe(true);
		snapshots.forEach((s) => {
			expect(s.system_id).toBe(30000142);
			expect(s.region_id).toBe(10000002);
			expect(typeof s.snapshot_id).toBe('string');
			expect(s.snapshot_ts).toBeTypeOf('string');
		});
	});
});
