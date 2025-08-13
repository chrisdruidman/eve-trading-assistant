export const sharedReady = true;

export type SuggestionRun = {
	run_id: string;
	started_at: string;
	finished_at: string | null;
	strategy: string;
	budget: number;
};

export type SuggestedOrder = {
	suggestion_id: string;
	run_id: string;
	type_id: number;
	side: 'buy' | 'sell';
	quantity: number;
	unit_price: number;
	expected_margin: number;
	rationale: string;
};
