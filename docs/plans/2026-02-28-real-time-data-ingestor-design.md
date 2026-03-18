# Real-Time Data Ingestor Design (2026-02-28)

Related document: [TRD](2026-02-28-real-time-data-ingestor-trd.md)

## 1. Design Goals

This service is the first layer of the market data pipeline (Ingestion Layer). Key goals:

- Low-latency receipt of Shioaji market data.
- Decoupled from downstream processing (Aggregator / SSE Push).
- Automatic reconnection and re-subscription.
- Short-term replay capability (3 hours).
- Bounded memory and Redis footprint.
- Explicit ordering contract for downstream consumers.
- Gap-signal observability for downstream gap detection.
- Simple and fast to ship (MVP).

## 1.1 Scope Split (MVP vs Phase 2)

MVP (this document):

- Ingestion pipeline reliability.
- Ordering contract (ingestor write-order semantics).
- Gap detection signals (metrics + timestamps) for downstream detectors.
- Replay via Redis Streams retention (~3 hours).

Phase 2 (explicitly deferred):

- Historical backfill workflow.
- K-line correction and re-computation workflow.
- Advanced loss recovery policy beyond current retry/drop strategy.

## 2. High-Level Architecture

```text
Shioaji WS
  |
  v
Ingestor
  - WS callback
  - Internal asyncio.Queue
  - Redis Writer (XADD)
  |
  v
Redis Streams
  - stream:tick:MTX
  - stream:bidask:MTX
```

Design principles:

- Ingestor is stateless.
- No business calculations.
- All state is owned by downstream services.

Responsibility boundary:

- Ingestor owns transport concerns (receive, enqueue, write, reconnect, metrics).
- Aggregator/Processor owns business concerns (gap decision, correction, bar integrity).

## 3. Why Redis Streams

Reasons to use Redis Streams as the event bus:

### 3.1 Decoupling

Ingestor does not need to know:

- how many consumers exist,
- whether consumers are online,
- how fast consumers can process.

### 3.2 Replay

Consumers can resume from the last ID after a crash.
MVP retains approximately 3 hours of events.

### 3.3 Consumer Groups

Supports multiple consumers, e.g.:

- Aggregator (tick)
- SSE Push (bidask / kbar)
- Logger (future)

## 4. Why MAXLEN

Streams are append-only. Without trimming:

- Redis memory grows unbounded.
- AOF files grow large.
- Restart recovery time increases.

MAXLEN design:

- Retention ~ 3 hours
- Tick rate assumed 5/s over 3 hours -> ~54,000
- Bidask assumed 2/s over 3 hours -> ~21,600
- Set MAXLEN ~100,000 to cover spikes
- Use approximate trimming (~) for performance

## 5. Why Only Lightweight Normalization

Ingestor only:

- Adds an envelope (`source`, `code`, `quote_type`, `event_ts`, `recv_ts`)
- Keeps payload unchanged

Ingestor does NOT:

- transform fields,
- compute derived values,
- deduplicate,
- aggregate.

Reasons:

- Lower CPU and latency
- Avoid business-logic coupling
- Preserve replay semantics
- Keep aggregation centralized in the aggregator

## 6. Concurrency Design

### 6.1 Callback -> Queue -> Writer

Avoid direct Redis operations in callbacks.

Issues with direct Redis I/O:

- Redis latency blocks WS receive
- Risk of backlog or data loss

Solution:

- Callback only enqueues (O(1))
- Writer task handles Redis I/O

### 6.2 Backpressure Strategy

Use `asyncio.Queue(maxsize=N)`.

When the queue is full:

- `enqueue` does not block callbacks (use non-blocking `put_nowait`)
- Drop newest event and increment `events_dropped_total`
- `queue_depth` remains observable

MVP: favor WS receive stability over lossless buffering.

## 7. Ordering Semantics (MVP)

The ingestor provides a bounded ordering guarantee:

- For a single ingestor process, callback enqueue order is preserved by FIFO queue.
- A single writer task preserves dequeue order into Redis `XADD`.
- Therefore, order is guaranteed per stream key (`{env}:stream:{quote_type}:{code}`).

The ingestor does NOT guarantee:

- global order across different stream keys,
- order continuity across ingestor restarts or reconnect windows.

