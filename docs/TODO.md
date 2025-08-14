## Work Plan for AI Agents

Pick tasks top-down, honoring dependencies. Check off items as they are completed in code. Keep edits small and well-documented.

### Dependency Graph

```mermaid
graph LR
  T01[Foundation: Workspace + Scaffolding] --> T02[Backend: ESI Client + Cache Layer]
  T02 --> T03[Backend: Market Snapshot Ingestion (The Forge)]
  T03 --> T04[DB: Suggestion Schema + Migrations]
  T04 --> T05[Agent: Baseline Heuristic Strategy]
  T05 --> T06[Backend: Suggestion API Endpoints]
  T06 --> T07[Frontend: Suggestions UI]
  T03 --> T08[DB: Daily Price History Loader]
  T08 --> T09[Agent: Risk/Volatility Features]
  T05 --> T10[Agent: Budget + Position Sizing]
  T02 --> T11[Ops: Error-Limit Telemetry + Backoff]
  T11 --> T12[Ops: Circuit Breaker + Recovery]
  T06 --> T16[Frontend: React + TypeScript Migration]
```

### Tasks

- [x] [T-01] Foundation: Workspace and Scaffolding
    - **goal**: Initialize monorepo workspaces and basic package layout (`packages/backend`, `packages/frontend`, `packages/agent`, `packages/shared`).
    - **includes**: TypeScript setup, linting/formatting, testing harnesses, shared tsconfig, basic CI.
    - **deps**: none

