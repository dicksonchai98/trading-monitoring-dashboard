## Why

We need a dedicated stream-processing service to transform Redis Streams market events into query-friendly Redis state and persisted 1-minute K bars, enabling low-latency UI reads and stable long-running operation.

## What Changes

- Introduce an aggregator service that consumes tick and bidask Redis Streams via consumer groups.
- Maintain Redis state for current K, intraday K series, latest metrics, and 1-second metric series.
- Persist completed 1-minute K bars to Postgres.
- Define MVP reliability rules for ACK/pending reclaim and basic observability metrics.

## Capabilities

### New Capabilities
- `stream-processing-aggregator`: Stream consumers and state machines that compute K bars and metrics from Redis Streams, write Redis state, and persist 1-minute K bars.
- `redis-state-query-layer`: Query-friendly Redis state shapes (hashes/ZSETs) for current K and metric series used by the UI.

### Modified Capabilities

## Impact

- Backend: new aggregator module/service and Redis Streams consumer group logic.
- Data stores: Redis state keys/ZSETs and Postgres `kbars_1m` writes.
- Realtime/UI: reads from Redis state for SSE fanout; no direct stream access.
