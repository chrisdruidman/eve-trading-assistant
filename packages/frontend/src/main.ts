type SuggestionRun = {
\trun_id: string;
\tstarted_at: string;
\tfinished_at: string | null;
\tstrategy: string;
\tbudget: number;
};

type SuggestedOrder = {
\tsuggestion_id: string;
\trun_id: string;
\ttype_id: number;
\tside: 'buy' | 'sell';
\tquantity: number;
\tunit_price: number;
\texpected_margin: number;
\trationale: string;
};

type ListResponse = {
\trun: SuggestionRun;
\tsuggestions: SuggestedOrder[];
\tpage: number;
\tlimit: number;
\ttotal: number;
\thasMore: boolean;
};

async function apiRunSuggestions(budget: number): Promise<Response> {
\treturn fetch('/api/suggestions/run', {
\t\tmethod: 'POST',
\t\theaders: { 'content-type': 'application/json' },
\t\tbody: JSON.stringify({ budget }),
\t});
}

async function apiListSuggestions(params?: {
\trun_id?: string;
\tpage?: number;
\tlimit?: number;
}): Promise<ListResponse> {
\tconst url = new URL('/api/suggestions', window.location.origin);
\tif (params?.run_id) url.searchParams.set('run_id', params.run_id);
\tif (params?.page) url.searchParams.set('page', String(params.page));
\tif (params?.limit) url.searchParams.set('limit', String(params.limit));
\tconst res = await fetch(url);
\tif (!res.ok) {
\t\tconst text = await res.text();
\t\tthrow new Error(`Failed to fetch suggestions: ${res.status} ${text}`);
\t}
\treturn (await res.json()) as ListResponse;
}

function formatCurrency(value: number): string {
\treturn new Intl.NumberFormat(undefined, { style: 'currency', currency: 'ISK', currencyDisplay: 'code' }).format(value);
}

function el<K extends keyof HTMLElementTagNameMap>(
\ttag: K,
\tprops?: Record<string, any>,
\t...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
\tconst node = document.createElement(tag);
\tif (props) Object.assign(node, props);
\tfor (const child of children) {
\t\tnode.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
\t}
\treturn node;
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

	const table = el('table', { className: 'table' },
		el('thead', {},
			el('tr', {},
				el('th', {}, 'Type ID'),
				el('th', {}, 'Side'),
				el('th', {}, 'Qty'),
				el('th', {}, 'Unit Price'),
				el('th', {}, 'Expected Margin'),
				el('th', {}, 'Rationale'),
			),
		),
		el('tbody', {},
			...rows.map((s) =>
				el('tr', {},
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

	const info = el('div', { className: 'run-info' },
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
\tconst suggestionsEl = document.getElementById('suggestions')!;
\tsuggestionsEl.textContent = 'Loading...';
\ttry {
\t\tconst data = await apiListSuggestions({ run_id: opts?.run_id, page: opts?.page, limit: opts?.limit });
\t\trenderSuggestions(suggestionsEl, data);
\t} catch (err: any) {
\t\tsuggestionsEl.textContent = String(err?.message ?? err);
\t}
}

function mount(): void {
\tconst form = document.getElementById('run-form') as HTMLFormElement;
\tconst budgetInput = document.getElementById('budget') as HTMLInputElement;
\tconst runBtn = document.getElementById('run-btn') as HTMLButtonElement;
\tconst statusEl = document.getElementById('status') as HTMLDivElement;

\tform.addEventListener('submit', async (e) => {
\t\te.preventDefault();
\t\tconst budget = Number(budgetInput.value);
\t\tif (!Number.isFinite(budget) || budget <= 0) {
\t\t\tstatusEl.textContent = 'Enter a positive budget.';
\t\t\treturn;
\t\t}
\t\trunBtn.disabled = true;
\t\tstatusEl.textContent = 'Running... This may take a moment.';
\t\ttry {
\t\t\tconst res = await apiRunSuggestions(budget);
\t\t\tif (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
\t\t\tstatusEl.textContent = 'Run complete.';
\t\t\tawait refresh();
\t\t} catch (err: any) {
\t\t\tstatusEl.textContent = `Run failed: ${String(err?.message ?? err)}`;
\t\t} finally {
\t\t\trunBtn.disabled = false;
\t\t}
\t});

\t// Initial load of latest suggestions (if any)
\trefresh().catch(() => void 0);
}

window.addEventListener('DOMContentLoaded', mount);


