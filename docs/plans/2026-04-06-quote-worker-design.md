# Quote Worker Design

## 1. Overview

`quote_worker` is a dedicated stream-processing worker for futures `quote` data.

Its responsibility is to consume normalized quote events from Redis Streams, aggregate them at 1-second frequency, and produce a small set of quote-based realtime features for frontend display and historical analysis.

In phase 1, this worker only supports one futures instrument and only computes two features:

- `main_chip`
- `long_short_force`

This worker follows the same general processing pattern already used by the current stream-processing workers:

- ingestion writes normalized events into Redis Streams
- worker consumes via consumer group
- worker maintains Redis latest state and intraday series
- worker flushes minute snapshots into PostgreSQL

This keeps operational behavior aligned with the existing `tick_worker` and `bidask_worker` design. :contentReference[oaicite:1]{index=1}

---

## 2. Goals

### 2.1 Functional Goals

The worker should provide:

- realtime quote-based feature latest state
- intraday quote feature series for today
- day high / day low tracking for each feature
- strength score for each feature
- minute-level DB snapshots for historical analysis

### 2.2 Supported Features in Phase 1

The worker only computes:

1. `main_chip`
   - business definition follows your agreed formula:
   - `sell_fill_count - buy_fill_count`

2. `long_short_force`
   - business definition follows your agreed formula:
   - `outside_volume - inside_volume`

### 2.3 Non-Goals

This worker does **not** handle:

- K-bar aggregation
- order book / bidask metrics
- generic latest-state projection for spot
- market-level estimated turnover
- index contribution / ranking / sector aggregation
- multi-instrument support in phase 1

---

## 3. Scope

### 3.1 Instrument Scope

Phase 1 only supports **one configured futures instrument**.

The target instrument is configuration-driven, not hard-coded in logic.

### 3.2 Data Scope

This worker only consumes **futures quote events**.

It does not consume:

- tick stream
- bidask stream
- spot stream

---

## 4. High-Level Architecture

