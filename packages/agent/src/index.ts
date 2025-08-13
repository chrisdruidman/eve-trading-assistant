import crypto from 'node:crypto';
import DatabaseConstructor from 'better-sqlite3';
import { z } from 'zod';

import type { SuggestionRun, SuggestedOrder } from '@eve-jita-ai/shared/src/index';

export function helloAgent(): string {
	return 'agent-ready';
}

export type MarketOrderSnapshot = {
	readonly snapshot_id: string;
	readonly region_id: number;
	readonly system_id: number;
	readonly type_id: number;
	readonly side: 'buy' | 'sell';
	readonly price: number;
	readonly volume: number;
	readonly issued_at: string;
	readonly snapshot_ts: string;
};

type AggregatedTypeFeatures = {
	type_id: number;
	best_bid: number | null;
	best_ask: number | null;
	buy_volume: number;
	sell_volume: number;
	spread: number | null;
	spread_pct: number | null;
	// optional risk inputs
	cv_30d?: number | null;
	avg_volume_30d?: number | null;
};

function generateUuid(): string {
	if ('randomUUID' in crypto) {
		// @ts-expect-error Node typings expose randomUUID on crypto
		return crypto.randomUUID();
	}
	return crypto
		.createHash('sha256')
		.update(String(Math.random()) + Date.now())
		.digest('hex');
}

function aggregateFeaturesByType(snapshots: MarketOrderSnapshot[]): AggregatedTypeFeatures[] {
	const byType: Map<number, AggregatedTypeFeatures> = new Map();
	for (const s of snapshots) {
		let agg = byType.get(s.type_id);
		if (!agg) {
			agg = {
				type_id: s.type_id,
				best_bid: null,
				best_ask: null,
				buy_volume: 0,
				sell_volume: 0,
				spread: null,
				spread_pct: null,
			};
			byType.set(s.type_id, agg);
		}
		if (s.side === 'buy') {
			agg.best_bid = agg.best_bid == null ? s.price : Math.max(agg.best_bid, s.price);
			agg.buy_volume += s.volume;
		} else {
			agg.best_ask = agg.best_ask == null ? s.price : Math.min(agg.best_ask, s.price);
			agg.sell_volume += s.volume;
		}
	}
	for (const agg of byType.values()) {
		if (agg.best_ask != null && agg.best_bid != null) {
			agg.spread = agg.best_ask - agg.best_bid;
			agg.spread_pct = agg.best_ask > 0 ? (agg.best_ask - agg.best_bid) / agg.best_ask : null;
		}
	}
	return [...byType.values()];
}

export type ComputeOptions = {
	brokerFee?: number; // default 0.03
	salesTax?: number; // default 0.02
	otherFeesBuffer?: number; // default 0.01
	minVolume?: number; // default 100
	perTypeBudgetCapPct?: number; // default 0.15
	minSpreadPct?: number; // default 0.05
	maxSuggestions?: number; // default 25
	model?: string; // default env or claude-sonnet-4-20250514
	maxTokens?: number; // default 1500
	temperature?: number; // default 0.1
	// for testing
	anthropicClient?: AnthropicClient;
	// risk controls
	maxCv30d?: number; // default 1.0 (high volatility filtered)
	minAvgVolume30d?: number; // default 1000 (liquidity floor)
};

export type ComputeParams = {
	snapshots: MarketOrderSnapshot[];
	budget: number;
	options?: ComputeOptions;
	// Optional precomputed risk metrics keyed by type_id
	riskByType?: Record<number, { cv_30d: number | null; avg_volume_30d: number | null }>;
};

export type ComputeResult = {
	run: SuggestionRun;
	suggestions: SuggestedOrder[];
	usage: { inputTokens?: number; outputTokens?: number };
};

const LlmSuggestionSchema = z.object({
	type_id: z.number().int().nonnegative(),
	side: z.enum(['buy', 'sell']),
	unit_price: z.number().nonnegative(),
	quantity: z.number().int().nonnegative(),
	expected_margin: z.number().optional(),
	rationale: z.string().min(1),
});

const LlmResponseSchema = z.object({
	suggestions: z.array(LlmSuggestionSchema).max(1000),
});

function buildSystemPrompt(): string {
	return [
		'You are an assistant generating conservative, explainable market suggestions for EVE Online at Jita.',
		'Only produce JSON that conforms to the requested schema. Do not include any commentary.',
	].join(' ');
}

