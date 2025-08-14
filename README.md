## EVE Jita AI Trader — Monorepo (Docs-Only Bootstrap)

This repository bootstraps a monorepo for a web app that suggests profitable market orders in EVE Online, focusing initially on the main trade hub (Jita, The Forge). The repository now includes monorepo scaffolding and minimal TypeScript packages; core application logic is not implemented yet.

The app will leverage EVE's ESI API with strict adherence to best practices, including proper user agent identification, error-limit handling, and cache-aware data fetching. Refer to the ESI best practices documentation: [ESI Best Practices](https://developers.eveonline.com/docs/services/esi/best-practices/).

### Status

- Monorepo scaffolding in place (npm workspaces, TypeScript base config, lint/format, tests, CI). [T-01] complete.
- Backend ESI client + SQLite cache layer implemented with User-Agent, ETag/If-None-Match, retry/backoff, and error-limit telemetry; tested. [T-02] complete.
- Backend market snapshot ingestion for The Forge with pagination consistency checks and Jita filtering, exposed via `fetchForgeJitaOrderSnapshots`. [T-03] complete.
- SQLite migrations added for `suggestion_run` and `suggested_order`, with a migration runner `runSqliteMigrations`. [T-04] complete.
- Agent baseline implemented using Anthropic to produce structured suggestions from aggregated market features. Default model: `claude-sonnet-4-20250514` (override via `ANTHROPIC_MODEL`). [T-05] complete.
- Backend Suggestion API exposed with endpoints to run a suggestion pass and list suggestions. [T-06] complete.
- Frontend Suggestions UI to trigger runs and browse suggestions with basic filtering. [T-07] complete.
- Database price history loader for The Forge with upsert semantics to `price_history_daily` via `/markets/{region_id}/history/`. Programmatic APIs: `fetchForgePriceHistory`, `upsertPriceHistoryRows`, `loadForgePriceHistoryForTypes`. [T-08] complete.
- Agent risk/volatility features: compute 30d coefficient of variation and average volume from `price_history_daily`; filter and enrich features for the LLM. Backend exposes `selectRiskMetricsByType` and server passes `riskByType` to the agent. New agent options: `maxCv30d`, `minAvgVolume30d`. [T-09] complete.
- Agent budget and position sizing: greedy allocation with per-type budget caps and diversification; respects total budget and caps during suggestion finalization. [T-10] complete.
    - Ops error-limit telemetry and backoff controls: structured logs for ESI backoff and per-run metrics surfaced in API response. [T-11] complete.
    - Ops circuit breaker and recovery: circuit state/telemetry in `EsiClient`; graceful 503 with latest run when upstream is degraded. [T-12] complete.

## Scope and Principles

- Suggest market orders within a specified budget to maximize expected profit.
- Initial scope limited to Jita (system 30000142 in The Forge region 10000002) for simplicity and performance.
- Read-only interaction with the ESI API; no in-game automation of order placement.
- SQLite is the initial data store. Future upgrades can introduce alternative databases via adapters.
- Strict compliance with third-party API etiquette: caching, backoff, and error-limit respect.
- Agent uses Anthropic models server-side only; configure `ANTHROPIC_API_KEY`. Default model `claude-sonnet-4-20250514`, override via `ANTHROPIC_MODEL`. Outputs validated against schema before persistence.

## Monorepo Overview

Proposed structure for AI agents to implement:

```text
/
  README.md
  docs/
    AI_AGENT_GUIDE.md
    TODO.md
  packages/
    backend/            # API server, ESI integration, data ingestion, business logic
    frontend/           # Web UI for exploring data and suggested orders
    agent/              # AI/heuristic engines that generate suggestions
    shared/             # Cross-cutting utils, type definitions, schemas
  infra/                # IaC, containerization, deployment workflows
  scripts/              # Developer and data maintenance scripts
  data/                 # SQLite database files (local dev), seeds, exports
```

### High-Level Architecture

```mermaid
graph TD
  A[Browser UI] --> B[Frontend]
  B --> C[Backend API]
  C --> D[(SQLite)]
  C --> E[ESI API]
  C --> F[Agent Service]
  F --> D

  subgraph External
    E
  end

  subgraph Monorepo
    B
    C
    D
    F
  end
```

Key points:

- The backend is the sole component that speaks to ESI. It injects the correct user agent headers, handles caching via `ETag`/`If-None-Match`, respects `expires`/`last-modified`, and implements error-limit backoff. See: [ESI Best Practices](https://developers.eveonline.com/docs/services/esi/best-practices/). It now schedules market snapshots for Jita every 5 minutes and serves runs from the latest stored snapshot.
- The agent consumes normalized market snapshots from SQLite and emits suggested orders with clear justifications and risk flags.
- The frontend provides exploration and decision support; it does not place orders.

## Data Model (Initial)

This is a proposed starting point for agents. Actual schemas may evolve.

```mermaid
erDiagram
  item_type {
    int type_id PK
    string name
    string group_name
  }
  market_order_snapshot {
    string snapshot_id PK
    int region_id
    int system_id
    int type_id FK
    string side  // buy|sell
    decimal price
    int volume
    datetime issued_at
    datetime snapshot_ts
  }
  price_history_daily {
    int region_id
    int type_id FK
    date day
    decimal avg_price
    int volume
  }
  suggestion_run {
    string run_id PK
    datetime started_at
    datetime finished_at
    string strategy
    decimal budget
  }
  suggested_order {
    string suggestion_id PK
    string run_id FK
    int type_id FK
    string side  // buy|sell
    int quantity
    decimal unit_price
    decimal expected_margin
    string rationale
  }
  esi_cache_entry {
    string cache_key PK
    string url
    string etag
    datetime expires_at
    datetime last_modified
    datetime fetched_at
    int http_status
  }

  item_type ||--o{ market_order_snapshot : has
  item_type ||--o{ price_history_daily : has
  suggestion_run ||--o{ suggested_order : contains
```

## Compliance and 3rd-Party Etiquette

- Identify the application using a meaningful user agent value including app name, version, and contact (email and/or source URL). If running in a browser, use `X-User-Agent` or a `user_agent` query parameter fallback. Details: [ESI Best Practices](https://developers.eveonline.com/docs/services/esi/best-practices/).
- Respect ESI error-limits using `X-ESI-Error-Limit-Remain` and `X-ESI-Error-Limit-Reset`. Back off proactively as thresholds are approached.
- Be cache-aware: honor `expires` and `last-modified`, use `ETag` and `If-None-Match` to obtain `304` responses when appropriate.
- For paginated endpoints, ensure `last-modified` is consistent across pages; otherwise, refetch to avoid partial snapshots.
- Avoid scraping behavior. Fetch only what is needed for Jita-focused analysis, at reasonable intervals.

## Next Steps

- Start with `docs/AI_AGENT_GUIDE.md` to align on development practices, ESI integration rules, Anthropic usage, and data-handling patterns.
- Use `docs/TODO.md` to pick the next high-impact task with clear dependencies.

### Running locally

After installing dependencies, you can run either an all-in-one flow or separate dev servers:

```bash
# Option A: Vite dev server with proxy (recommended for UI development)
npm run --workspace @eve-jita-ai/backend dev &
npm run --workspace @eve-jita-ai/frontend dev

# Option B: build frontend and let backend serve static files
npm run --workspace @eve-jita-ai/frontend build
npm run --workspace @eve-jita-ai/backend dev
```

Environment variables:

Create a `.env` file from the provided example before running locally:

```bash
cp .env.example .env
# or on Windows PowerShell
Copy-Item .env.example .env
```

Only commit `.env.example`. The `.env` file is ignored by git.

- `SQLITE_DB_PATH`: path to the SQLite DB file (defaults to `packages/backend/dev.sqlite`).
- `USER_AGENT`: optional override for the ESI User-Agent header.
- `ANTHROPIC_API_KEY`: required to use the Anthropic-backed agent.
- `ANTHROPIC_MODEL` (optional): defaults to `claude-sonnet-4-20250514`.
- `ESI_CIRCUIT_FAILURE_THRESHOLD` (optional): failures to trigger open (default 5).
- `ESI_CIRCUIT_OPEN_AFTER_MS` (optional): cooldown before half-open probes (default 60000).
- `ESI_CIRCUIT_MIN_OPEN_MS` (optional): minimum open duration (default 30000).
- `ESI_CIRCUIT_ERROR_LIMIT_THRESHOLD` (optional): open when `X-ESI-Error-Limit-Remain` <= value (default 2).
- `MARKET_SNAPSHOT_INTERVAL_MS` (optional): scheduler interval for background snapshot fetches (default 300000).
- `MARKET_SNAPSHOT_STALE_MS` (optional): considered stale age for snapshots (default 300000). Currently used for telemetry and logs.
- `ALLOW_RUN_DIRECT_FETCH` (optional): set to `1` to allow `POST /api/suggestions/run` to fetch ESI directly (bypassing the stored snapshot). Default disabled.

Price history loading (programmatic usage):

```ts
import { EsiClient, fetchForgePriceHistory, upsertPriceHistoryRows } from '@eve-jita-ai/backend';

const dbPath = 'packages/backend/dev.sqlite';
const esi = new EsiClient({ dbPath });
const rows = await fetchForgePriceHistory({ esi, typeId: 34 });
upsertPriceHistoryRows({ dbPath, regionId: 10000002, typeId: 34, rows });
```

API Endpoints:

- `POST /api/suggestions/run` — body: `{ "budget": number, "options"?: {...} }`
    - Runs a pass using the latest stored market snapshot (no ESI calls during the request), computes suggestions with the Anthropic baseline, persists to SQLite, and returns `{ run, counts, usage, market_snapshot_used, snapshot_age_ms, snapshot_timestamp }`.
    - If no snapshot is available yet (e.g., just after boot), responds with `503` and `{ error: 'no_snapshot_available', message, latest_run, market_snapshot_used: false }`.
    - For debugging or legacy behavior, you can temporarily enable direct-fetch mode by setting `ALLOW_RUN_DIRECT_FETCH=1` (not recommended in normal operation).
- `GET /api/suggestions?run_id=...&page=1&limit=50` — lists suggestions for a run (or the latest run when `run_id` is omitted), with pagination metadata.

Frontend build:

- The UI is now a React + TypeScript app built with Vite. The backend serves the Vite `dist` output at `/` in non-dev. During development, you can run Vite with a proxy to the backend. Client-side features: trigger a run, view suggestions with filtering and pagination. Types sourced from `@eve-jita-ai/shared`.
- Build with `npm run -w @eve-jita-ai/frontend build` to produce `packages/frontend/dist`. The backend will serve `index.html` and assets from this directory.

## References

- EVE ESI documentation and best practices: [ESI Best Practices](https://developers.eveonline.com/docs/services/esi/best-practices/)
