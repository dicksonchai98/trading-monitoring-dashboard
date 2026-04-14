## 1. Worker Skeleton and Runtime Wiring

- [x] 1.1 Create `index_contribution_worker` module structure and register worker entrypoint in backend runtime.
- [x] 1.2 Add worker configuration schema (index code, trade timezone, snapshot cadence, retry policy, Redis TTL).
- [x] 1.3 Implement startup loader for daily inputs (`weights`, `sector mapping`, `index_prev_close`) and fail-fast validation.

## 2. Core Attribution Computation and In-Memory State

- [x] 2.1 Implement contribution formula function with numeric precision/rounding rules and validation guards.
- [x] 2.2 Implement symbol state map model (`symbol`, prices, weight, pct_change, contribution_points, updated_at, last_event_id).
- [x] 2.3 Implement event ordering/idempotency gate (dedupe by `event_id` or `(symbol, updated_at)`, stale drop rule).
- [x] 2.4 Implement ranking refresh logic for top 20 and bottom 20 with deterministic tie-break (`symbol` asc).
- [x] 2.5 Implement sector aggregate delta update (`sector_total = sector_total - old + new`).
- [x] 2.6 Implement sector resolution priority (internal mapping first, weight-table fallback).

## 3. Redis Real-Time State Publishing

- [x] 3.1 Implement symbol latest Redis writer for `{env}:state:index_contrib:TSE001:{trade_date}:{symbol}:latest`.
- [x] 3.2 Implement top/bottom ranking Redis ZSET writers with top-20 trimming policy.
- [x] 3.3 Implement sector aggregate Redis writer and key TTL/cleanup behavior.
- [x] 3.4 Add retry/error handling for Redis failures with failure counters and threshold alert hooks.

## 4. Minute Snapshot Persistence

- [x] 4.1 Add/align DB schema for `index_contribution_snapshot_1m`, `index_contribution_ranking_1m`, and `sector_contribution_snapshot_1m`.
- [x] 4.2 Implement minute-boundary scheduler using `Asia/Taipei` and `minute_ts=floor(now to minute)` semantics.
- [x] 4.3 Implement upsert-based symbol snapshot flush including `rank_top`, `rank_bottom`, and `weight_version`.
- [x] 4.4 Implement upsert-based ranking and sector snapshot flush paths.
- [x] 4.5 Implement DB flush retry and dead-letter/retry-queue fallback for persistent failures.
- [x] 4.6 Implement default late-event policy to avoid rewriting historical minute snapshots.

## 5. Lifecycle Operations and Recovery

- [x] 5.1 Implement daily reset flow: clear in-memory states and reload daily inputs on trade-date rollover.
- [x] 5.2 Implement warm restart recovery chain: Redis rebuild first, DB latest-minute fallback second.
- [x] 5.3 Add structured logs and metrics for accepted/dropped events, retries, flush lag, and error rates.
- [x] 5.4 Add operational alarms for repeated Redis/DB failures and snapshot lag threshold breaches.
- [x] 5.5 Verify worker runtime remains API-independent (no direct HTTP route registration).

## 6. Verification and Release Readiness

- [x] 6.1 Add unit tests for formula, validation guards, tie-break ordering, idempotency, and stale-event drops.
- [x] 6.2 Add integration tests for end-to-end path (event -> in-memory -> Redis -> minute DB snapshots).
- [x] 6.3 Add restart/recovery tests (warm restart from Redis and DB fallback cases).
- [x] 6.4 Run project test/lint checks and document verification evidence in change notes.
- [x] 6.5 Add tests for sector source priority, six-decimal persistence precision, and default late-event no-rewrite behavior.
