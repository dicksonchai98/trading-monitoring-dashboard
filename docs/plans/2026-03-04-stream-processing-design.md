1. Design Goals

Aggregator is the L3 streaming computation layer. It converts event streams (Redis Streams) into queryable in-session state (Redis State), and persists completed 1-minute K bars to Postgres.

TRD reference: `docs/plans/2026-03-04-stream-processing-trd.md`

Design focus:

low latency, stable long-running operation

minimal state (state machines)

decoupled from ingestion (consumer groups)

query-friendly (ZSET/Hash)

easy to debug (keep both event stream and derived state)

2. High-Level Data Flow

Redis Streams (tick / bidask)
|
v
Aggregator
|- Tick Consumer -> 1m K state machine
|- BidAsk Consumer -> metrics state machine (+ registry)
|
v
Redis State
|- current K (Hash)
|- K ZSET (today)
|- latest metric (String JSON)
|- metric ZSET (1s sampling)
|
v
Postgres (kbars_1m)

3. Why Streams Are Not Used Directly by the Frontend

Streams are append-only event logs, suitable for:

decoupling producer/consumer

short-term catch-up

But not suitable for:

frontend time-range queries (high cost, unclear semantics)

UI getting the "latest state" in one fetch

Therefore, events must be transformed into Redis State (a query layer).

4. Why Split Tick Consumer and BidAsk Consumer

Tick and BidAsk have different characteristics:

Tick: minute aggregation (bar state machine)

BidAsk: multi-metric calculation + per-second sampling (metric state machine)

Benefits of splitting:

clearer logic

metric expansion does not affect K bars

independent monitoring and tuning of read parameters

5. State Machine Design
   5.1 1-minute K State Machine

Align by event_ts (already Asia/Taipei) to minute start and maintain the "current minute bar."
On minute change, archive the previous bar.

Characteristics:

O(1) updates

minimal in-memory state

no dependency on pandas / batch jobs

Late/invalid events:

- If event_ts falls into a minute earlier than current, drop it (no backfill)
- If event_ts is missing or malformed, drop it and increment an error counter

5.2 BidAsk Metrics State Machine + Registry

Metrics are modularized via a registry:

compute latest metrics when events arrive

compute delta_1s on sampling ticks (baseline is previous second's sample)

Why use delta_at_1s:

stable: avoids delta jitter due to bidask event frequency fluctuations

aligned with 1s time-series, better for charts

fixed and controllable write volume: 1 per second

6. Redis State Shapes and Rationale
   current K (Hash)

overwrite-style state with explicit fields

UI can show the "forming K" in real time

K ZSET (today)

score=minute_ts, naturally supports range queries

good for charting and replaying today's K

latest metric (String JSON)

UI can GET all metrics in one request

schema can add fields as needed (forward compatible)

metric ZSET (1s sampling)

one point per second, controlled data volume

range queries by score=ts, suitable for intraday trend charts

series_fields whitelist prevents unnecessary write bloat

Timestamp units:

- ZSET score uses Unix seconds (int)

Sampling gap behavior:

- If a second has no bidask events, write a carry-forward point to metric ZSET

7. Consumer Group and Reliability

Using Redis Streams consumer groups ensures:

each event is handled by one consumer within the group

ACK indicates processing completed

pending retains uncompleted events

To avoid pending stuck when a consumer crashes, periodically:

XAUTOCLAIM reclaim idle pending

MVP does not require exactly-once, but does require:

not easily stuck

observable

self-healing on failure

MVP reliability clarifications:

- ACK only after Redis state + Postgres write succeed (avoid data loss, accept at-least-once)
- On startup: scan pending, XAUTOCLAIM idle entries, then read new events
- Define reclaim parameters such as idle_ms and claim_count (ex: 30s, 100 entries)
- If write fails, do not ACK; leave pending for retry (optionally DLQ later)

8. TTL Strategy (24h)

In-session state and intraday chart series only need short retention:

Redis state TTL = 24h for auto cleanup

long-term history stored in Postgres (kbars_1m)

This avoids unbounded Redis growth and reduces ops cost.

9. Observability

Monitor via metrics/health:

consume rate, archive rate, sampling rate

late tick drops

Redis/PG write errors and latency

stream lag (now - last_event_ts)

10. Future Expansion

multi-instrument: multiple stream keys + multiple consumers or sharding

trading-day split: change today key to {trade_date}

gap fill / replay / correction: introduce ingest_seq and replay flow

replace Streams with Kafka: no change to state store shapes (only L2 changes)

11. Trading Day Definition (TW Futures)

- Trading day is Asia/Taipei 15:00:00 to next day 13:45:00
- Trade date key: if event_ts.time >= 15:00 then trade_date = event_ts.date, else trade_date = event_ts.date - 1 day
- 13:45–15:00 is expected to have no market events; no special handling
