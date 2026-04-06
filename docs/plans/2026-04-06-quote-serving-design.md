# Quote Worker Adjustments and Serving Layer Design

## 1. Overview

This document refines the existing `quote_worker` design and adds a Phase 1 serving-layer plan for quote features.

Confirmed scope for this design:

- Keep existing `kbar` and `bidask` serving interfaces unchanged.
- Add quote-specific serving capability.
- Reuse existing SSE endpoint `/v1/stream/sse` (do not add separate quote SSE endpoint in phase 1).
- Access model stays the same as current serving: authenticated users can read; visitors cannot.

---

## 2. Problems to Adjust in Current Quote Worker Design

## 2.1 ACK Contract Must Be Explicit

Current wording says to ACK successful messages but does not fully define success boundaries.

Adjustment:

- ACK quote stream message only after:
  - message parse/compute succeeds,
  - quote Redis state write succeeds (`latest` and required per-second state update),
  - DB sink handoff succeeds for minute snapshot path.
- If any of the above fails, do not ACK; keep message pending for reclaim/retry.

Rationale:

- Aligns with existing stream worker reliability contract and avoids silent loss windows.

## 2.2 Restart Recovery Policy Must Be Decided

Current design lists recovery behavior as an open question.

Adjustment for phase 1:

- On restart, recover via consumer-group pending reclaim + new stream events.
- Do not rebuild worker memory from Redis `latest` in phase 1.

Rationale:

- Keeps semantics simple and consistent with existing stream consumption model.

## 2.3 Minute Flush Boundary Behavior Must Be Deterministic

Current design defines "flush minute last snapshot" but does not state no-data minute behavior.

Adjustment:

- If a minute has no emitted second snapshot, skip DB write for that minute.
- Do not carry forward previous minute value into DB.

Rationale:

- Preserves clear "observed data only" semantics.

## 2.4 Feature Field Mapping Needs Controlled Validation

Current design already flags semantic uncertainty for:

- `ask_side_total_cnt` / `bid_side_total_cnt` -> `main_chip`
- `tick_type` -> outside/inside mapping for `long_short_force`

Adjustment:

- Add a runtime validation window in rollout:
  - collect mapping diagnostics,
  - compare expected directionality samples,
  - allow config-based mapping override without stream contract change.

Rationale:

- Reduces risk of shipping structurally correct but semantically inverted metrics.

---

## 3. Serving Goals

Quote serving phase 1 should provide:

- latest quote features,
- intraday second-level quote feature series,
- minute-level historical quote feature snapshots,
- aggregate query view for analysis windows.

Non-goals:

- replacing existing `kbar` or `bidask` serving contracts,
- introducing WebSocket or additional realtime transport in this phase.

---

## 4. Serving Architecture (Phase 1)

## 4.1 Read Paths

- Redis path (low-latency):
  - `quote_features:latest`
  - `quote_features:zset` (today second-series)
- PostgreSQL path (historical/analytics):
  - `quote_features_1m`

## 4.2 SSE Path

- Reuse `/v1/stream/sse`.
- Continue polling Redis state at serving poll interval.
- Emit quote events only on change.
- Keep heartbeat behavior unchanged.

## 4.3 Security Path

- Reuse existing serving auth dependencies.
- Keep visitor denied.
- Keep existing rate limit and SSE connection slot controls.

---

## 5. REST API Plan

Proposed new endpoints under existing serving namespace:

1. `GET /v1/quote/latest`
- Source: Redis `quote_features:latest`
- Returns one normalized latest record.

2. `GET /v1/quote/today`
- Source: Redis `quote_features:zset`
- Query: `code`, optional `from_ms`/`to_ms` or ISO range.
- Returns second-level series for requested range.

3. `GET /v1/quote/history`
- Source: PostgreSQL `quote_features_1m`
- Query: `code`, range required.
- Returns minute snapshot history.

4. `GET /v1/quote/aggregates`
- Source: PostgreSQL `quote_features_1m`
- Query: `code`, range required.
- Returns aggregate statistics for both features:
  - `min`, `max`, `avg`, `last`, `count`

Error model should align with current serving behavior:

- Redis dependency failure -> `503 redis_unavailable`
- DB dependency failure -> `503 db_unavailable`
- Missing data -> `404` for latest endpoint, empty list for range endpoints when valid but no rows.

---

## 6. SSE Event Contract Extension

Existing `/v1/stream/sse` events remain:

- `kbar_current`
- `metric_latest`
- `heartbeat`

Add quote event(s):

1. `quote_latest` (required)
- Emitted when quote latest payload changes.
- Payload fields:
  - `code`
  - `trade_date`
  - `event_ts` (normalized serving timestamp form)
  - `main_chip`, `main_chip_day_high`, `main_chip_day_low`, `main_chip_strength`
  - `long_short_force`, `long_short_force_day_high`, `long_short_force_day_low`, `long_short_force_strength`

2. `quote_series_1s` (optional, default off in phase 1)
- If enabled later, can deliver short-window incremental second samples.
- Not required for initial cut.

SSE operational rule:

- No-change polling cycle should not emit `quote_latest`.
- Heartbeat cadence remains unchanged.

---

## 7. Data Contract and Time Semantics

- Serving output should normalize timestamp fields to epoch milliseconds where current serving style uses ms fields.
- `strength` fallback when `day_high == day_low` is fixed to `0.5` in phase 1.
- `trade_date` remains exchange/trading-date semantic consistent with existing pipeline conventions.

---

## 8. Failure Handling and Degradation

## 8.1 Redis Failure

- Quote REST Redis-backed endpoints return `503 redis_unavailable`.
- SSE loop follows current behavior (disconnect path to trigger client reconnect).

## 8.2 DB Failure

- `quote/history` and `quote/aggregates` return `503 db_unavailable`.

## 8.3 Parse/Schema Errors

- Drop malformed Redis members defensively.
- Count and log decode errors without crashing serving loop.

---

## 9. Testing Plan (Design-Level)

## 9.1 API Tests

- `quote/latest` success, no-data, redis failure.
- `quote/today` range parsing, empty range, redis failure.
- `quote/history` valid range, missing range, db failure.
- `quote/aggregates` correctness for mixed values and empty dataset.

## 9.2 SSE Tests

- `/v1/stream/sse` still emits existing events unchanged.
- `quote_latest` emits only on change.
- heartbeat still emitted when no state changes.

## 9.3 Auth and Access Tests

- unauthenticated request -> `401`.
- unauthorized visitor path -> `403` if role model applies.

---

## 10. Rollout

Phase 1 rollout order:

1. finalize quote worker ACK/recovery/flush semantics,
2. add quote serving store helpers,
3. add quote REST endpoints,
4. extend `/v1/stream/sse` with `quote_latest`,
5. add tests and observability counters,
6. staged verification in dev before production enable.

---

## 11. Final Summary

This plan keeps the existing architecture stable and extends it incrementally:

- quote worker semantics are tightened for reliability,
- quote serving is added as a dedicated data surface,
- existing SSE endpoint is reused with a new quote event,
- auth/rate-limit behavior remains consistent with current serving layer.
