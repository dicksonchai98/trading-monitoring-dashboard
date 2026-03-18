## Context

The system ingests market ticks and bid/ask events into Redis Streams. The UI and SSE layer need low-latency, query-friendly state that streams do not provide directly. This change introduces an aggregator service that consumes streams via consumer groups, computes 1-minute K bars and per-second metrics, writes Redis state for fast reads, and persists completed 1-minute bars to Postgres. Reliability must be sufficient for MVP (at-least-once processing with basic pending reclaim).

## Goals / Non-Goals

**Goals:**
- Convert tick/bidask Redis Streams into Redis state suitable for UI/SSE reads.
- Compute 1-minute K bars and persist completed bars to Postgres.
- Maintain per-second metrics series with stable sampling.
- Provide MVP-level reliability (ACK after writes, pending reclaim, basic observability).
- Enforce Redis state TTL to prevent unbounded growth.
- Align trade_date boundaries to Asia/Taipei 15:00 cutoff.

**Non-Goals:**
- Exactly-once processing or complex replay/correction flows.
- Multi-instrument sharding and full historical backfill.
- Replacing Redis Streams with Kafka or adding new external dependencies.

## Decisions

- **Separate consumers for tick and bidask**: Keeps K-bar aggregation isolated from metric expansion; tuning and monitoring can be done independently.
- **State machines with minimal in-memory state**: Ensures O(1) updates and stable long-running operation without batch dependencies.
- **Redis state as query layer**: Use Hash/ZSET structures for current K, intraday K series, latest metrics, and 1-second metric series to enable fast range queries.
- **Metric registry + series whitelist**: Allows modular metrics while controlling which fields are persisted to time-series ZSETs.
- **Stable 1-second sampling**: Compute delta_1s from prior samples and carry forward values when no events arrive to avoid chart gaps.
- **At-least-once semantics**: ACK only after required writes succeed (tick: Redis+PG, bidask: Redis); accept duplicates over data loss.
- **Pending reclaim on startup + periodic XAUTOCLAIM**: Use configurable idle_ms and claim_count to prevent stuck consumers.
- **Trade date boundary**: Compute trade_date using Asia/Taipei 15:00 boundary for TW futures sessions.
- **TTL on intraday Redis state**: Apply 24h TTL for intraday keys/series to limit memory growth.

## Risks / Trade-offs

- **Dropped late events** → Mitigation: record `late_tick_drops` metric; accept in MVP.
- **Duplicate processing (at-least-once)** → Mitigation: idempotent Redis writes and append-only Postgres inserts for finalized bars.
- **Redis/PG write latency** → Mitigation: keep state minimal, batch where safe, monitor write latency and stream lag.
- **Sampling gaps** → Mitigation: write carry-forward metric points for seconds with no bid/ask events.
- **TTL misconfiguration** → Mitigation: apply TTL on write path and validate with metrics/health checks.
