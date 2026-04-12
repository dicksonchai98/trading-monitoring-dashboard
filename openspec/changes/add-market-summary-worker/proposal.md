## Why

The system currently lacks a market-level summary pipeline for `TSE001` estimated turnover, so dashboard/analysis consumers cannot read a stable market-wide feature from the same serving surface as other realtime data. We need this now to complete the market-layer MVP with explicit ingest, compute, persistence, and serving contracts.

## What Changes

- Add a dedicated `market_summary_worker` that consumes `TSE001` market events from Redis Streams and computes `completion_ratio` and `estimated_turnover`.
- Reuse existing `market_ingestion` process by adding `market` quote-type ingest for `TSE001` with a normalized envelope (`code`-based).
- Add Redis market-summary state (`latest` + intraday `zset`) using the shared key convention `{env}:state:{code}:{trade_date}:{suffix}`.
- Add minute-level DB sink table `market_summary_1m` with uniqueness `(market_code, minute_ts)` and duplicate-tolerant writes.
- Add independent serving endpoints under `/v1/market-summary/*` and SSE event `market_summary_latest`.
- Add config, runtime wiring, and observability metrics with `market_summary_*` prefix.

## Capabilities

### New Capabilities
- `market-summary-worker`: Market-level stream processing for `TSE001` estimated turnover from ingest to Redis/DB state.
- `market-summary-serving`: Independent serving API/SSE contract for market summary latest/today/history data.

### Modified Capabilities
- (none)

## Impact

- Backend modules: `market_ingestion`, new market-summary worker runtime/module, serving routes/store, config/state wiring.
- APIs: new `/v1/market-summary/latest|today|history` and SSE market summary event.
- Data stores: Redis stream/state keys and Postgres table `market_summary_1m` + migration.
- Operations: new worker process entrypoint, metrics, and dead-letter handling for DB sink failures.
