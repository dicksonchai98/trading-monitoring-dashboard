## Why

The system currently serves realtime and historical data for kbar/bidask but has no contract-complete path for quote-derived features.  
We need a dedicated quote worker + serving contract now to close this product gap while preserving existing SSE and auth behavior.

## What Changes

- Add a dedicated quote stream-processing capability for one configured futures instrument in phase 1.
- Add quote feature state outputs in Redis (`latest` + intraday 1s series) and minute snapshot persistence in PostgreSQL.
- Extend serving APIs with quote latest/today/history/aggregates endpoints.
- Extend existing `/v1/stream/sse` to emit `quote_latest` on state change.
- Keep existing kbar/bidask APIs and event contracts unchanged.
- Keep serving access policy unchanged: authenticated users can read; visitors cannot.

## Capabilities

### New Capabilities
- `quote-worker-pipeline`: Consume quote streams, aggregate quote features, maintain Redis quote state, and persist minute snapshots with retry/dead-letter semantics.
- `quote-serving-api`: Expose quote latest/intraday/history/aggregates read APIs and extend existing SSE stream with quote updates.

### Modified Capabilities
- (none)

## Impact

- Affected backend modules:
  - `apps/backend/app/market_ingestion/*` (quote subscription scope)
  - `apps/backend/app/quote_processing/*` (new worker runtime)
  - `apps/backend/app/routes/serving.py`
  - `apps/backend/app/services/serving_store.py`
  - `apps/backend/app/models/*` + alembic migrations
- New/updated API surface:
  - `GET /v1/quote/latest`
  - `GET /v1/quote/today`
  - `GET /v1/quote/history`
  - `GET /v1/quote/aggregates`
  - SSE event extension: `quote_latest`
- Redis and DB dependencies unchanged in type (no new infra component), but new keys/table added.