function buildUserPrompt(
	features: AggregatedTypeFeatures[],
	budget: number,
	opts: Required<
		Pick<
			ComputeOptions,
			| 'brokerFee'
			| 'salesTax'
			| 'otherFeesBuffer'
			| 'perTypeBudgetCapPct'
			| 'minSpreadPct'
			| 'minVolume'
			| 'maxSuggestions'
			| 'maxCv30d'
			| 'minAvgVolume30d'
		>
	>,
): string {
	const payload = {
		budget,
		constraints: {
			brokerFee: opts.brokerFee,
			salesTax: opts.salesTax,
			otherFeesBuffer: opts.otherFeesBuffer,
			perTypeBudgetCapPct: opts.perTypeBudgetCapPct,
			minSpreadPct: opts.minSpreadPct,
			minVolume: opts.minVolume,
			maxSuggestions: opts.maxSuggestions,
			maxCv30d: opts.maxCv30d,
			minAvgVolume30d: opts.minAvgVolume30d,
		},
		features: features.map((f) => ({
			type_id: f.type_id,
			best_bid: f.best_bid,
			best_ask: f.best_ask,
			spread: f.spread,
			spread_pct: f.spread_pct,
			sell_volume: f.sell_volume,
			buy_volume: f.buy_volume,
			cv_30d: f.cv_30d ?? null,
			avg_volume_30d: f.avg_volume_30d ?? null,
		})),
		required_output_schema: {
			suggestions: [
				{
					type_id: 'number',
					side: "'buy' | 'sell'",
					unit_price: 'number',
					quantity: 'number',
					expected_margin: 'number',
					rationale: 'string',
				},
			],
		},
	};
	return [
		'Generate up to maxSuggestions buy-side opportunities at Jita using conservative assumptions.',
		'Only include items where spread_pct >= minSpreadPct and sell_volume >= minVolume and best_ask != null and best_bid != null.',
		'Prefer lower volatility (cv_30d <= maxCv30d) and adequate liquidity (avg_volume_30d >= minAvgVolume30d).',
		'Prefer diversified picks across types. Respond with JSON object: { "suggestions": [...] } only.',
		JSON.stringify(payload, null, 2),
	].join('\n');
}

class AnthropicClient {
	private readonly apiKey: string;
	private readonly model: string;
	private readonly temperature: number;
	private readonly maxTokens: number;

	constructor(params: { apiKey: string; model: string; temperature: number; maxTokens: number }) {
		this.apiKey = params.apiKey;
		this.model = params.model;
		this.temperature = params.temperature;
		this.maxTokens = params.maxTokens;
	}

