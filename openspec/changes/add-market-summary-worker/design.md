## Context

The backend already has reusable patterns for ingestion (`market_ingestion`), stream workers (`worker_runtime`), Redis state serving, and DB sink retry/dead-letter flow. However, there is no dedicated market-level worker for `TSE001` intraday estimated turnover.

The design baseline for this change is `docs/plans/2026-04-06-market-summary-worker-design.md`, with explicit decisions already confirmed:
- independent serving routes
- reuse existing ingestion process
- shared Redis key format
- duplicate-tolerant DB uniqueness strategy

## Goals / Non-Goals

**Goals:**
- Reuse existing ingestion architecture while adding `market` events for `TSE001`.
- Add a dedicated worker that consumes market stream events via consumer groups and computes market summary metrics safely.
- Persist market summary to Redis latest + zset and minute-level Postgres snapshots.
- Expose independent serving APIs/SSE for market summary.
- Ensure config, observability, and failure handling follow existing production patterns.

**Non-Goals:**
- Multi-market support in phase 1.
- Dynamic adjustment-factor learning/tuning model.
- Stream-to-client direct fan-out without serving state read.
- Upsert-on-conflict behavior for market summary persistence.

## Decisions

### 1. Reuse `market_ingestion` with new `market` quote type
- Decision: extend current ingestion runner/callback path to produce `{env}:stream:market:TSE001`.
- Rationale: minimum operational surface area and maximal reuse of queue->writer->retry behavior.
- Alternative considered: separate ingestion process for market feed. Rejected for phase 1 due to duplicated runtime management.

### 2. Build a dedicated market-summary runner (not merged into existing tick/bidask runner)
- Decision: create a separate worker module/runner with its own config namespace (`MARKET_*` and `MARKET_SUMMARY_*`).
- Rationale: isolates business logic and metrics naming, avoids coupling with tick/bidask state machines.
- Alternative considered: add market branch to existing stream-processing runner. Rejected due to increased complexity and shared-failure blast radius.

### 3. Use existing consumer-group reliability pattern
- Decision: `XAUTOCLAIM` pending + `XREADGROUP` new + `XACK` after state write and DB enqueue.
- Rationale: aligns with established resiliency model and test strategy.
- Alternative considered: plain `XREAD` without groups. Rejected because it weakens recovery semantics.

### 4. Enforce safe metric semantics for completion ratio
- Decision: clamp ratio to `[0.0, 1.0]`; set `estimated_turnover = null` when ratio `<= 0`.
- Rationale: prevents divide-by-zero and invalid pre-open estimates.
- Alternative considered: use epsilon denominator. Rejected due to misleading inflated estimates near open.

### 5. Event-time minute rollover for DB sink
- Decision: flush minute snapshots when event minute changes; force flush on graceful shutdown.
- Rationale: deterministic replay behavior and clean contract with event timestamps.
- Alternative considered: wall-clock scheduler flush. Rejected due to drift during delayed/replayed events.

### 6. Shared Redis key convention and serving timestamp normalization
- Decision: Redis keys follow `{env}:state:{code}:{trade_date}:{suffix}`; serving outputs epoch ms timestamps.
- Rationale: avoids introducing a second key dialect and keeps frontend contract consistent.
- Alternative considered: dedicated `market_summary:*` key root. Rejected due to schema fragmentation.

### 7. Duplicate-tolerant DB sink strategy
- Decision: enforce uniqueness `(market_code, minute_ts)` and skip duplicate conflicts.
- Rationale: idempotent persistence under retries/replays without introducing upsert merge rules.
- Alternative considered: upsert-on-conflict update. Rejected for phase 1 simplicity and deterministic first-write wins.

## Risks / Trade-offs

- [Market data source payload may be inconsistent] -> Mitigation: strict required-field validation and invalid-event metrics.
- [Session-time boundary mismatch causes ratio errors] -> Mitigation: centralized config parsing and shared trade-date helper usage.
- [DB sink failures accumulate backlog] -> Mitigation: bounded batch queue, retry with backoff, dead-letter stream after exhaustion.
- [Serving contract drift from worker payload] -> Mitigation: explicit response schema normalization and API tests for latest/today/history.
- [Telemetry naming collisions with existing workers] -> Mitigation: dedicated `market_summary_*` metric prefix.

## Migration Plan

1. Add ingest support for market quote path and stream key generation for `TSE001`.
2. Add market-summary worker module, runtime entrypoint, and config wiring in `app/config.py` + `app/state.py`.
3. Add Redis state write/read helpers and independent serving routes/SSE event.
4. Add Postgres model + migration for `market_summary_1m` and DB sink pipeline.
5. Add tests (unit/integration/API/non-functional) for ingest->worker->state->serving flow.
6. Roll out with feature flags (`MARKET_SUMMARY_ENABLED`) and monitor metrics/dead-letter stream.

Rollback:
- Disable market-summary worker and serving routes by configuration.
- Keep existing ingestion/tick/bidask flows unchanged.
- Preserve persisted historical rows and logs for analysis.

## Open Questions

- None for phase 1 design scope; open model enhancements (dynamic adjustment factor, session segmentation) remain phase 2.
