export {};

async function apiRunSuggestions(budget: number): Promise<Response> {
	return fetch('/api/suggestions/run', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ budget }),
	});
}

async function apiListSuggestions(params?: {
	run_id?: string;
	page?: number;
	limit?: number;
}): Promise<{
	run: SuggestionRun;
	suggestions: SuggestedOrder[];
	page: number;
	limit: number;
	total: number;
	hasMore: boolean;
}> {
	const url = new URL('/api/suggestions', window.location.origin);
	if (params?.run_id) url.searchParams.set('run_id', params.run_id);
	if (params?.page) url.searchParams.set('page', String(params.page));
	if (params?.limit) url.searchParams.set('limit', String(params.limit));
	const res = await fetch(url);
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Failed to fetch suggestions: ${res.status} ${text}`);
	}
	return (await res.json()) as {
		run: SuggestionRun;
		suggestions: SuggestedOrder[];
		page: number;
		limit: number;
		total: number;
		hasMore: boolean;
	};
}

function formatCurrency(value: number): string {
	return new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency: 'ISK',
		currencyDisplay: 'code',
	}).format(value);
}
type FiltersState = { side: 'all' | 'buy' | 'sell'; minMargin: number };

function useSuggestions() {
	const [page, setPage] = useState(1);
	const [filters, setFilters] = useState<FiltersState>({ side: 'all', minMargin: 0 });
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [data, setData] = useState<{
		run: SuggestionRun;
		suggestions: SuggestedOrder[];
		page: number;
		limit: number;
		total: number;
		hasMore: boolean;
	} | null>(null);

	const refresh = useCallback(async (opts?: { page?: number }) => {
		setLoading(true);
		setError(null);
		try {
			const res = await apiListSuggestions({ page: opts?.page ?? page, limit: 50 });
			setData(res);
		} catch (e: any) {
			setError(String(e?.message ?? e));
		} finally {
			setLoading(false);
		}
	}, [page]);

	useEffect(() => {
		refresh().catch(() => void 0);
	}, [refresh]);

	const filtered = useMemo(() => {
		if (!data) return [] as SuggestedOrder[];
		let rows = data.suggestions.slice();
		if (filters.side === 'buy' || filters.side === 'sell') {
			rows = rows.filter((s) => s.side === filters.side);
		}
		if (Number.isFinite(filters.minMargin) && filters.minMargin > 0) {
			rows = rows.filter((s) => s.expected_margin >= filters.minMargin);
		}
		rows.sort((a, b) => b.expected_margin - a.expected_margin);
		return rows;
	}, [data, filters]);

	return {
		data,
		loading,
		error,
		page,
		setPage,
		filters,
		setFilters,
		refresh,
		filtered,
	};
}

export function App(): React.ReactElement {
	const state = useSuggestions();
	return (
		<div style={{ margin: '2rem', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif' }}>
			<header style={{ marginBottom: '1rem' }}>
				<h2>Suggestions</h2>
				<p>Trigger a suggestion run and view results. Read-only, Jita-focused analysis.</p>
			</header>
			<RunForm onRunComplete={() => state.refresh()} />
			<Filters
				side={state.filters.side}
				minMargin={state.filters.minMargin}
				onChange={(f) => state.setFilters(f)}
			/>
			<SuggestionsTable
				data={state.data}
				rows={state.filtered}
				loading={state.loading}
				error={state.error}
				onPrev={() => {
					const next = Math.max(1, state.page - 1);
					state.setPage(next);
					state.refresh({ page: next });
				}}
				onNext={() => {
					const next = state.page + 1;
					state.setPage(next);
					state.refresh({ page: next });
				}}
			/>
		</div>
	);
}

function RunForm({ onRunComplete }: { onRunComplete: () => void }): React.ReactElement {
	const [budget, setBudget] = useState<string>('');
	const [status, setStatus] = useState<string>('');
	const [running, setRunning] = useState<boolean>(false);

	const onSubmit = useCallback(async (e: React.FormEvent) => {
		e.preventDefault();
		const value = Number(budget);
		if (!Number.isFinite(value) || value <= 0) {
			setStatus('Enter a positive budget.');
			return;
		}
		setRunning(true);
		setStatus('Running... This may take a moment.');
		try {
			const res = await apiRunSuggestions(value);
			if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
			setStatus('Run complete.');
			onRunComplete();
		} catch (err: any) {
			setStatus(`Run failed: ${String(err?.message ?? err)}`);
		} finally {
			setRunning(false);
		}
	}, [budget, onRunComplete]);

	return (
		<form onSubmit={onSubmit} style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '1rem' }}>
			<label htmlFor="budget">Budget (ISK):</label>
			<input id="budget" name="budget" type="number" min={1} step={1} placeholder="100000000" required value={budget} onChange={(e) => setBudget(e.target.value)} style={{ width: '14rem', padding: '.4rem .5rem' }} />
			<button id="run-btn" type="submit" disabled={running} style={{ padding: '.4rem .75rem' }}>Run</button>
			<div id="status" style={{ minHeight: '1.25rem', color: '#444' }}>{status}</div>
		</form>
	);
}

function Filters(props: { side: 'all' | 'buy' | 'sell'; minMargin: number; onChange: (f: FiltersState) => void }): React.ReactElement {
	return (
		<section style={{ margin: '.5rem 0 1rem', display: 'flex', gap: '.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
			<label htmlFor="side-filter">Side:</label>
			<select id="side-filter" value={props.side} onChange={(e) => props.onChange({ side: e.target.value as FiltersState['side'], minMargin: props.minMargin })}>
				<option value="all">All</option>
				<option value="buy">Buy</option>
				<option value="sell">Sell</option>
			</select>

			<label htmlFor="min-margin">Min expected margin (ISK):</label>
			<input id="min-margin" type="number" step={1} min={0} placeholder="0" value={String(props.minMargin)} onChange={(e) => props.onChange({ side: props.side, minMargin: Number(e.target.value || '0') })} />
		</section>
	);
}

function SuggestionsTable(props: {
	data: { run: SuggestionRun; page: number; total: number; hasMore: boolean } | null;
	rows: SuggestedOrder[];
	loading: boolean;
	error: string | null;
	onPrev: () => void;
	onNext: () => void;
}): React.ReactElement {
	if (props.error) return <div>{props.error}</div>;
	if (props.loading && !props.data) return <div>Loading...</div>;
	if (!props.data) return <div>No data loaded yet.</div>;
	return (
		<div>
			<div className="run-info" style={{ margin: '.75rem 0', color: '#333' }}>
				{`Run ${props.data.run.run_id} • Strategy: ${props.data.run.strategy} • Budget: ${formatCurrency(props.data.run.budget)} • ${props.data.total} suggestions`}
			</div>
			<table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
				<thead>
					<tr>
						<th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '.5rem', background: '#f7f7f7', position: 'sticky', top: 0 }}>Type ID</th>
						<th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '.5rem', background: '#f7f7f7', position: 'sticky', top: 0 }}>Side</th>
						<th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '.5rem', background: '#f7f7f7', position: 'sticky', top: 0 }}>Qty</th>
						<th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '.5rem', background: '#f7f7f7', position: 'sticky', top: 0 }}>Unit Price</th>
						<th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '.5rem', background: '#f7f7f7', position: 'sticky', top: 0 }}>Expected Margin</th>
						<th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '.5rem', background: '#f7f7f7', position: 'sticky', top: 0 }}>Rationale</th>
					</tr>
				</thead>
				<tbody>
					{props.rows.map((s) => (
						<tr key={s.suggestion_id}>
							<td style={{ borderBottom: '1px solid #ddd', padding: '.5rem' }}>{s.type_id}</td>
							<td style={{ borderBottom: '1px solid #ddd', padding: '.5rem' }}>{s.side}</td>
							<td style={{ borderBottom: '1px solid #ddd', padding: '.5rem' }}>{s.quantity}</td>
							<td style={{ borderBottom: '1px solid #ddd', padding: '.5rem' }}>{formatCurrency(s.unit_price)}</td>
							<td style={{ borderBottom: '1px solid #ddd', padding: '.5rem' }}>{formatCurrency(s.expected_margin)}</td>
							<td style={{ borderBottom: '1px solid #ddd', padding: '.5rem' }}>{s.rationale}</td>
						</tr>
					))}
				</tbody>
			</table>
			<div className="pagination" style={{ marginTop: '.75rem', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
				<button onClick={props.onPrev} disabled={props.data.page <= 1}>Prev</button>
				<span className="page">{` Page ${props.data.page} `}</span>
				<button onClick={props.onNext} disabled={!props.data.hasMore}>Next</button>
			</div>
		</div>
	);
}
