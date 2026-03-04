# Real-Time Data Ingestor TRD (2026-02-28)

## 1. Objective

Provide a low-latency ingestion layer that receives Shioaji market data, writes
events to Redis Streams, and enables downstream consumers to process data
independently with short-term replay.

## 2. Scope

In scope (MVP):

- Receive Shioaji WS tick and bidask data.
- Enqueue events quickly in callback.
- Write to Redis Streams via XADD.
- Apply MAXLEN retention for ~3 hours.
- Support reconnection and resubscription.
- Define and expose ordering contract.
- Expose gap-detection signals for downstream processors.
- Emit required metrics.

Out of scope (Phase 2):

- Multi-instrument coverage beyond the current near-month scope.
- Long-term historical storage.
- Historical backfill from external market data source.
- K-line correction/recompute pipeline.
- Kafka/NATS integration.
- Advanced loss recovery policy beyond current retry/drop strategy.

## 3. Functional Requirements

### 3.1 Ingestion

- MUST subscribe to Shioaji WS topics for tick and bidask.
- MUST capture events with minimal latency.
- MUST enqueue in memory and offload Redis I/O to a writer task.

### 3.2 Event Writing

- MUST write events to Redis Streams via XADD.
- MUST use stream names following the naming convention.
- MUST apply MAXLEN with approximate trimming.
- SHOULD retry Redis writes up to 3 times on transient failure.
- MUST NOT block WS callbacks on Redis I/O.

### 3.3 Replay Support

- MUST retain approximately 3 hours of events.
- MUST enable consumers to resume from last ID.

### 3.4 Ordering Contract (MVP)

- MUST preserve per-stream write order within a single ingestor process.
- MUST use one FIFO queue and one writer task for Redis stream writes.
- MUST NOT claim global ordering across different stream keys.
- MUST document consumer guidance: use stream ID as transport order in the same stream, and use `event_ts` for business-time windows (stream ID as tie-breaker).

### 3.5 Gap Detection Signals (MVP)

- MUST include `event_ts` and `recv_ts` in each envelope.
- MUST emit `events_dropped_total` when queue overflow drops events.
- MUST emit `ws_reconnect_count`, `queue_depth`, and `ingest_lag_ms`.
- MUST state that gap decision logic belongs to downstream aggregator/processor.

### 3.6 Resilience

- MUST reconnect on WS disconnect with exponential backoff.
- MUST resubscribe all topics after reconnect.
- SHOULD tolerate short Redis outages (log + metric on failure).

## 4. Non-Functional Requirements

- Latency: callback enqueue SHOULD be O(1) in normal path.
- Reliability: bounded queue prevents memory blow-up.
- Observability: metrics for event counts, queue depth, lag, and drop/reconnect signals.
- Deployability: single ingestor instance is sufficient at current rates.

## 5. Data Model

### 5.1 Stream Key Naming

```text
{env}:stream:{quote_type}:{code}
```

Examples:

- `prod:stream:tick:MTX`
- `prod:stream:bidask:MTX`

### 5.2 Envelope Fields

Each event adds:

- `source`
- `code`
- `quote_type`
- `event_ts`
- `recv_ts`

Payload remains unchanged.

Note:

- `stream_id` is assigned by Redis at write time and consumed downstream.

## 6. Time Strategy

- `event_ts`: exchange time (`tick.datetime`)
- `recv_ts`: system UTC time
- All internal computations use UTC.

## 7. Observability Requirements

Required metrics:

- `events_received_total`
- `events_written_redis_total`
- `redis_write_latency_ms`
- `ws_reconnect_count`
- `queue_depth`
- `ingest_lag_ms`
- `events_dropped_total`

Ingest lag calculation:

```text
now_utc - last_event.event_ts
```

## 8. Error Handling

- WS disconnects: exponential backoff up to 30s.
- Redis failures: retry 3 times; on failure, log and emit metric.
- Redis restart: AOF enabled (`appendonly yes`, `appendfsync everysec`).

## 9. Configuration

MVP configuration parameters:

- Redis connection settings
- Stream MAXLEN (default ~150,000)
- Queue max size
- Environment prefix (`dev`/`prod`)
- WS reconnect backoff settings

## 10. Capacity Targets

Assumptions:

- tick ~5/s
- bidask ~1-2/s
- total ~7/s

Single ingestor instance is sufficient.

## 11. Testing Requirements

Unit:

- Queueing and writer logic.
- Envelope creation.
- Ordering guarantee inside one stream.
- Metrics emission for dropped/reconnect/lag signals.

Integration:

- WS callback -> queue -> Redis stream write.

Non-functional:

- WS reconnect behavior.
- Redis retry behavior.
- Queue backpressure under burst.
- Gap-signal visibility during disconnect and overflow scenarios.
