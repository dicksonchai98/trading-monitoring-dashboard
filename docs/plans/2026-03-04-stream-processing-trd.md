1. Purpose

Consume market events from Redis Streams, perform real-time aggregation and indicator calculations, and produce:

1-minute K (OHLCV)

BidAsk multiple real-time metrics (latest + per-second sampling series)

Write results to Redis (in-session state) and Postgres (K-line history).

2. Scope
   In Scope

Tick stream -> 1-minute K state machine

BidAsk stream -> multi-metric state machine + per-second sampling

Redis state store (Hash / ZSET / String)

Postgres writes completed 1-minute K bars

Consumer group + ACK + pending reclaim (XAUTOCLAIM)

Out of Scope

ingest_seq

gap fill / replay / backfill

correction / late data fixes

multi-instrument (MVP fixed to MTX)

trading-day split (for now, day and night sessions are combined; no split)

3. Input Streams
   3.1 Tick Stream

Key:

{env}:stream:tick:{code}

Required fields (from envelope.payload):

close (number)

volume (int)

event_ts (ISO8601 w/ timezone)

3.2 BidAsk Stream

Key:

{env}:stream:bidask:{code}

Required fields (from envelope.payload):

bid_total_vol (int)

ask_total_vol (int)

event_ts (ISO8601 w/ timezone)

Each Redis Stream entry must include the event field (JSON envelope string); the Aggregator parses event to get payload.

4. Consumer Group Design
   Stream Group Consumer
   tick agg:tick:{code} agg-1
   bidask agg:bidask:{code} agg-1-bidask

Behavior:

XREADGROUP reads new messages (>)

On success -> XACK

If not ACKed -> stays pending

Periodically XAUTOCLAIM reclaim idle pending (avoid stuck consumers)

5. Tick -> 1-minute K aggregation (State Machine)
   5.1 Minute alignment

Align by event time to minute (convert to UTC):

minute_ts = floor(event_ts -> UTC -> minute) (epoch ms)

5.2 State

In-memory state:

current_minute_ts

open/high/low/close/volume

5.3 Rules

first tick: initialize current bar

same minute: update OHLCV

new minute: archive previous bar -> write Redis ZSET + Postgres -> create new current bar

late tick (minute_ts < current_minute_ts): drop and record metric

6. BidAsk -> multi-metric aggregation (State Machine + Registry)
   6.1 Latest metrics (update per event)

Each bidask event updates at least:

bid_total_vol

ask_total_vol

imbalance = bid_total_vol - ask_total_vol

ratio = bid_total_vol / ask_total_vol (ask > 0)

sum_total_vol = bid_total_vol + ask_total_vol

6.2 delta_1s (computed at sampling points)

Delta metrics do not use the previous event; they use the previous second's sampling baseline:

delta_bid_total_vol_1s = bid_total_vol(now) - bid_total_vol(prev_sample)

delta_ask_total_vol_1s = ask_total_vol(now) - ask_total_vol(prev_sample)

delta_1s is produced only when sampling writes occur (and stored in series).

6.3 series_fields (default)

The per-second ZSET series writes only these fields by default:

imbalance

ratio

delta_bid_total_vol_1s

delta_ask_total_vol_1s

7. Sampling Strategy

latest: overwrite on every bidask event

series: write at most once per second (by now_ms // 1000)

8. Redis State Store (Output)
   8.1 K bars
   Key Type Description
   {env}:kbar:1m:current:{code} Hash current-minute K
   {env}:kbar:1m:{code} ZSET today's K (score=minute_ts, value=JSON)

TTL:

kbar:1m:{code} set TTL = 86400 seconds (fixed 24h)

8.2 BidAsk metrics
Key Type Description
{env}:metric:bidask:latest:{code} String(JSON) latest metrics (full set)
{env}:metric:bidask:today:{code} ZSET per-second sampling series (score=ts, value=JSON with series_fields only)

TTL:

metric:bidask:today:{code} set TTL = 86400 seconds (fixed 24h)

9. Postgres (K bar persistence)

Table: kbars_1m

Only write completed minute bars

No upsert / correction

10. Startup Recovery

Tick: on startup, may read Redis current (if present) to continue current bar (optional; MVP can reinitialize)

Consumer group: resume from last ACK

No historical replay / recompute

11. Metrics (required)

ticks_consumed_total

kbar_completed_total

late_tick_dropped_total

bidask_consumed_total

metric_samples_written_total

redis_write_errors_total

pg_write_errors_total

stream_lag_ms (now - last_event_ts)

12. Health

GET /health

Redis connection status

last_event_ts / last_sample_ts

counters and error counts

13. Acceptance Criteria

Tick can produce 1-minute K

Minute rollover can archive to Redis ZSET + Postgres

BidAsk latest metrics update per event

BidAsk series at most one per second (ZSET)

Series includes the default 4 fields

delta_1s computed from the previous second's sampling point

TTL effective (24h)

Consumer group + pending reclaim works

After restart, processing continues (at least no pending stuck)
