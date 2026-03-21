## Context

Current stream processing couples Tick and BidAsk handling in a shared runtime path and still includes synchronous Redis/DB operations in latency-sensitive loops. This causes event-loop unfairness, ACK delay, and cross-workload interference under burst traffic.  
The change introduces a worker-oriented architecture aligned with the existing backend baseline (FastAPI + Redis Streams + PostgreSQL), while preserving deterministic RBAC/API behavior and improving stream reliability.

Key constraints:
- Keep Redis Streams as the event backbone (no messaging-system replacement in this phase).
- Preserve recovery-friendly ACK semantics with pending/reclaim behavior.
- Reuse existing spot ingestion contract (`{env}:stream:spot:{symbol}` + `ingest_seq`) as an upstream dependency.
- Keep rollout incremental with a clear rollback path.

Stakeholders:
- Backend ingestion/processing maintainers
- Realtime/API consumers of latest state
- Operations team responsible for worker health, lag, and incident response

## Goals / Non-Goals

**Goals:**
- Isolate Tick and BidAsk processing into independent workers to remove shared contention.
- Introduce `latest-state-worker` for low-latency spot symbol state (`last/high/low/new-high/new-low`).
- Move historical persistence out of main consume loops through dedicated DB sink workers.
- Refactor blocking I/O from critical paths to async clients or bounded async wrappers.
- Define explicit ACK contracts per worker that preserve reliability without waiting for final DB commit.
- Add observability for lag, retries, queue depth, flush failures, and sink health.

**Non-Goals:**
- Full distributed orchestration/scheduler redesign.
- Replacing Redis Streams with Kafka/Pulsar/other systems.
- One-shot rewrite of all business logic and worker internals.
- Multi-instrument universal architecture beyond this futures + spot150 scope.

## Decisions

1. Split processing into five runtime services (`tick-worker`, `bidask-worker`, `latest-state-worker`, `tick-db-sink`, `bidask-db-sink`).
Why:
- Isolates backpressure and crash blast radius.
- Allows independent scaling and tuning by workload profile.
- Avoids fairness collapse from mixed responsibilities in one loop.
Alternatives considered:
- Keep single process and add internal task queues only: rejected because event-loop and failure-domain coupling remains high.
- Split only Tick/BidAsk but keep DB writes inline: rejected because DB latency would still delay ACK and throughput.

2. Enforce handoff-based ACK semantics for Tick/BidAsk main workers.
Decision:
- ACK only after (a) parse/compute succeeds, (b) critical Redis state write succeeds, (c) payload is successfully handed to sink queue.
- Main worker does not wait for PostgreSQL commit.
Why:
- Preserves at-least-once recovery behavior while reducing critical-path latency.
Alternatives considered:
- ACK after DB commit: rejected due to unacceptable latency amplification.
- ACK before Redis update/handoff: rejected due to consistency/replay gaps.

3. Use dedicated DB sink workers for historical persistence.
Decision:
- Tick/BidAsk sinks consume persistence payloads, batch insert/upsert into PostgreSQL, retry with bounded backoff, and dead-letter on terminal failure.
Why:
- Decouples stream consumption from database variability and supports throughput smoothing.
Alternatives considered:
- Synchronous writes with larger connection pools: rejected because it treats symptoms, not coupling.
- In-loop async DB writes: rejected because still competes with stream consumption and ACK path.

4. Build `latest-state-worker` as in-memory + dirty-set + batched Redis flush.
Decision:
- Maintain per-symbol latest state in memory.
- Mark dirty symbols on updates; flush changed symbols periodically with Redis pipelining.
- Optionally emit immediate FE update event on new high/new low transitions.
Why:
- Avoids writing all symbols on each update and keeps frontend state path short.
Alternatives considered:
- Full-symbol flush per event: rejected for write amplification.
- Persist latest-state through DB first: rejected due to latency and unnecessary dependency.

5. Treat spot ingestion as existing capability dependency rather than new scope.
Decision:
- This change consumes already-defined spot stream contracts and does not introduce new ingestion requirements.
Why:
- Avoids duplicate specifications and keeps this change focused on stream processing refactor responsibilities.
Alternatives considered:
- Re-spec ingestion in this change: rejected due to overlap with existing `add-stock-tick-subscription` artifacts.

6. Async refactor strategy is phased, with temporary wrappers allowed.
Decision:
- Prefer native async Redis/DB clients where feasible.
- For legacy sync dependencies, wrap with `asyncio.to_thread` or executor as an intermediate step.
- Add explicit cooperative yields in loops even when messages are processed.
Why:
- Reduces immediate blocking risk while enabling incremental migration to full async.
Alternatives considered:
- Big-bang full async rewrite: rejected due to migration risk and larger regression surface.

## Risks / Trade-offs

- [Risk] More worker services increase operational complexity and deployment surface. -> Mitigation: standardize health/readiness checks and service templates; maintain a per-worker runbook.
- [Risk] At-least-once delivery with retries can cause duplicates in sinks/recovery paths. -> Mitigation: idempotency keys (`symbol + ingest_seq` or stream-id anchored upserts), dedupe-safe DB write strategy.
- [Risk] In-memory latest-state cache loss on worker restart may cause temporary staleness. -> Mitigation: replay from stream pending/new entries and immediate dirty-state rebuild on startup.
- [Risk] Thread-wrapper interim async approach can hide blocking hotspots under load. -> Mitigation: emit blocking-latency metrics and plan explicit phase-5 native async migration.
- [Risk] Upstream spot ingestion contract drift can break latest-state assumptions. -> Mitigation: keep latest-state input validation and reference existing ingestion capability contract in tests.
- [Risk] New BidAsk historical table design may not match final metric payload shape. -> Mitigation: keep payload extensible (`metric_payload` JSON) and version schema migrations.

## Migration Plan

1. Phase 1: Tick/BidAsk split and fairness fixes
- Deploy independent `tick-worker` and `bidask-worker`.
- Add explicit cooperative yield and remove obvious synchronous blocking from main loops.

2. Phase 2: Tick DB sink
- Introduce `tick-db-sink` and move Tick historical persistence out of main loop.
- Validate ACK handoff behavior and pending/reclaim stability.

3. Phase 3: BidAsk DB sink + history
- Introduce `bidask-db-sink`.
- Add BidAsk historical table and sink writes with retry/dead-letter policy.

4. Phase 4: latest-state worker
- Deploy `latest-state-worker` for spot150.
- Enable dirty-set batched flush and verify latest-state freshness SLO.

5. Phase 5: full async convergence
- Replace remaining thread-wrapper paths with native async clients.
- Remove known blocking segments from critical loops.

Cutover:
- Start new ingestion + workers, switch API/frontend latest-state reads to new keys/path, then stop legacy path.

Rollback:
- Trigger on sustained error rate, growing pending backlog, or unrecoverable latest-state lag.
- Stop new write path, restore legacy consumer path, verify freshness/lag/health.
- Recovery target: rollback RTO <= 10 minutes; latest-state freshness <= 5 minutes after rollback.

## Open Questions

- Should latest-state worker ACK require immediate Redis flush success, or allow durable flush-queue handoff semantics first?
- What is the final retention/index strategy for BidAsk history (`bidask_metrics_1s`) given expected write volume?
- Do we require per-symbol stream partitioning guarantees beyond `{env}:stream:spot:{symbol}` naming, or is current contract sufficient?
- Which Redis keys become the canonical frontend read model during and after cutover?
- What are final alert thresholds for pending lag, sink retries, and flush-failure ratio across environments?
