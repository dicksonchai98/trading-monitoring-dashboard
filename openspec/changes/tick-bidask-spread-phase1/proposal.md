## Why

Current realtime processing lacks three trader-facing derived metrics that are already agreed in design: tick amplitude, bidask main force big order, and futures-vs-index spread. Delivering them now closes a clear data-contract gap for downstream serving/SSE without introducing new worker classes or topology risk.

## What Changes

- Extend tick aggregation outputs with `amplitude` and `amplitude_pct` in Redis realtime state and `kbars_1m` persistence.
- Extend bidask metrics outputs with `main_force_big_order`, day high/low, and strength in Redis latest/zset and persisted payload.
- Extend market summary outputs with `futures_code`, `futures_price`, `spread`, day high/low, strength, and `spread_status`.
- Define fixed spread source contract for futures latest state lookup:
  - `futures_code = AGGREGATOR_CODE`
  - key `{env}:state:{futures_code}:{trade_date}:k:current`, field `close`
  - freshness guard and stale fallback behavior.
- Add migration, observability, and tests for these contracts.

## Capabilities

### New Capabilities
- `realtime-market-derived-metrics`: Add and persist phase-1 derived metrics (amplitude, main_force_big_order, spread) with fixed formulas, stale handling, and compatibility constraints.

### Modified Capabilities
- None.

## Impact

- Affected modules:
  - `apps/backend/app/stream_processing/runner.py` (tick/bidask metric extensions)
  - `apps/backend/app/market_summary/runner.py` (spread extension)
  - `apps/backend/app/services/serving_store.py` and serving route payload normalization (field passthrough)
  - DB models/migrations for `kbars_1m`, `market_summary_1m`
- Affected data contracts:
  - Redis state payloads for `k:current`, `k:zset`, `metrics:latest`, `metrics:zset`, `market_summary:latest`, `market_summary:zset`
  - PostgreSQL persisted fields and payload content
- Risks:
  - freshness/time-alignment regressions if trade_date rules diverge
  - backward-compat issues if clients assume strict payload shape