- [x] [T-02] Backend: ESI Client and Cache Layer
    - **goal**: Implement a thin ESI client wrapper that enforces best practices.
    - **includes**:
        - Inject `User-Agent` (or `X-User-Agent`/`user_agent`) with app name, version, and contact.
        - Persist `ETag`, `expires`, `last-modified`, `http_status` per URL in `esi_cache_entry`.
        - Add `If-None-Match` on subsequent requests; treat `304` as cache hit.
        - Exponential backoff with full jitter for 429/5xx; observe `X-ESI-Error-Limit-*`.
    - **deps**: [T-01]
    - **refs**: [ESI Best Practices](https://developers.eveonline.com/docs/services/esi/best-practices/)

- [x] [T-03] Backend: Market Snapshot Ingestion (The Forge Region)
    - **goal**: Fetch region orders for 10000002 and filter Jita system 30000142 data into normalized snapshots.
    - **includes**: Pagination with `page` param, stable `last-modified` across pages; retry on inconsistency.
    - **deps**: [T-02]

- [x] [T-04] Database: Suggestion Schema + Migrations
    - **goal**: Create SQLite tables for `suggestion_run` and `suggested_order`.
    - **includes**: One-way migrations stored in `packages/backend/migrations`.
    - **deps**: [T-01]

- [x] [T-05] Agent: Baseline Strategy (Anthropic-powered)
    - **goal**: Use Anthropic to analyze aggregated Jita snapshot features and return structured buy/sell suggestions with rationales.
    - **includes**: Conservative fee assumptions, min volume thresholds, per-type budget caps, JSON-only structured output validation.
    - **notes**: Server-side only; configure `ANTHROPIC_API_KEY`. Default model `claude-sonnet-4-20250514` (override via `ANTHROPIC_MODEL`). Include SQLite persistence helper. Do not send raw PII; only derived market features.
    - **deps**: [T-03], [T-04]

- [x] [T-06] Backend: Suggestion API Endpoints
    - **goal**: Expose endpoints to run a suggestion pass and to list the latest suggestions by `run_id`.
    - **includes**: Validation for inputs (budget, constraints) and pagination for results.
    - **deps**: [T-05]

- [x] [T-07] Frontend: Suggestions UI
    - **goal**: Basic UI to trigger a run, view suggestions, and inspect rationales and risk flags.
    - **includes**: Client-side table with sorting and filtering; no order placement.
    - **deps**: [T-06]

- [x] [T-08] Database: Daily Price History Loader
    - **goal**: Load `/markets/{region_id}/history/` and maintain `price_history_daily` for The Forge.
    - **includes**: Merge/update strategy keyed by `(region_id, type_id, day)`.
    - **deps**: [T-02]

- [x] [T-09] Agent: Risk/Volatility Features
    - **goal**: Incorporate volatility (cv_30d) and liquidity (avg_volume_30d) metrics from price history to refine suggestions.
    - **includes**: Backend selector `selectRiskMetricsByType`, prompt features and filtering in agent (`maxCv30d`, `minAvgVolume30d`), server wiring to pass metrics.
    - **deps**: [T-08], [T-05]

- [x] [T-10] Agent: Budget + Position Sizing
    - **goal**: Allocate budget across suggestions with diversification and per-type caps.
    - **deps**: [T-05]

- [x] [T-11] Ops: Error-Limit Telemetry + Backoff Controls
    - **goal**: Emit metrics for `X-ESI-Error-Limit-*`, retries, and cache hit rates; surface in logs.
    - **includes**:
        - Instrumented `EsiClient` with jittered exponential backoff, max retries, and metrics exposure via `getMetrics()`.
        - Captures `X-ESI-Error-Limit-Remain` and `X-ESI-Error-Limit-Reset` from responses.
        - Emits structured logs for backoff events (`esi_backoff`) and request summaries (`esi_request`).
        - Server includes an `esi` metrics object in `POST /api/suggestions/run` responses and prints `esi_metrics_summary` to logs.
    - **deps**: [T-02]
    - **refs**: [ESI Best Practices](https://developers.eveonline.com/docs/services/esi/best-practices/)

- [x] [T-12] Ops: Circuit Breaker + Recovery
    - **goal**: Prevent cascading failures during upstream incidents and provide graceful degradation to cached data.
    - **includes**:
        - Circuit breaker added to `EsiClient` with configurable thresholds, half-open probing, and telemetry logs (`esi_circuit_update`).
        - Preemptive open when `X-ESI-Error-Limit-Remain` falls below threshold.
        - Server gracefully degrades `POST /api/suggestions/run` with 503, including latest run metadata and ESI metrics when circuit is open.
    - **deps**: [T-11]

- [x] [T-16] Frontend: React + TypeScript Migration
    - **goal**: Replace the current vanilla/imperative UI with a conventional React + TypeScript app to simplify state management, testing, and ongoing feature work.
    - **includes**:
        - Scaffolded React + TS (Vite) in `packages/frontend` with workspace-aware config `vite.config.ts`.
        - Migrated UI into components: `App`, `RunForm`, `Filters`, `SuggestionsTable`.
        - Reused types from `@eve-jita-ai/shared` and centralized helpers (e.g., currency formatting within React layer).
        - Configured build output to `packages/frontend/dist` and updated backend static serving in `packages/backend/src/server.ts` to serve Vite output (`index.html` and `assets/*`).
        - Added scripts: `dev` (Vite dev with proxy to backend), `build`/`preview`; integrated with root `npm run dev` which now builds frontend or can be run separately via Vite dev.
        - Added minimal tests (smoke render) with Vitest + React Testing Library; jsdom configured via dev deps and tsconfig types.
        - Removed legacy manual DOM code and `/assets/main.js` wiring; now mounting React at `#root`.
    - **deps**: [T-06]
    - **acceptance**:
        - `npm run -w @eve-jita-ai/frontend build` produces a working `dist` served by the backend at `http://localhost:3000/`.
        - `npm run dev` or `npm run -w @eve-jita-ai/frontend dev` + backend starts, app loads; run suggestions; filters and pagination behave.
        - Frontend smoke tests pass; docs updated.

- [ ] [T-17] Backend: Scheduled 5-Minute Market Snapshots + Run Uses Stored Data
    - **goal**: Automatically fetch and persist Jita market snapshots every 5 minutes and make `POST /api/suggestions/run` consume the stored snapshots instead of fetching on-demand.
    - **includes**:
        - Add a background scheduler in the backend that invokes `fetchForgeJitaOrderSnapshots` for The Forge/Jita every 5 minutes.
        - Persist results in-memory or in SQLite keyed by region/system with `snapshots`, `last_modified`, and `fetched_at`.
        - On server start, perform an immediate snapshot fetch (non-blocking) so the first run has data without waiting for the first interval.
        - Update `POST /api/suggestions/run` to read the latest stored snapshot and never call ESI during the run request path.
        - Configurables via env: `MARKET_SNAPSHOT_INTERVAL_MS` (default 300000) and `MARKET_SNAPSHOT_STALE_MS` (default 300000) for warning/health reporting.
        - Observability: log scheduled fetch start/end, duration, success/failure; include `market_snapshot_used: true`, `snapshot_age_ms`, and `snapshot_timestamp` in run responses.
        - Fallback: if no snapshot exists yet (e.g., just after boot and before first fetch completes), degrade gracefully by responding with 503 and guidance, rather than hitting ESI in the run path.
    - **deps**: [T-03], [T-11]
    - **acceptance**:
        - The backend logs show an immediate fetch on startup and subsequent scheduled fetches approximately every 5 minutes (configurable).
        - Triggering multiple `POST /api/suggestions/run` calls results in zero ESI network calls; responses include `market_snapshot_used: true` and reasonable `snapshot_age_ms`.
        - Changing `MARKET_SNAPSHOT_INTERVAL_MS` affects the schedule without code changes; `snapshot_age_ms` and logs reflect the new cadence.

### Nice-to-Haves

- [ ] [T-13] Backtesting Harness
    - **goal**: Evaluate strategies on historical data and compare against baselines.
    - **deps**: [T-08], [T-05]

- [ ] [T-14] Price Impact and Slippage Modeling
    - **goal**: Estimate fill risk and effective execution prices at varying quantities.
    - **deps**: [T-05]

- [ ] [T-15] Multi-Region Support
    - **goal**: Expand beyond Jita after the core system is stable and respectful of ESI.
    - **deps**: [T-03], [T-06]

- [ ] [T-18] Nice-to-Have: Reduce Market Snapshot TTL Toward 1 Minute
    - **goal**: Explore safely reducing snapshot TTL for fresher UI/agent inputs while respecting ESI limits.
    - **includes**:
        - Parameterize TTL and add guardrails (min TTL, request budgets, circuit thresholds).
        - Add monitoring to track request volume and cache efficiency; alert on excessive calls.
        - Experiment with 1–2 minute TTL and validate ESI behavior and app performance.
    - **deps**: [T-17]
    - **acceptance**:
        - With 1–2 minute TTL, request rates remain within safe bounds, and cache hit rates are acceptable.
        - Ability to roll back to 5 minutes via config without redeploys.

### Notes

- Keep ESI usage within reasonable bounds; honor `expires` and prefer `If-None-Match` caching to avoid unnecessary load.
- For paginated requests, ensure a consistent snapshot across pages; retry or abort if `last-modified` drifts.
- Suggestions must include a brief rationale and conservative assumptions.

### Local Environment Setup

- Create a local `.env` by copying `.env.example` at the repo root. `.env` is ignored by git. Set at least `ANTHROPIC_API_KEY`; optionally configure `SQLITE_DB_PATH`, `USER_AGENT`, and ESI circuit settings.
