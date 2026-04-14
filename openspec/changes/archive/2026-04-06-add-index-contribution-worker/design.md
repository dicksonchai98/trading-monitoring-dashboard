## Context

The current backend stream-processing stack ingests and normalizes market events, but attribution outputs for `TSE001` are not yet produced as a dedicated layer. Product requirements need real-time per-symbol contribution, top/bottom ranking, and sector aggregation with minute snapshots for replay/analysis. This change introduces a dedicated worker that consumes spot latest updates and emits attribution state to Redis plus minute snapshots to PostgreSQL.

Constraints:
- Keep scope to one index (`TSE001`) and its daily constituent universe.
- Preserve existing separation of concerns: ingestion/latest-state remains upstream.
- Ensure deterministic behavior under duplicate/out-of-order events.

## Goals / Non-Goals

**Goals:**
- Deliver a dedicated real-time attribution pipeline for `TSE001`.
- Maintain symbol, ranking, and sector attribution state in memory and Redis.
- Persist minute-level snapshots for symbol/ranking/sector layers.
- Define deterministic ordering, idempotency, and warm-restart behavior.

**Non-Goals:**
- Multi-index abstraction.
- Futures quote/bidask aggregation.
- Market-wide turnover estimation.
- Sub-minute historical replay persistence.

## Decisions

### Decision 1: Dedicated worker boundary
Use a separate `index_contribution_worker` instead of extending the generic latest-state worker.
- Rationale: attribution concerns (ranking maintenance, sector aggregation, snapshot persistence) are domain-specific and would overload generic projection logic.
- Alternative considered: embed attribution in spot latest worker. Rejected due to coupling and reduced operability.

### Decision 2: Event-time ordering + idempotency gate
Apply `event_id` deduplication (fallback `(symbol, updated_at)`), and drop stale events (`updated_at <= current.updated_at`).
- Rationale: prevents ranking/sector drift from replay, retries, and stream disorder.
- Alternative considered: processing-time ordering only. Rejected due to non-deterministic state.

### Decision 3: Delta-based sector aggregation
When a symbol updates, recalculate symbol contribution and apply sector delta (`new - old`) to sector totals.
- Rationale: avoids O(N) full recompute per event and prevents double counting.
- Alternative considered: full sector recompute each event. Rejected due to unnecessary cost.

### Decision 4: Minute-boundary snapshot with upsert
Persist snapshots at minute boundary using `minute_ts=floor(now, minute, Asia/Taipei)` and upsert by table PK.
- Rationale: deterministic and replay-friendly historical data with bounded write volume.
- Alternative considered: write every event. Rejected due to high write amplification and noisy history.

### Decision 5: Warm restart rebuild chain
On restart during session, rebuild from Redis latest first, then fallback to latest DB minute snapshot, then resume stream consumption.
- Rationale: minimizes cold-start gaps while keeping recovery practical.
- Alternative considered: wait for fresh events only. Rejected due to stale/empty startup window.

## Risks / Trade-offs

- [Out-of-order upstream timestamps] -> Mitigation: strict stale-drop rule + drop counters/alerts.
- [Daily weight/sector source inconsistency] -> Mitigation: explicit source priority and persisted `weight_version`.
- [Redis transient failures] -> Mitigation: retry with threshold-based alerting and keep in-memory source-of-truth for current process.
- [Minute flush failure] -> Mitigation: retry policy + dead-letter payload option + lag metrics.
- [Single-index design future extension cost] -> Mitigation: keep key/table names index-aware (`index_code`) for later expansion.

## Migration Plan

1. Add worker module, in-memory model, and contribution compute path behind feature config.
2. Add Redis writers and key management (including TTL/cleanup).
3. Add PostgreSQL snapshot tables and upsert sinks.
4. Wire runtime startup/daily reset/warm-restart logic.
5. Add unit/integration tests for formula, ordering/idempotency, and minute flush.
6. Enable in staging with metrics and failure alarms.
7. Roll out to production.

Rollback:
- Disable worker via runtime flag or service deployment rollback.
- Existing upstream ingestion/latest-state flows are unaffected.

## Open Questions

- Whether to allow bounded late-event backfill window (for example <= 2 minutes) or enforce strict no-rewrite policy.
- Whether ranking Redis state should include enriched payload (name/sector) or keep symbol+score only.
