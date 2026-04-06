# Index Contribution Worker Design

## 1. Overview

`index_contribution_worker` is a dedicated attribution worker for the Taiwan Capitalization Weighted Stock Index (`TSE001`).

Its responsibility is to transform real-time constituent stock price updates into:

- per-symbol contribution points
- top / bottom contribution rankings
- sector-level contribution aggregation
- minute-level historical snapshots for replay and analysis

This worker is a separate attribution layer. It does not own raw market ingestion or generic latest-state projection.

---

## 2. Goals

### 2.1 Functional Goals

The worker should provide:

- real-time contribution points for each constituent stock
- real-time top 20 positive contribution ranking
- real-time top 20 negative contribution ranking
- real-time sector contribution aggregation
- minute-level DB snapshots for:
  - all constituent contributions
  - ranking snapshots
  - sector snapshots

### 2.2 Non-Goals

This worker does **not** handle:

- futures tick / bidask / quote aggregation
- generic spot latest state maintenance
- market-wide estimated turnover
- multi-index support
- sector hierarchy management
- top-N historical replay at sub-minute granularity

---

## 3. Scope

### 3.1 Supported Index

This worker only supports:

- `TSE001`

No multi-index abstraction is introduced in this phase.

### 3.2 Supported Universe

The worker only tracks stocks that belong to the daily constituent set of `TSE001`.

Non-constituent spot updates are ignored.

---

## 4. Inputs

The worker depends on four input categories.

### 4.1 Spot Latest Updates

Source:

- upstream spot latest stream / state pipeline

Required fields:

- `symbol`
- `last_price`
- `prev_close`
- `updated_at`
- `event_id` (preferred; if unavailable, use `(symbol, updated_at)` as idempotency key)

### 4.2 Daily Constituent Weight Table

Loaded once before market open.

Required fields:

- `symbol`
- `symbol_name`
- `weight`
- `weight_version`
- `weight_generated_at`

Weight unit is fixed to ratio in `[0, 1]`.

### 4.3 Sector Mapping

Sector mapping is maintained internally by our own configuration / table.

This is a single-layer sector classification.

`sector` source priority:

1. internal sector mapping (source of truth)
2. weight table sector (fallback)

### 4.4 Index Previous Close

Loaded once before market open.

Required field:

- `index_prev_close`

This value is fixed for the entire trading day.

---

## 5. Output Model

The worker produces three output layers.

### 5.1 Symbol-Level Contribution

For each constituent symbol:

- `symbol`
- `symbol_name`
- `sector`
- `last_price`
- `prev_close`
- `weight`
- `pct_change`
- `contribution_points`
- `updated_at`

### 5.2 Ranking Layer

Two real-time rankings:

- Top 20 positive contribution
- Top 20 negative contribution

Ranking tie-break order:

1. `contribution_points` (desc for top, asc for bottom)
2. `symbol` (asc)

### 5.3 Sector Aggregation Layer

Single-layer sector contribution totals, stored in index points.

---

## 6. Formula

### 6.1 Contribution Formula

`contribution_points = index_prev_close * weight * ((last_price / prev_close) - 1)`

### 6.2 Notes

- `weight` is the constituent weight of the stock in `TSE001`
- `index_prev_close` is the previous close of `TSE001`
- `prev_close` is the stock previous close
- the result is expressed in index points

### 6.3 Validation Rules

If any of the following is missing or invalid, skip update for that symbol/event:

- missing `weight`
- missing `prev_close`
- missing `index_prev_close`
- `prev_close <= 0`
- `weight < 0` or `weight > 1`
- missing `last_price`

### 6.4 Precision Rules

- internal compute precision: decimal (at least 6 fractional digits)
- persisted `contribution_points`: round to 6 decimals
- API display precision can be reduced (for example 2 decimals)

---

## 7. Worker Responsibilities

### 7.1 Real-Time Update Path

When a constituent stock update arrives:

1. validate symbol belongs to current constituent universe
2. apply idempotency / ordering check:
   - drop duplicate `event_id`
   - drop stale event if `updated_at` <= current symbol state `updated_at`