```text
Shioaji Futures Quote Subscribe
  -> Quote Callback
  -> Normalized Ingestion Event
  -> Ingestion Queue
  -> Redis XADD -> {env}:stream:quote:{code}
  -> quote_worker (consumer group)
  -> 1s aggregation
  -> Redis state
     - quote_features:latest
     - quote_features:zset
  -> minute flush
  -> PostgreSQL
     - quote_features_1m

This architecture intentionally mirrors the existing stream-processing flow already used by the current workers.

5. Data Ingest Design
5.1 Why New Ingest Is Needed

Current as-is ingestion writes:

futures tick stream
futures bidask stream
spot stream

To support quote_worker, ingestion must additionally subscribe to futures quote and write quote events into Redis Streams.

5.2 Quote Subscription

The ingestion layer should subscribe to futures market data with:

quote_type = quote

The exact contract selection is outside this worker and should follow the same contract selection mechanism already used by current futures ingestion.

5.3 Redis Stream Key

New stream key:

{env}:stream:quote:{code}

Example:

dev:stream:quote:TXFC6

This naming convention matches the current stream naming style already used in the system.

5.4 Normalized Ingestion Event

The ingestion layer should normalize raw quote callback data into a stable event envelope.

Example schema:

{
  "source": "shioaji",
  "code": "TXFC6",
  "asset_type": "futures",
  "quote_type": "quote",
  "event_ts": "2026-04-05T09:30:01.123+08:00",
  "recv_ts": "2026-04-05T09:30:01.140+08:00",
  "payload": {
    "price": 20123.0,
    "volume": 5,
    "volsum": 12345,
    "tick_type": 1,
    "bid_side_total_cnt": 320,
    "ask_side_total_cnt": 280
  }
}
5.5 Required Payload Fields

At minimum, phase 1 requires these normalized fields:

price
volume
volsum
tick_type
bid_side_total_cnt
ask_side_total_cnt
5.6 Ingest Reliability

The quote ingest path should reuse the same operational behaviors already present in current ingestion:

in-memory queue buffering
Redis XADD
retry / backoff
MAXLEN ~ approximate trimming
drop metrics if queue is full

This keeps operational consistency with the existing ingestion layer.

6. Worker Consumption Model
6.1 Stream Pattern

The worker consumes:

{env}:stream:quote:{code}

In phase 1, only one configured code is used.

6.2 Consumer Group

Suggested consumer group:

agg:quote
6.3 Consumer Name

Example:

quote-worker-1
6.4 Read Strategy

The worker should reuse the same consumption strategy as the existing stream-processing workers:

recover pending messages via XAUTOCLAIM
consume new messages via XREADGROUP
only XACK after successful handling

This matches the current processing model already used by tick and bidask workers.

7. Feature Definitions
7.1 main_chip

Business definition agreed in this phase:

main_chip = sell_fill_count - buy_fill_count

Within quote processing, this is derived from the available buy-side / sell-side fill count fields after normalization.

For phase 1, use:

main_chip = ask_side_total_cnt - bid_side_total_cnt

If business semantics are later refined, the field mapping can be adjusted without changing the stream contract.

7.2 long_short_force

Business definition agreed in this phase:

long_short_force = outside_volume - inside_volume

Within quote processing, this is derived from quote event volume and direction.

Suggested mapping:

tick_type == outside -> add to outside volume
tick_type == inside -> add to inside volume

Then compute:

long_short_force = cum_outside_volume - cum_inside_volume
7.3 Strength Score

Each feature maintains:

value
day_high
day_low
strength

Suggested formula:

strength = (value - day_low) / (day_high - day_low)

Edge handling:

if day_high == day_low, return:
0.5
or null

Recommended in phase 1:

use 0.5
8. Aggregation Model
8.1 Why 1-Second Aggregation

You already chose to avoid per-event output and instead aggregate once per second.

This is recommended because:

it reduces noise
it stabilizes frontend display
it aligns better with the existing metrics-style processing pattern
8.2 Internal 1-Second Bucket

Within each second, the worker accumulates quote events into a current second bucket.

At second boundary, the worker emits a new feature snapshot.

8.3 Per-Second Output Fields

Each emitted second snapshot should include:

code
event_ts
main_chip
main_chip_day_high
main_chip_day_low
main_chip_strength
long_short_force
long_short_force_day_high
long_short_force_day_low
long_short_force_strength
9. Redis State Design
9.1 Latest State Key
{env}:state:{code}:{trade_date}:quote_features:latest

Example:

dev:state:TXFC6:2026-04-05:quote_features:latest
9.2 Latest State Payload Example
{
  "code": "TXFC6",
  "event_ts": "2026-04-05T09:30:05+08:00",
  "main_chip": -42,
  "main_chip_day_high": 18,
  "main_chip_day_low": -55,
  "main_chip_strength": 0.18,
  "long_short_force": 126,
  "long_short_force_day_high": 180,
  "long_short_force_day_low": -40,
  "long_short_force_strength": 0.75
}
9.3 Intraday Series Key
{env}:state:{code}:{trade_date}:quote_features:zset
9.4 ZSET Value

Each member stores one second snapshot as serialized JSON.

Score:

second-level timestamp
9.5 Retention

Redis intraday series only keeps today’s trading date.

Cross-day history is stored in PostgreSQL, not Redis.

10. Database Design
10.1 Table Name
quote_features_1m
10.2 Purpose

Store minute-level final snapshot of quote-based features.

This table is for:

historical review
feature validation
frontend history queries if needed
future analytics
10.3 Row Semantics

Each row stores the last available feature snapshot of that minute.

This is a minute snapshot table, not a minute OHLC feature bar table.

10.4 Suggested Schema
code
trade_date
minute_ts
main_chip
main_chip_day_high
main_chip_day_low
main_chip_strength
long_short_force
long_short_force_day_high
long_short_force_day_low
long_short_force_strength
payload
10.5 Primary Key
(code, minute_ts)
10.6 Why One Table Is Enough

Phase 1 only has two quote-based features, so a single table is sufficient and preferred.

Splitting into multiple tables would make the design unnecessarily fragmented.

11. Minute Flush Design
11.1 Flush Policy

At each minute boundary, the worker writes the last emitted second snapshot of that minute into DB.

11.2 Flush Source

Flush source is the worker’s in-memory latest state, not a Redis readback.

This follows the design direction already agreed:

realtime state lives in worker memory + Redis
minute snapshots are flushed from worker memory into DB
11.3 Why Snapshot Instead of Full Minute Aggregation

You explicitly chose:

DB stores the minute’s last value
not average / max / min / close bundle

This keeps the table lightweight and easier to query.

12. In-Memory State Design
12.1 Current Day State

The worker maintains an in-memory state object for the configured code.

Suggested fields:

current_second_bucket
latest_snapshot
current_minute_last_snapshot
day high / low tracking for each feature
12.2 Current Second Bucket

Used to accumulate:

buy-side / sell-side counts
outside / inside volumes

At second boundary, the bucket is converted into a feature snapshot.

12.3 Daily Reset

At new trade date:

clear second bucket
reset latest snapshot
reset day highs / lows
reset minute snapshot state
13. Failure Handling
13.1 Stream Message Failure

If one quote event fails processing:

log it
do not block the loop
only XACK successful events
13.2 Redis Write Failure

If latest / zset write fails:

keep in-memory state unchanged
retry with configured backoff
if retries exceed threshold, log and continue loop
13.3 DB Flush Failure

If minute flush fails:

keep failed minute snapshot payload
retry according to existing DB sink retry pattern
optionally write to dead-letter stream if final failure occurs

This should follow the same general DB sink philosophy already used by the current stream-processing workers.

14. Startup Procedure

At startup:

read configured target futures code
create / validate consumer group for quote stream
initialize empty in-memory state
start stream consumption loop
start second-boundary aggregation loop
start minute-boundary flush loop
15. Configuration

Suggested config items:

QUOTE_WORKER_ENABLED
QUOTE_WORKER_TARGET_CODE
QUOTE_WORKER_GROUP
QUOTE_WORKER_CONSUMER_NAME
QUOTE_WORKER_STREAM_MAXLEN
QUOTE_WORKER_DB_FLUSH_ENABLED
QUOTE_WORKER_REDIS_RETRY_ATTEMPTS
QUOTE_WORKER_REDIS_RETRY_BACKOFF_MS
16. Serving Expectations

This worker does not expose APIs directly.

Serving layer can later expose endpoints such as:

current quote features
today quote feature series
minute quote feature history

The worker only owns state generation and persistence.

17. Rollout Plan
Phase 1
add futures quote subscription in ingestion
add Redis stream stream:quote:{code}
add quote_worker
compute:
main_chip
long_short_force
write:
latest
zset
minute DB snapshot
Phase 2
refine field mapping if business semantics need adjustment
add more quote-based metrics if needed
18. Open Questions
18.1 Semantic Validation

The business meaning of bid_side_total_cnt / ask_side_total_cnt and their mapping to main_chip should be verified against actual quote payload behavior in live market data.

18.2 Tick Type Mapping

The exact normalization of tick_type into outside / inside volume should be verified in runtime samples.

18.3 Restart Recovery

If worker restarts mid-session, should it rebuild from Redis latest or simply continue from fresh stream events?

19. Final Summary

quote_worker is a dedicated quote-based feature worker for one configured futures instrument.

It extends the existing stream-processing architecture by adding:

quote ingestion
quote Redis stream
quote consumer group
quote-based 1-second aggregation
Redis latest + intraday series
minute DB snapshots

In phase 1, it only computes:

main_chip
long_short_force

and maintains day high / low / strength for both.
```
