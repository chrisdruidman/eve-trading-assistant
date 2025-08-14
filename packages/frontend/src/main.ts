type SuggestionRun = {
	run_id: string;
	started_at: string;
	finished_at: string | null;
	strategy: string;
	budget: number;
};

type SuggestedOrder = {
	suggestion_id: string;
	run_id: string;
	type_id: number;
	side: 'buy' | 'sell';
	quantity: number;
	unit_price: number;
	expected_margin: number;
	rationale: string;
};

type ListResponse = {
	run: SuggestionRun;
	suggestions: SuggestedOrder[];
	page: number;
	limit: number;
	total: number;
	hasMore: boolean;
};

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
}): Promise<ListResponse> {
	const url = new URL('/api/suggestions', window.location.origin);
	if (params?.run_id) url.searchParams.set('run_id', params.run_id);
	if (params?.page) url.searchParams.set('page', String(params.page));
	if (params?.limit) url.searchParams.set('limit', String(params.limit));
	const res = await fetch(url);
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Failed to fetch suggestions: ${res.status} ${text}`);
	}
	return (await res.json()) as ListResponse;
}

function formatCurrency(value: number): string {
	return new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency: 'ISK',
		currencyDisplay: 'code',
	}).format(value);
}

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	props?: Record<string, any>,
	...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (props) Object.assign(node, props);
	for (const child of children) {
		node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
	}
	return node;
}

function renderSuggestions(container: HTMLElement, data: ListResponse): void {
	const sideFilterEl = document.getElementById('side-filter') as HTMLSelectElement | null;
	const minMarginEl = document.getElementById('min-margin') as HTMLInputElement | null;
	const sideFilterVal = sideFilterEl?.value ?? 'all';
	const minMarginVal = Number((minMarginEl?.value ?? '').trim() || '0');

	let rows = data.suggestions.slice();
	if (sideFilterVal === 'buy' || sideFilterVal === 'sell') {
		rows = rows.filter((s) => s.side === (sideFilterVal as 'buy' | 'sell'));
	}
	if (Number.isFinite(minMarginVal) && minMarginVal > 0) {
		rows = rows.filter((s) => s.expected_margin >= minMarginVal);
	}
	rows.sort((a, b) => b.expected_margin - a.expected_margin);

	const table = el(
		'table',
		{ className: 'table' },
		el(
			'thead',
			{},
			el(
				'tr',
				{},
				el('th', {}, 'Type ID'),
				el('th', {}, 'Side'),
				el('th', {}, 'Qty'),
				el('th', {}, 'Unit Price'),
				el('th', {}, 'Expected Margin'),
				el('th', {}, 'Rationale'),
			),
		),
		el(
			'tbody',
			{},
			...rows.map((s) =>
				el(
					'tr',
					{},
					el('td', {}, String(s.type_id)),
					el('td', {}, s.side),
					el('td', {}, String(s.quantity)),
					el('td', {}, formatCurrency(s.unit_price)),
					el('td', {}, formatCurrency(s.expected_margin)),
					el('td', {}, s.rationale),
				),
			),
		),
	);

	const info = el(
		'div',
		{ className: 'run-info' },
		`Run ${data.run.run_id} • Strategy: ${data.run.strategy} • Budget: ${formatCurrency(
			data.run.budget,
		)} • ${data.total} suggestions`,
	);

	const pag = el('div', { className: 'pagination' });
	const prev = el('button', { disabled: data.page <= 1 }, 'Prev');
	const next = el('button', { disabled: !data.hasMore }, 'Next');
	prev.addEventListener('click', () => refresh({ page: data.page - 1 }));
	next.addEventListener('click', () => refresh({ page: data.page + 1 }));
	pag.appendChild(prev);
	pag.appendChild(el('span', { className: 'page' }, ` Page ${data.page} `));
	pag.appendChild(next);

	container.replaceChildren(info, table, pag);
}

async function refresh(opts?: { run_id?: string; page?: number; limit?: number }): Promise<void> {
	const suggestionsEl = document.getElementById('suggestions')!;
	suggestionsEl.textContent = 'Loading...';
	try {
		const data = await apiListSuggestions({
			run_id: opts?.run_id,
			page: opts?.page,
			limit: opts?.limit,
		});
		renderSuggestions(suggestionsEl, data);
	} catch (err: any) {
		suggestionsEl.textContent = String(err?.message ?? err);
	}
}

function mount(): void {
	const form = document.getElementById('run-form') as HTMLFormElement;
	const budgetInput = document.getElementById('budget') as HTMLInputElement;
	const runBtn = document.getElementById('run-btn') as HTMLButtonElement;
	const statusEl = document.getElementById('status') as HTMLDivElement;

	form.addEventListener('submit', async (e) => {
		e.preventDefault();
		const budget = Number(budgetInput.value);
		if (!Number.isFinite(budget) || budget <= 0) {
			statusEl.textContent = 'Enter a positive budget.';
			return;
		}
		runBtn.disabled = true;
		statusEl.textContent = 'Running... This may take a moment.';
		try {
			const res = await apiRunSuggestions(budget);
			if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
			statusEl.textContent = 'Run complete.';
			await refresh();
		} catch (err: any) {
			statusEl.textContent = `Run failed: ${String(err?.message ?? err)}`;
		} finally {
			runBtn.disabled = false;
		}
	});

	// Initial load of latest suggestions (if any)
	refresh().catch(() => void 0);
}

window.addEventListener('DOMContentLoaded', mount);
export {};