Consumer guidance:

- Use Redis Stream ID as transport order within one stream.
- Use `event_ts` for business-time windows (with Stream ID as tie-breaker).

## 8. Gap Detection Contract (MVP)

Gap detection decision logic is downstream, but the ingestor must expose gap signals.

Ingestor-side signals:

- `event_ts` and `recv_ts` on every event envelope.
- `events_dropped_total` when queue overflows.
- `ws_reconnect_count` and reconnect logs for disconnect windows.
- `ingest_lag_ms` and `queue_depth` for staleness/backpressure symptoms.

Downstream (Aggregator/Processor) responsibilities:

- Define gap thresholds per quote type (for example, "no tick for N seconds").
- Mark gap windows and trigger compensation workflow (Phase 2 backfill when available).
- Keep correction/recompute logic out of ingestor.

## 9. Error and Recovery Design

### 9.1 WS Disconnect

Use exponential backoff reconnect:

1s -> 2s -> 4s -> ... -> 30s max

After reconnect:

- login
- re-subscribe all topics

### 9.2 Redis Temporarily Unavailable

Strategy (writer task):

- Retry 3 times with short backoff
- Log + metric on failure
- Callback is never blocked

This MVP tolerates short data loss if Redis is unavailable or the queue overflows.

### 9.3 Redis Restart

Use AOF:

```text
appendonly yes
appendfsync everysec
```

Recovers most data.

## 10. Naming Convention

Because dev/prod share Redis, use a prefix:

```text
{env}:stream:{quote_type}:{code}
```

Examples:

- `prod:stream:tick:MTX`
- `prod:stream:bidask:MTX`

## 11. Time Strategy

- `event_ts`: exchange time (`tick.datetime`)
- `recv_ts`: system UTC time
- Internally, use UTC for consistency

Uses:

- Compute ingest lag
- Downstream aggregation aligned on `event_ts`

## 12. Observability

Required metrics:

| Metric | Purpose |
| --- | --- |
| `events_received_total` | Upstream health |
| `events_written_redis_total` | Redis write success |
| `redis_write_latency_ms` | Redis performance |
| `ws_reconnect_count` | Connection stability |
| `queue_depth` | Backpressure monitoring |
| `ingest_lag_ms` | Latency monitoring |
| `events_dropped_total` | Data loss signal under backpressure |

Ingest lag:

```text
now_utc - last_event.event_ts
```

## 13. Stateless Design

Ingestor does not store:

- intra-day K-bars
- latest quotes
- any aggregation state

Benefits:

- safe to restart
- horizontally scalable (future)
- simpler recovery

## 14. Capacity Estimate

Assumptions:

- tick ~5/s (avg)
- bidask ~1-2/s
- total ~7/s

Redis single-thread easily supports this.
Single ingestor instance is sufficient.

## 15. Safety and Stability

- No I/O in callbacks
- Redis operations include retry
- All errors must be logged
- Bounded queue prevents memory blow-up

## 16. Future Extensions (Non-MVP)

- Multi-instrument support (multi-stream)
- Multi Shioaji session sharding
- Kafka / NATS as event bus
- Long-term raw tick persistence in Postgres
- Drop policy when queue is full
- Historical backfill job and data source integration
- K-line correction/recompute pipeline

## 17. Risks and Limits

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Redis unavailable | Events may be lost | retry + metric |
| WS long disconnect | Data gaps | monitor reconnect + lag |
| Tick rate spike | Queue buildup | monitor `queue_depth` |
| Queue overflow | Event drop | monitor `events_dropped_total` |
| AOF growth | Slow restart | control via MAXLEN |

## 18. Design Decisions Summary

| Item | Decision |
| --- | --- |
| Event bus | Redis Streams |
| Replay capability | 3 hours |
| MAXLEN | ~100,000 |
| Normalization | Lightweight envelope |
| Ordering (MVP) | per-stream write order only |
| Gap detection (MVP) | downstream decision, ingestor emits signals |
| Backfill | Phase 2 |
| K-line correction | Phase 2 |
| Dedup | Not done |
| Aggregation | Downstream |
| Redis persistence | AOF everysec |
| Environment isolation | key prefix |
| Callback I/O | forbidden |