3. load metadata (`weight`, `sector`, `symbol_name`)
4. compute `contribution_points`
5. update in-memory symbol state
6. update rankings (top / bottom)
7. update sector aggregate with delta method:
   - `sector_total = sector_total - old_contribution + new_contribution`
8. write latest state to Redis

### 7.2 Minute Snapshot Path

At each minute boundary:

1. flush all constituent symbol states into symbol snapshot table
2. flush current top 20 / bottom 20 into ranking snapshot table
3. flush current sector aggregates into sector snapshot table

Time rules:

- trading timezone: `Asia/Taipei`
- `minute_ts = floor(now to minute in trading timezone)`
- snapshot write mode: `upsert` on PK

Late event policy:

- by default, do not rewrite historical minute snapshot
- optional mode: allow bounded backfill window (for example <= 2 minutes)

---

## 8. In-Memory State Design

The worker maintains in-memory state as source for minute flush.

### 8.1 Symbol State Map

Dictionary keyed by `symbol`.

Fields:

- `symbol`
- `symbol_name`
- `sector`
- `last_price`
- `prev_close`
- `weight`
- `pct_change`
- `contribution_points`
- `updated_at`
- `last_event_id`

### 8.2 Ranking State

Two ranking structures:

- `top_20`
- `bottom_20`

Derived from current symbol states and refreshed on each accepted event.

### 8.3 Sector Aggregate State

Dictionary keyed by sector name.

Example:

- `Semiconductor -> 4.3`
- `Finance -> -1.2`

---

## 9. Redis Design

Redis is used for real-time serving.

### 9.1 Symbol Latest

Key:
`{env}:state:index_contrib:TSE001:{trade_date}:{symbol}:latest`

Type:

- JSON string

Value example:

```json
{
  "symbol": "2330",
  "symbol_name": "TSMC",
  "sector": "Semiconductor",
  "last_price": 950,
  "prev_close": 940,
  "weight": 0.31,
  "pct_change": 0.010638,
  "contribution_points": 3.190000,
  "updated_at": "2026-04-06T10:30:00+08:00"
}
```

### 9.2 Top Ranking

Key:
`{env}:state:index_contrib:TSE001:{trade_date}:ranking:top`

Type:

- ZSET

Member:

- `symbol`

Score:

- `contribution_points`

Redis only keeps Top 20.

### 9.3 Bottom Ranking

Key:
`{env}:state:index_contrib:TSE001:{trade_date}:ranking:bottom`

Type:

- ZSET

Member:

- `symbol`

Score:

- `contribution_points`

Redis only keeps Bottom 20.

### 9.4 Sector Aggregate

Key:
`{env}:state:index_contrib:TSE001:{trade_date}:sector`

Type:

- JSON string or HASH

Value example:

```json
{
  "Semiconductor": 4.3,
  "Finance": -1.2,
  "Electronics Manufacturing": 2.1
}
```

### 9.5 TTL and Cleanup

- all trade-date keys should have TTL (for example 3 trading days)
- daily cleanup should remove expired / stale keys

---

## 10. Database Design

### 10.1 Table: `index_contribution_snapshot_1m`

Purpose:

- store all constituent contributions at each minute boundary

Suggested fields:

- `index_code`
- `trade_date`
- `minute_ts`
- `symbol`
- `symbol_name`
- `sector`
- `last_price`
- `prev_close`
- `weight`
- `pct_change`
- `contribution_points`
- `rank_top`
- `rank_bottom`
- `weight_version`
- `payload`

Primary key:

- (`index_code`, `minute_ts`, `symbol`)

### 10.2 Table: `index_contribution_ranking_1m`

Purpose:

- store top 20 / bottom 20 snapshot at each minute boundary

Suggested fields:

- `index_code`
- `trade_date`
- `minute_ts`
- `ranking_type` (`top` / `bottom`)
- `rank_no`
- `symbol`
- `symbol_name`
- `sector`
- `contribution_points`
- `weight_version`
- `payload`

Primary key:

