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

- [ ] [T-04] Database: Suggestion Schema + Migrations
    - **goal**: Create SQLite tables for `suggestion_run` and `suggested_order`.
    - **includes**: One-way migrations stored in `packages/backend/migrations`.
    - **deps**: [T-01]

- [ ] [T-05] Agent: Baseline Heuristic Strategy
    - **goal**: Produce simple buy/sell suggestions using spreads, volumes, and fees; attach rationales.
    - **includes**: Conservative price/fee assumptions, min volume thresholds, per-type caps.
    - **deps**: [T-03], [T-04]

- [ ] [T-06] Backend: Suggestion API Endpoints
    - **goal**: Expose endpoints to run a suggestion pass and to list the latest suggestions by `run_id`.
    - **includes**: Validation for inputs (budget, constraints) and pagination for results.
    - **deps**: [T-05]

- [ ] [T-07] Frontend: Suggestions UI
    - **goal**: Basic UI to trigger a run, view suggestions, and inspect rationales and risk flags.
    - **includes**: Client-side table with sorting and filtering; no order placement.
    - **deps**: [T-06]

- [ ] [T-08] Database: Daily Price History Loader
    - **goal**: Load `/markets/{region_id}/history/` and maintain `price_history_daily` for The Forge.
    - **includes**: Merge/update strategy keyed by `(region_id, type_id, day)`.
    - **deps**: [T-02]

- [ ] [T-09] Agent: Risk/Volatility Features
    - **goal**: Incorporate volatility and liquidity metrics from price history to refine suggestions.
    - **deps**: [T-08], [T-05]

- [ ] [T-10] Agent: Budget + Position Sizing
    - **goal**: Allocate budget across suggestions with diversification and per-type caps.
    - **deps**: [T-05]

- [ ] [T-11] Ops: Error-Limit Telemetry + Backoff Controls
    - **goal**: Emit metrics for `X-ESI-Error-Limit-*`, retries, and cache hit rates; surface in logs.
    - **deps**: [T-02]
    - **refs**: [ESI Best Practices](https://developers.eveonline.com/docs/services/esi/best-practices/)

- [ ] [T-12] Ops: Circuit Breaker + Recovery
    - **goal**: Prevent cascading failures during upstream incidents and provide graceful degradation to cached data.
    - **deps**: [T-11]

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

### Notes

- Keep ESI usage within reasonable bounds; honor `expires` and prefer `If-None-Match` caching to avoid unnecessary load.
- For paginated requests, ensure a consistent snapshot across pages; retry or abort if `last-modified` drifts.
- Suggestions must include a brief rationale and conservative assumptions.
