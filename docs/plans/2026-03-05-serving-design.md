Related TRD: docs/plans/2026-03-05-serving-trd.md

Design scope: high-level architecture and behavior. API parameters and payload details live in the TRD.

1. Architecture and Data Flow (High-Level)

Role boundaries:

L3 (compute layer): converts events into state and writes Redis (intraday/latest) and Postgres (history).

L4 (serving layer): reads state only, serves REST and SSE, does not read Streams directly.

Read paths:

Intraday/today: Redis for low-latency queries and realtime push.

History: Postgres for cross-day, backtesting, and historical queries.

Push path (MVP):

L4 polls Redis state at a configurable interval and only pushes on change.

This model guarantees latest state, not every intermediate event.

2. Read Path Design
2.1 Intraday (Redis)

current K: Hash (single record)

today K: ZSET (time range)

metric latest: String JSON (single record)

metric series: ZSET (time range)

Redis roles:

Low-latency reads

Intraday/today data

Fast chart queries for frontend

2.2 History (Postgres)

Store only completed K bars

Used for cross-day, backtesting, and historical queries

3. Why SSE (instead of complex WS fan-out first)

SSE advantages (MVP):

Simple frontend implementation (EventSource)

Built-in auto-reconnect

One-way push fits market UI needs

Backend can poll Redis state for fast launch

WS can remain optional, or be built as a fuller subscription protocol in Phase 2.

4. Push Model (Polling Redis State)
4.1 Why not push Redis Streams directly to frontend?

Streams are an event log, not a UI model

Need to handle consumer group/pending/replay

Frontend only needs "latest state + today series"

Therefore:

L3 converts events into state

L4 reads state and pushes

4.2 Throttling

Poll every 250ms-1000ms (configurable)

Compare ts/updated_at; no change, no push

Heartbeat is sent at a fixed interval to keep the connection

5. Non-Functional Requirements (MVP)

Availability and degradation:

If Redis or DB is unavailable, REST returns clear error codes; SSE maintains heartbeat or disconnects for client reconnect.

Connection and load limits:

Per-IP SSE concurrent connection limit

Basic REST rate limiting

Push throttling:

Polling interval is configurable; only push on change.

Observability (minimum set):

REST latency

Active SSE connections

SSE push rate

Redis/DB error rate

cache hit (if local cache is added)

Consistency:

Time formats are unified (epoch ms or ISO) across responses.

6. API Design Principles

All time range queries use from_ms/to_ms or ISO

Defaults must be safe (limit returned count)

Unified response schema (KBar / MetricPoint)

Backend handles sorting and stitching (avoid frontend merge errors)

7. Future Extensions (Phase 2)

Move from polling to event-driven:

Redis PubSub, or

Dedicated stream:ui:* fan-out

Multi-instrument subscriptions (code list)

Chart resolutions (1s / 5s / 1m downsampling)

Trading day partitioning (key includes trade_date)
