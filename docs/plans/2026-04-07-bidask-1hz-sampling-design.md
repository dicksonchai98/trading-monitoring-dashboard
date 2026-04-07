# BidAsk 1Hz Sampling Design

Date: 2026-04-07  
Status: Approved

## 1. Goal

Change BidAsk processing from event-level persistence to 1-second sampling:

- same-second multiple updates -> keep the last one
- no-update second -> carry-forward previous sample
- persist exactly 1 sample per second semantics to Redis and DB

This aligns with dashboard needs focused on `bid_total_vol` / `ask_total_vol` trends rather than tick-level microstructure replay.

## 2. Scope

In scope:

- BidAsk worker output cadence change (event-driven ingest, second-driven emit)
- Redis metric state semantics update (`latest`, `zset`)
- DB `bidask_metrics_1s` semantics update to true 1Hz
- serving compatibility check for `/v1/metric/bidask/latest` and `/v1/metric/bidask/today`

Out of scope:

- Tick pipeline changes
- Market summary pipeline changes
- New API endpoints
- Multi-instrument architecture redesign

## 3. Current Problem

Current worker writes on every bidask event:

1. update Redis latest
2. enqueue DB persistence
3. sample zset in parallel

During high event bursts this creates write amplification and queue pressure (`QueueFull`) while business value remains second-level.

## 4. Target Data Flow

1. Keep ingest path unchanged:
- Shioaji bidask callback -> Redis stream `{env}:stream:bidask:{code}`

2. Worker ingest stage (event-level):
- consume every event
- update in-memory "current second candidate" with latest event in that second
- do not immediately write Redis/DB

3. Worker emit stage (1Hz):
- on second boundary emit one sample for each active code
- if current second has events: emit last event of that second
- if no events: emit carry-forward from previous emitted sample

4. Emit targets per second:
- Redis `metrics:latest` (one write/sec)
- Redis `metrics:zset` (one point/sec)
- DB `bidask_metrics_1s` (one row/sec semantics)

## 5. Redis Contract

Key names remain unchanged:

- `{env}:state:{code}:{trade_date}:metrics:latest`
- `{env}:state:{code}:{trade_date}:metrics:zset`

Semantic changes:

- `metrics:latest`: latest 1Hz sample (not latest raw event)
- `metrics:zset`: 1 point per second, continuous with carry-forward

## 6. DB Contract

Table remains `bidask_metrics_1s`, but enforce true per-second identity:

- add `event_second` (timestamp truncated to second)
- unique key becomes `(code, event_second)`
- write behavior uses upsert so same-second arrivals resolve to final sample

`event_ts` can remain for traceability, but query identity should use `event_second`.

## 7. Metric Semantics

Per emitted second:

- `bid_total_vol`, `ask_total_vol`: from last event in that second
- `main_force_big_order` and day high/low/strength: evolve from emitted second samples
- missing second: carry-forward whole sample, update `ts` only

## 8. Reliability and Backpressure

- Consumer should stop pulling additional entries in current loop if enqueue fails, allowing sink loops to catch up.
- QueueFull should be handled as controlled backpressure signal, not exception storm.
- Existing retry/dead-letter behavior for DB sink remains valid but should trigger far less frequently.

## 9. API/SSE Impact

No endpoint path changes.

- `/v1/metric/bidask/latest`: still reads Redis latest
- `/v1/metric/bidask/today`: still reads Redis zset range
- SSE metric push naturally stabilizes near 1Hz cadence

## 10. Migration Strategy

1. Add nullable `event_second`.
2. Backfill `event_second = date_trunc('second', event_ts)`.
3. Add unique constraint/index on `(code, event_second)`.
4. Deploy worker 1Hz emit logic.
5. Monitor queue depth, pending lag, and sample continuity.

Rollback:

- revert worker to prior behavior if needed
- keep additive DB changes (non-destructive)

## 11. Test Plan

Unit:

- same-second multiple events -> one emitted sample using last event
- empty second -> carry-forward sample emitted
- strength clamp and day high/low behavior under second-level updates

Integration:

- stream burst input -> Redis/DB writes capped to 1/sec per code
- verify no QueueFull storm under replay/backlog scenario

Contract:

- serving latest/today payload shape unchanged
- timestamp monotonicity and continuity in zset