- (`index_code`, `minute_ts`, `ranking_type`, `rank_no`)

### 10.3 Table: `sector_contribution_snapshot_1m`

Purpose:

- store sector contribution totals at each minute boundary

Suggested fields:

- `index_code`
- `trade_date`
- `minute_ts`
- `sector`
- `contribution_points`
- `weight_version`
- `payload`

Primary key:

- (`index_code`, `minute_ts`, `sector`)

### 10.4 Not Stored Separately

No dedicated aggregate snapshot table for:

- positive total
- negative total
- net total
- top20 total
- bottom20 total

These can be recomputed from symbol snapshots or ranking snapshots.

---

## 11. Event Handling Model

### 11.1 Trigger Mode

The worker uses event-driven update.

Whenever a constituent stock latest price changes, contribution calculation is triggered immediately.

### 11.2 Ordering and Idempotency

- prefer upstream `event_id` for deduplication
- if no `event_id`, use `(symbol, updated_at)`
- stale event (older or equal timestamp) is dropped

### 11.3 DB Flush Mode

Database persistence is minute-boundary snapshot flush.

This means:

- real-time state is updated on each accepted event
- DB snapshot is written once per minute using upsert

---

## 12. Failure Handling

### 12.1 Real-Time Update Failure

If a single symbol update fails:

- log the error
- skip that symbol update
- continue processing subsequent events

A symbol-level failure must not block the whole worker.

### 12.2 Redis Failure

If Redis write fails:

- keep in-memory state intact
- retry based on configured retry policy
- continue worker loop unless repeated failure exceeds threshold

### 12.3 DB Flush Failure

If minute snapshot flush fails:

- log failed minute and record retry count
- retry based on DB sink retry policy
- optionally write failed snapshot payload to dead-letter stream / retry queue

### 12.4 Observability

Minimum metrics:

- events accepted / dropped (duplicate, stale, invalid)
- compute latency
- Redis write success/failure
- DB flush success/failure and retry count
- snapshot lag (now - minute_ts)

---

## 13. Startup Procedure

Before trading session starts:

1. load constituent weight table
2. load sector mapping
3. load `index_prev_close`
4. initialize empty symbol state map
5. initialize empty ranking state
6. initialize empty sector aggregate state

Warm restart during trading session:

1. try rebuild from Redis latest keys
2. if Redis insufficient, rebuild from latest DB minute snapshot
3. then continue consuming real-time events

---

## 14. Operational Notes

### 14.1 Daily Reset

At new trade date:

- clear in-memory symbol states
- reload daily constituent weight table
- reload sector mapping
- reload `index_prev_close`
- reset ranking and sector states

### 14.2 Scale Assumption

This worker tracks one index (`TSE001`) and only its constituents.

Therefore in-memory footprint is bounded and manageable.

### 14.3 Why Separate Worker

This worker is intentionally separated from `spot_latest_worker` because it performs:

- ranking maintenance
- sector aggregation
- historical snapshot persistence

These functions are attribution-specific and exceed generic latest-state projection scope.

---

## 15. API / Serving Expectations

This worker itself does not expose HTTP APIs directly.

Serving layer can expose endpoints such as:

- current contribution by symbol
- top 20 / bottom 20 contribution ranking
- current sector contribution totals
- minute historical contribution snapshots

---

## 16. Open Questions

### 16.1 Late Event Backfill Window

Should we enable bounded historical minute rewrite for late events (for example <= 2 minutes), or always keep append-time semantics?

### 16.2 Warm Restart Priority

Should warm restart prefer Redis or DB as the first source of truth under partial inconsistency?

### 16.3 Ranking Serving Payload

Do we need to include `symbol_name` and `sector` directly in ranking Redis payload for read optimization, or keep only symbol + score?

---

## 17. Final Summary

`index_contribution_worker` is a dedicated real-time attribution engine for `TSE001`.

It transforms constituent stock updates into:

- symbol contribution points
- top / bottom rankings
- sector contribution aggregation
- minute-level historical attribution snapshots

This worker forms the attribution layer of the broader market analytics system.
