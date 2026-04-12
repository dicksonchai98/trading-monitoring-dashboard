# Tick / BidAsk Extensions + Spread Design

Date: 2026-04-06  
Status: Revised for implementation readiness

## 1. Overview

This design extends the current realtime processing system with three feature groups:

1. Tick extension: `amplitude`, `amplitude_pct`
2. BidAsk extension: `main_force_big_order`
3. Market-level extension: futures vs TSE001 `spread`

This phase intentionally reuses current architecture:

- ingestion writes normalized events into Redis Streams
- workers consume streams via consumer groups
- workers write realtime state into Redis
- workers flush snapshots into PostgreSQL

No standalone spread worker is introduced in Phase 1. Spread logic is added into `market_summary_worker`.

## 2. Scope and Constraints

### 2.1 Functional Scope (Phase 1)

- `tick_worker`: compute and persist `amplitude`, `amplitude_pct`
- `bidask_worker`: compute and persist `main_force_big_order` family fields
- `market_summary_worker`: compute and persist spread family fields

### 2.2 Non-Goals (Phase 1)

- standalone spread worker
- multi-pair spread engine
- frontend-specific new endpoints
- new aggregation cadence beyond existing worker cadence

## 3. Phase 1 Contract Decisions (Closed)

To avoid implementation divergence, Phase 1 uses the following fixed decisions:

1. `amplitude_pct` is mandatory in Phase 1.
2. `spread_ratio` is out of Phase 1 (defer to Phase 2).
3. `main_force_big_order` volume basis is fixed to the normalized total visible levels used by current bidask metrics (`total_bid_volume - total_ask_volume`).
4. all strength fields are clamped to `[0.0, 1.0]`.
5. if `(day_high == day_low)`, strength is `0.5`.
6. if required upstream values are missing/invalid, worker treats the event as failed and follows existing retry/pending reclaim flow (no ack).

## 4. Time Semantics and Session Boundaries

### 4.1 Event Time and Trade Date

- Worker computations use normalized event timestamp (`event_ts`) and normalized `trade_date` from ingestion.
- Intraday high/low states reset on `trade_date` change.

### 4.2 Spread Time Alignment

- Spread recomputes on each market summary update.
- Futures price is read from latest futures realtime state.
- Futures data freshness threshold: `5 seconds`.
- If futures latest is stale (> 5s) or absent:
  - `spread`, `spread_day_high`, `spread_day_low`, `spread_strength` are written as `null`
  - `spread_status = "stale_or_missing_futures"`

### 4.3 Futures Latest State Key Contract (Fixed)

To avoid implementation divergence, Phase 1 fixes the futures latest source contract:

- futures code source: `AGGREGATOR_CODE` (single-instrument scope in Phase 1)
- state key template: `{env}:state:{futures_code}:{trade_date}:k:current`
- required field: `close`
- `trade_date` must reuse the backend shared trade-date rule (same rule used by stream processing),
  not a worker-local custom rule
- recommended read sequence:
  1. resolve configured `futures_code`
  2. derive `trade_date` from current market event timestamp via shared rule
  3. read key and parse `close` as numeric futures price
  4. apply freshness check (`event_ts` gap <= 5 seconds)
- if key is missing, `close` is invalid, or freshness fails:
  - write `spread = null`
  - write `spread_status = "stale_or_missing_futures"`

### 4.4 Trading Session Notes

- Day/night session differences are normalized by ingestion into a consistent `trade_date` contract.
- Workers do not infer session boundaries independently.

## 5. Worker-Level Design

### 5.1 `tick_worker` extension

Definition:

```text
amplitude = high - low
amplitude_pct = (high - low) / open
```

Rules:

- `open` means current minute open of the same 1m K bar.
- If `open <= 0` or invalid, treat event as failed (no ack).
- amplitude fields are included in both:
  - current key payload
  - intraday zset serialized payload

Redis keys (unchanged):

- `{env}:state:{code}:{trade_date}:k:current`
- `{env}:state:{code}:{trade_date}:k:zset`

DB changes (`kbars_1m`):

- `amplitude NUMERIC NOT NULL`
- `amplitude_pct NUMERIC NOT NULL`

### 5.2 `bidask_worker` extension

Definition:

```text
main_force_big_order = total_bid_volume - total_ask_volume
strength = (value - day_low) / (day_high - day_low)
```

Rules:

- Use normalized visible-level totals already used by current bidask metrics.
- Strength clamped to `[0.0, 1.0]`.
- If `day_high == day_low`, strength = `0.5`.

Redis keys (unchanged):

- `{env}:state:{code}:{trade_date}:metrics:latest`
- `{env}:state:{code}:{trade_date}:metrics:zset`

Added fields:

- `main_force_big_order`
- `main_force_big_order_day_high`
- `main_force_big_order_day_low`
- `main_force_big_order_strength`

DB strategy (`bidask_metrics_1s`):

- Keep table schema unchanged in Phase 1.
- Persist feature fields into `metric_payload` JSON.

### 5.3 `market_summary_worker` extension

Definition:

```text
spread = futures_price - index_value
spread_strength = (spread - spread_day_low) / (spread_day_high - spread_day_low)
```

Rules:

- Recompute during each market summary update with freshest futures latest.
- Apply 5-second freshness check.
- Strength clamped to `[0.0, 1.0]`.
- If `day_high == day_low`, strength = `0.5`.

Redis keys (unchanged):

- `{env}:state:market_summary:TSE001:{trade_date}:latest`
- `{env}:state:market_summary:TSE001:{trade_date}:zset`

Added fields:

- `futures_code`
- `futures_price`
- `spread`
- `spread_day_high`
- `spread_day_low`
- `spread_strength`
- `spread_status` (`ok` | `stale_or_missing_futures`)

DB changes (`market_summary_1m`):

- `futures_code TEXT`
- `futures_price NUMERIC`
- `spread NUMERIC`
- `spread_day_high NUMERIC`
- `spread_day_low NUMERIC`
- `spread_strength NUMERIC`
- `spread_status TEXT`

## 6. Data Contract and Compatibility

- No Redis key renaming in Phase 1; only payload field extension.
- Serving layer remains same read path (Redis + PostgreSQL).
- Backward compatibility requirement:
  - consumers must tolerate unknown extra fields
  - typed clients should update schema/type guards before rollout completion

## 7. Error Handling and Reliability

- Computation failure on required fields:
  - fail current message
  - no ack
  - rely on existing retry/pending reclaim
- Worker must log structured error context:
  - `worker`, `stream`, `message_id`, `code`, `trade_date`, `error_type`
- No cross-connection failure propagation for SSE (existing behavior retained).

## 8. Observability and Alerts

Add metrics:

- `tick_amplitude_compute_fail_total`
- `bidask_main_force_compute_fail_total`
- `market_spread_compute_fail_total`
- `market_spread_stale_total`
- `worker_stream_pending_count` (existing or extended tag usage)
- `snapshot_flush_latency_ms` by worker

Alert suggestions:

- spread stale ratio > 5% over 5 minutes
- compute failure > 1% over 5 minutes
- pending count continuously increasing for 10 minutes

## 9. Database Migration and Rollback

### 9.1 Migration Order

1. add nullable columns to `kbars_1m` and `market_summary_1m`
2. deploy worker code writing new fields
3. verify data fill rate and null ratio
4. enforce stricter nullability if needed in later migration

### 9.2 Rollback Plan

- Keep additive schema changes (no destructive rollback required).
- Roll back worker binaries/config first.
- Serving layer should treat missing new fields as non-fatal.

## 10. Test Plan (Executable)

### 10.1 Unit Tests

- amplitude formula and `open <= 0` failure path
- main_force_big_order formula and strength clamp paths
- spread formula, stale handling, strength clamp paths

### 10.2 Integration Tests

- stream -> worker -> Redis payload contains new fields
- minute flush -> PostgreSQL columns/payload persisted correctly
- retry path on malformed message (no ack + pending reclaim)

### 10.3 API/SSE Contract Tests

- realtime payload includes new fields when available
- stale spread outputs `spread_status = stale_or_missing_futures`
- old client tolerance for unknown fields

### 10.4 Non-Functional Tests

- worker throughput baseline regression check
- SSE fanout unaffected under target concurrency

## 11. Rollout Phases

### Phase 1 (this document)

- implement three feature groups with fixed contracts above
- no new workers

### Phase 2

- evaluate dedicated DB columns for `main_force_big_order`
- optionally add `spread_ratio`

### Phase 3

- if pair count grows, split spread into dedicated `spread_worker`

## 12. Open Items (Remaining)

1. Confirm NUMERIC precision/scale per table with DBA conventions.
2. Confirm exact Redis serialization format version marker if existing standard requires one.
3. Confirm monitoring backend metric naming conventions.

## 13. Implementation Project List

P0 (must complete before release):

1. Add DB migrations for `kbars_1m`, `market_summary_1m` additive columns.
2. Implement `tick_worker` amplitude + amplitude_pct write path.
3. Implement `bidask_worker` main_force_big_order write path in latest/zset/payload.
4. Implement `market_summary_worker` spread write path with 5-second freshness and `spread_status`.
5. Add unit + integration + contract tests listed above.
6. Add observability metrics and alerts.
7. Add config alignment check: `AGGREGATOR_CODE` is explicitly set and matches intended spread futures instrument.

P1 (hardening after initial rollout):

1. Validate null/stale ratios and tune freshness threshold if needed.
2. Evaluate indexing/query performance for new DB fields.
3. Decide whether to promote `main_force_big_order` from JSON payload to dedicated columns.

P2 (future scale):

1. Introduce multi-pair spread abstraction.
2. Split standalone `spread_worker` when pair count and load justify it.

## 14. Final Summary

This revised design keeps worker boundaries aligned with current architecture while removing Phase 1 ambiguity. It defines fixed metric contracts, time alignment, stale-data behavior, migration order, testing, and rollout tasks so implementation can proceed with low divergence risk.
