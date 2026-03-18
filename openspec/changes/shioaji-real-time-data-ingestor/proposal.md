## Why

The system needs a production-ready ingestion layer that continuously receives Shioaji real-time market data and decouples transport from downstream processing. This is needed now to support low-latency monitoring, bounded replay, and stable downstream aggregation/SSE workflows defined in the 2026-02-28 ingestor design.

## What Changes

- Add Shioaji session bootstrap flow: login with credentials, subscribe to real-time topics, and automatically re-login/re-subscribe after disconnect.
- Add ingestion pipeline contract `callback -> internal asyncio queue -> single Redis writer` to avoid callback-side I/O blocking.
- Append normalized envelope events to Redis Streams with environment-prefixed keys by quote type and code, e.g. `{env}:stream:tick:MTX` and `{env}:stream:bidask:MTX`.
- Define bounded replay policy and Redis stream trimming strategy (MVP target around 3-hour retention, approximate `MAXLEN` trimming).
- Define ingestor ordering and gap-signal contract for downstream services (per-stream write order, `event_ts`/`recv_ts`, reconnect and drop signals).
- Define backpressure and fault behavior for queue overflow and temporary Redis write failures, with observable metrics.

## Capabilities

### New Capabilities
- `shioaji-auth-and-subscription`: Authenticate with Shioaji credentials, subscribe/unsubscribe target contracts, and recover subscriptions after reconnect.
- `redis-stream-ingestion-pipeline`: Ingest Shioaji tick/bidask callbacks through queue+writer architecture and publish to `{env}:stream:{quote_type}:{code}`.
- `ingestion-ordering-and-gap-signals`: Expose per-event timestamps and operational signals (`events_dropped_total`, reconnect metrics, lag/depth) so downstream can detect gaps.
- `ingestion-replay-and-retention`: Provide short-term replay window in Redis Streams with bounded memory via `MAXLEN` trimming policy.

### Modified Capabilities
- None.

## Impact

- Affected code: backend `market_ingestion` service (Shioaji client/session lifecycle, callback handlers, queue/writer loop), shared ingestion envelope schema, Redis stream publisher, observability instrumentation.
- Affected systems: Shioaji API connectivity, Redis Streams namespace, runtime environment configuration (credentials, target contracts, retention and queue limits).
- Affected operations: startup must complete login + subscription before steady-state ingestion; reconnect and Redis transient failures must follow defined retry/drop behavior and emit metrics/logs.