	async completeJSON(
		system: string,
		user: string,
	): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
		const res = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-api-key': this.apiKey,
				// Use a widely supported version. If you upgrade, do so centrally here.
				'anthropic-version': '2023-06-01',
			},
			body: JSON.stringify({
				model: this.model,
				temperature: this.temperature,
				max_tokens: this.maxTokens,
				system,
				messages: [{ role: 'user', content: user }],
			}),
		});
		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Anthropic request failed: ${res.status} ${text}`);
		}
		const data = (await res.json()) as any;
		const content =
			Array.isArray(data.content) && data.content.length ? data.content[0].text : '';
		const inputTokens = data?.usage?.input_tokens as number | undefined;
		const outputTokens = data?.usage?.output_tokens as number | undefined;
		return { text: content, inputTokens, outputTokens };
	}
}

export async function computeAnthropicBaselineSuggestions(
	params: ComputeParams,
): Promise<ComputeResult> {
	const { snapshots, budget } = params;
	const options = params.options ?? {};
	const brokerFee = options.brokerFee ?? 0.03;
	const salesTax = options.salesTax ?? 0.02;
	const otherFeesBuffer = options.otherFeesBuffer ?? 0.01;
	const minVolume = options.minVolume ?? 100;
	const perTypeBudgetCapPct = options.perTypeBudgetCapPct ?? 0.15;
	const minSpreadPct = options.minSpreadPct ?? 0.05;
	const maxSuggestions = options.maxSuggestions ?? 25;
	const maxCv30d = options.maxCv30d ?? 1.0;
	const minAvgVolume30d = options.minAvgVolume30d ?? 1000;

	const model = options.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';
	const temperature = options.temperature ?? 0.1;
	const maxTokens = options.maxTokens ?? 1500;

	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey && !options.anthropicClient) {
		throw new Error('ANTHROPIC_API_KEY is required');
	}

	// Aggregate features and prefilter to reduce token usage
	const riskByType = params.riskByType ?? {};
	const features = aggregateFeaturesByType(snapshots)
		.map((f) => ({
			...f,
			cv_30d: riskByType[f.type_id]?.cv_30d ?? null,
			avg_volume_30d: riskByType[f.type_id]?.avg_volume_30d ?? null,
		}))
		.filter((f) => f.best_ask != null && f.best_bid != null)
		.filter((f) => (f.spread_pct ?? 0) >= minSpreadPct && f.sell_volume >= minVolume)
		.filter((f) => f.cv_30d == null || f.cv_30d <= maxCv30d)
		.filter((f) => f.avg_volume_30d == null || f.avg_volume_30d >= minAvgVolume30d)
		.sort((a, b) => (b.spread_pct ?? 0) - (a.spread_pct ?? 0))
		.slice(0, Math.max(maxSuggestions * 4, 50));

	const system = buildSystemPrompt();
	const user = buildUserPrompt(features, budget, {
		brokerFee,
		salesTax,
		otherFeesBuffer,
		perTypeBudgetCapPct,
		minSpreadPct,
		minVolume,
		maxSuggestions,
		maxCv30d,
		minAvgVolume30d,
	});

	const client =
		options.anthropicClient ??
		new AnthropicClient({ apiKey: apiKey as string, model, temperature, maxTokens });
	const completion = await client.completeJSON(system, user);

	// Parse and validate
	let parsed: unknown;
	try {
		parsed = JSON.parse(completion.text);
	} catch (e) {
		throw new Error('LLM did not return valid JSON');
	}
	const validated = LlmResponseSchema.safeParse(parsed);
	if (!validated.success) {
		throw new Error(`LLM JSON failed validation: ${validated.error.message}`);
	}

	// Build run and finalize suggestions with IDs and caps
	const runId = generateUuid();
	const startedAt = new Date().toISOString();
	const strategy = 'anthropic:baseline:v1';

	const suggestions: SuggestedOrder[] = [];
	const perTypeCap = budget * perTypeBudgetCapPct;
	for (const s of validated.data.suggestions.slice(0, maxSuggestions)) {
		const unitPrice = s.unit_price;
		const maxAffordableQty =
			unitPrice > 0 ? Math.floor(Math.min(perTypeCap, budget) / unitPrice) : 0;
		const quantity = Math.max(0, Math.min(s.quantity, maxAffordableQty));
		if (quantity <= 0) continue;

		const effectiveFees = brokerFee + salesTax + otherFeesBuffer;
		const expectedMargin =
			typeof s.expected_margin === 'number'
				? s.expected_margin
				: Math.max(
						0,
						(features.find((f) => f.type_id === s.type_id)?.best_bid ?? 0) - unitPrice,
					) *
						quantity -
					unitPrice * quantity * effectiveFees;

		suggestions.push({
			suggestion_id: generateUuid(),
			run_id: runId,
			type_id: s.type_id,
			side: s.side,
			quantity,
			unit_price: unitPrice,
			expected_margin: expectedMargin,
			rationale: s.rationale,
		});
	}

	const finishedAt = new Date().toISOString();
	const run: SuggestionRun = {
		run_id: runId,
		started_at: startedAt,
		finished_at: finishedAt,
		strategy,
		budget,
	};

	return {
		run,
		suggestions,
		usage: { inputTokens: completion.inputTokens, outputTokens: completion.outputTokens },
	};
}

export function persistSuggestionsToSqlite(
	dbPath: string,
	run: SuggestionRun,
	suggestions: SuggestedOrder[],
): { applied: { run: boolean; suggestions: number } } {
	const db = new DatabaseConstructor(dbPath);
	try {
		const tx = db.transaction(() => {
			db.prepare(
				'INSERT OR REPLACE INTO suggestion_run (run_id, started_at, finished_at, strategy, budget) VALUES (?, ?, ?, ?, ?)',
			).run(run.run_id, run.started_at, run.finished_at, run.strategy, run.budget);

			const insertSuggestion = db.prepare(
				'INSERT OR REPLACE INTO suggested_order (suggestion_id, run_id, type_id, side, quantity, unit_price, expected_margin, rationale) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			);
			for (const s of suggestions) {
				insertSuggestion.run(
					s.suggestion_id,
					s.run_id,
					s.type_id,
					s.side,
					s.quantity,
					s.unit_price,
					s.expected_margin,
					s.rationale,
				);
			}
		});
		tx();
		return { applied: { run: true, suggestions: suggestions.length } };
	} finally {
		db.close();
	}
}

export type { SuggestionRun, SuggestedOrder };
