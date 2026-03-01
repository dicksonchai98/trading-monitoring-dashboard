## Context

This change introduces the ingestion layer for Shioaji real-time market data and publishes normalized events into Redis Streams for downstream consumers. Current proposal scope covers Shioaji login/subscription lifecycle, queue-based decoupling from callbacks, bounded replay retention, per-stream ordering guarantees, and gap-signal observability.

The design follows the existing market data workflow baseline in `AGENTS.md` and aligns with `docs/plans/2026-02-28-real-time-data-ingestor-design.md` as the detailed technical reference for ingestion behavior.

## Goals / Non-Goals

**Goals:**
- Build a resilient Shioaji ingestion service that can login, subscribe, reconnect, and re-subscribe automatically.
- Ensure callback handling is non-blocking by decoupling transport receive from Redis writes using an internal bounded queue.
- Publish events to Redis Streams using environment-prefixed key convention `{env}:stream:{quote_type}:{code}`.
- Preserve per-stream transport ordering (single queue + single writer per process).
- Provide short-term replay capability (target ~3 hours) with bounded Redis memory via `MAXLEN` trimming.
- Emit operational gap signals and reliability metrics (`events_dropped_total`, reconnect counts, queue depth, ingest lag).

**Non-Goals:**
- Historical backfill and compensation workflow.
- K-line correction/recompute logic.
- Business aggregation, deduplication, or indicator computation in the ingestor.
- Global ordering guarantees across multiple stream keys or across reconnect windows.

## Decisions

1. Use Shioaji callback -> `asyncio.Queue(maxsize=N)` -> single Redis writer task
   - Rationale: callback must stay lightweight and avoid Redis I/O stalls; queue isolates websocket receive from downstream slowness.
   - Alternatives considered:
     - Direct Redis `XADD` in callback: rejected due to callback blocking and higher drop risk under Redis latency spikes.
     - Multi-writer model: rejected in MVP to avoid ordering ambiguity and synchronization complexity.

2. Keep normalization lightweight with an event envelope
   - Decision: emit envelope fields (`source`, `code`, `quote_type`, `event_ts`, `recv_ts`) while preserving raw payload.
   - Rationale: maintain low latency and replay fidelity while leaving business interpretation to downstream services.
   - Alternatives considered:
     - Transform/reshape payload inside ingestor: rejected to avoid coupling to downstream business logic.
     - Ingest-time dedup/aggregation: rejected as out of boundary for transport layer.

3. Redis Streams as ingestion bus with bounded retention
   - Decision: write to `{env}:stream:{quote_type}:{code}` and trim with approximate `MAXLEN ~` for performance.
   - Rationale: stream IDs support replay and transport ordering; key prefix isolates environments; MAXLEN bounds memory and AOF growth.
   - Alternatives considered:
     - Pub/Sub: rejected because no replay semantics.
     - Persist only latest snapshot keys: rejected because downstream recovery from offsets requires append-only history.

4. Failure and backpressure policy favors receive stability
   - Decision: on queue overflow, drop newest event and increment drop metrics; on Redis write failures, retry with short backoff up to bounded attempts, then log and continue.
   - Rationale: bounded memory and callback responsiveness are mandatory for long-running real-time ingestion.
   - Alternatives considered:
     - Block callback until queue has space: rejected due to upstream receive instability.
     - Unbounded queue: rejected due to memory blow-up risk.

5. Reconnect strategy uses exponential backoff with full subscription restore
   - Decision: reconnect with capped exponential backoff and re-run login + subscription for configured targets.
   - Rationale: transient network failures are expected; deterministic recovery flow reduces manual operations.
   - Alternatives considered:
     - Manual restart after disconnect: rejected due to operational fragility.

## Risks / Trade-offs

- [Redis unavailable during burst] -> Retry writes with short backoff; emit write-failure metrics/logs; accept bounded data loss under sustained outage.
- [Queue overflow at peak tick rates] -> Keep queue bounded, expose `queue_depth` and `events_dropped_total`, tune queue size by environment.
- [Reconnect window creates data gaps] -> Expose reconnect counters and timestamps; downstream gap detection uses `event_ts`/`recv_ts` and stream continuity.
- [MAXLEN too small/large] -> Start with MVP estimate (~3 hours), then tune based on observed throughput and memory budget.
- [Shioaji API contract misunderstandings] -> Validate exact login/subscription API usage against Context7 Shioaji docs before implementation tasks are finalized.

## Migration Plan

1. Add ingestion service configuration fields (credentials, subscription targets, queue size, stream retention).
2. Implement session lifecycle (login, subscribe, reconnect/re-subscribe) and callback handlers.
3. Implement queue + writer loop with Redis Stream publish and retention trimming.
4. Add metrics/logging and error handling hooks for reconnect, lag, queue depth, drops, and Redis retries.
5. Roll out in non-prod with shared Redis namespace prefix isolation, verify stream throughput and replay window.
6. Promote to production with monitoring thresholds and rollback by disabling ingestor deployment/config.

Rollback strategy:
- Disable ingestor process (or feature flag) to stop new writes.
- Preserve existing stream consumers; no schema migration rollback required because change is additive on stream production path.

## Open Questions

- Exact Shioaji login/session renewal behavior under prolonged reconnect loops (token/session expiry edge cases).
- Final contract code universe for MVP (`MTX` only or include additional near-month instruments).
- Environment-specific defaults for queue size and `MAXLEN` based on observed real tick/bidask rates.
- Whether to use one process-wide queue/writer for all quote types or per-quote-type queue/writer in initial implementation.
