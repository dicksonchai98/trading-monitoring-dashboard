# Market Summary Worker Design

## 1. Overview

`market_summary_worker` is a dedicated worker for market-level aggregation.

Phase 1 scope:

- Market: `TSE001`
- Metric group: intraday estimated turnover only

Outputs:

- current cumulative turnover
- session completion ratio
- estimated full-day turnover
- intraday series for charting
- minute snapshots for historical replay/analysis

This worker follows the existing backend pattern:

- ingestion -> Redis Streams
- consumer-group processing (`XAUTOCLAIM` + `XREADGROUP` + `XACK`)
- Redis latest + intraday series state
- minute-level DB sink

## 2. Confirmed Decisions

- Serving uses independent routes under `/v1/market-summary/*`.
- Ingestion reuses existing `market_ingestion` process and adds a `market` quote type for `TSE001`.
- Redis state key format follows existing shared convention:
  `{env}:state:{code}:{trade_date}:{suffix}`
- DB dedup strategy uses unique key conflict tolerance (skip duplicates), not upsert.

## 3. Scope and Non-Goals

In scope:

- `TSE001` realtime market summary
- linear completion-ratio model + configurable adjustment factor
- Redis intraday/latest state + Postgres minute snapshots

Out of scope (phase 1):

- market breadth / advance-decline / volume ratio
- multi-market support
- dynamic time-of-day adjustment-factor model

## 4. Architecture

```text
Market Feed (TSE001)
  -> market_ingestion (reuse existing process; add market quote callback)
  -> XADD {env}:stream:market:TSE001
  -> market_summary_worker (consumer group: agg:market)
  -> compute metrics
  -> Redis state
       {env}:state:TSE001:{trade_date}:market_summary:latest
       {env}:state:TSE001:{trade_date}:market_summary:zset
  -> minute DB sink
  -> PostgreSQL market_summary_1m
```

## 5. Data Ingest Design

### 5.1 Source

Use realtime market-level feed for `TSE001` in existing `market_ingestion`.

### 5.2 Stream key

- `{env}:stream:market:TSE001`
- Example: `dev:stream:market:TSE001`

### 5.3 Normalized event schema

Use existing ingestion envelope style and field names (`code`, not `market_code`):

```json
{
  "source": "market_feed",
  "code": "TSE001",
  "quote_type": "market",
  "asset_type": "market",
  "event_ts": "2026-04-05T09:30:01+08:00",
  "recv_ts": "2026-04-05T09:30:01.050+08:00",
  "payload": {
    "index_value": 20500.12,
    "cumulative_turnover": 1234567890
  }
}
```

Required fields:

- `code`
- `event_ts`
- `payload.index_value`
- `payload.cumulative_turnover`

## 6. Worker Consumption Model

- Stream: `{env}:stream:market:TSE001`
- Group: `agg:market`
- Consumer: configurable (e.g. `agg-market-1`)
- Pattern:
  - `XAUTOCLAIM` for pending
  - `XREADGROUP` for new
  - process
  - `XACK` only after successful state write + enqueue to DB sink

## 7. Metric Definition

### 7.1 Formula

`estimated_turnover = cumulative_turnover / completion_ratio * adjustment_factor`

### 7.2 Completion ratio

`completion_ratio = elapsed_trading_time / total_trading_time`

Rules:

- clamp to `[0.0, 1.0]`
- if `completion_ratio <= 0`, set `estimated_turnover = null` (no divide-by-zero)

### 7.3 Trading session semantics

For phase 1, day session config is explicit:

- start: `MARKET_TRADING_START` (default `09:00`)
- end: `MARKET_TRADING_END` (default `13:30`)

Out-of-session behavior:

- still accept latest event and update `index_value` / `cumulative_turnover`
- freeze `completion_ratio` at `0.0` (before start) or `1.0` (after end)
- therefore `estimated_turnover` is `null` before open, fixed at end-of-day estimate after close

Trade date determination must reuse shared helper logic to avoid serving mismatch.

### 7.4 Adjustment factor

- `MARKET_ADJUSTMENT_FACTOR` (phase 1 static scalar, default `1.0`)
- valid range recommendation: `[1.0, 1.2]`

## 8. Aggregation and Flush Model

### 8.1 Update mode

Event-driven, per message:

- parse + validate event
- compute `completion_ratio` + `estimated_turnover`
- update Redis latest
- append Redis intraday zset

### 8.2 Minute DB sink trigger

Flush is based on **event-time minute rollover**:

- when current event minute differs from last buffered minute, flush previous minute snapshot
- data source is worker in-memory latest state (no Redis readback)
- on graceful shutdown, force flush last buffered minute

This keeps minute snapshots deterministic with stream replay.

## 9. Redis State Design

### 9.1 Latest key

- key: `{env}:state:TSE001:{trade_date}:market_summary:latest`
- value: JSON string

Example:

```json
{
  "code": "TSE001",
  "event_ts": "2026-04-05T10:30:00+08:00",
  "index_value": 20500.12,
  "cumulative_turnover": 1234567890,
  "completion_ratio": 0.42,
  "estimated_turnover": 2940000000,
  "adjustment_factor": 1.1
}
```

### 9.2 Intraday series key

- key: `{env}:state:TSE001:{trade_date}:market_summary:zset`
- score: unix seconds (same unit as existing intraday zset pattern)
- member: JSON snapshot

### 9.3 Retention

- keep current trading day in Redis (TTL configurable)
- historical access via DB

## 10. Database Design

### 10.1 Table

`market_summary_1m`

### 10.2 Schema

- `id` (surrogate PK, optional but consistent with current models)
- `market_code`
- `trade_date`
- `minute_ts`
- `index_value`
- `cumulative_turnover`
- `completion_ratio`
- `estimated_turnover`
- `payload` (JSON/Text for debug compatibility)

### 10.3 Uniqueness and dedup

- unique constraint: `(market_code, minute_ts)`
- persistence policy: duplicate conflict is tolerated and skipped (no update-on-conflict)
- DB sink retry/dead-letter pattern should mirror existing stream DB sink behavior

## 11. Serving Contract (Independent Routes)

Worker exposes no API; serving layer reads Redis/DB only.

Independent endpoints:

- `GET /v1/market-summary/latest`
- `GET /v1/market-summary/today`
- `GET /v1/market-summary/history`
- SSE include an independent event type: `market_summary_latest`

Response shape uses existing serving conventions:

- timestamps returned as epoch milliseconds
- authenticated + rate-limited
- Redis failure => `503 redis_unavailable`
- DB failure => `503 db_unavailable`

## 12. Configuration

Add config keys:

- `MARKET_SUMMARY_ENABLED`
- `MARKET_SUMMARY_ENV` (defaults to ingest env)
- `MARKET_CODE` (default `TSE001`)
- `MARKET_STREAM_KEY` (optional override, default derived)
- `MARKET_GROUP` (default `agg:market`)
- `MARKET_CONSUMER_NAME`
- `MARKET_READ_COUNT`
- `MARKET_BLOCK_MS`
- `MARKET_CLAIM_IDLE_MS`
- `MARKET_CLAIM_COUNT`
- `MARKET_STATE_TTL_SECONDS`
- `MARKET_TRADING_START`
- `MARKET_TRADING_END`
- `MARKET_ADJUSTMENT_FACTOR`
- `MARKET_DB_SINK_BATCH_SIZE`
- `MARKET_DB_SINK_MAX_RETRIES`
- `MARKET_DB_SINK_RETRY_BACKOFF_SECONDS`
- `MARKET_DB_SINK_DEAD_LETTER_MAXLEN`

These must be wired into both:

- `app/config.py`
- `app/state.py` runner construction entrypoints

## 13. Failure Handling

- Invalid event: log + metric + skip + continue
- Redis write error: retry and do not ack until write path succeeds
- DB sink error: retry batch; on retry exhaustion publish dead-letter stream entry
- SSE failure: isolated per client connection

## 14. Observability

Use dedicated metric prefix to avoid collision with existing pipelines:

- `market_summary_events_processed_total`
- `market_summary_invalid_events_total`
- `market_summary_stream_lag_ms`
- `market_summary_redis_write_errors_total`
- `market_summary_db_sink_batches_total`
- `market_summary_db_sink_errors_total`
- `market_summary_db_sink_dead_letter_total`
- `market_summary_estimated_turnover_latest`

## 15. Rollout Plan

Phase 1:

- ingest `TSE001` market events into Redis stream
- run `market_summary_worker`
- write Redis latest/zset + `market_summary_1m`
- expose independent serving endpoints

Phase 2:

- refine adjustment-factor model (time-of-day)
- optional session segmentation
- extend to additional market codes

## 16. Summary

`market_summary_worker` adds a market-level realtime feature with explicit boundaries:

- reuse existing ingestion and worker/runtime patterns
- use shared key/time conventions for serving compatibility
- avoid formula edge-case ambiguity
- keep persistence idempotent via unique-key conflict tolerance
