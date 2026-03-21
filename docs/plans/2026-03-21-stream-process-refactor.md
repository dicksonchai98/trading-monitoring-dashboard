# Stream Processing Refactor Design

## 1. Overview

This design proposes a refactor of the current stream processing architecture to improve isolation, fairness, scalability, and write-path reliability.

The refactor includes:

1. Add a new **Latest State Worker** for 150 spot symbols
2. Separate database writes from the current Tick/BidAsk processing path
3. Split Tick and BidAsk into independent workers
4. Refactor blocking paths into asynchronous processing
5. Add database persistence for BidAsk, in addition to the existing Tick persistence

---

## 2. Goals

- Prevent Tick and BidAsk workloads from blocking each other
- Keep low-latency latest-state updates independent from heavy historical persistence
- Support 150-symbol spot latest-state processing without overloading the main processing workers
- Improve event loop fairness and eliminate synchronous blocking from critical paths
- Add durable persistence for BidAsk outputs
- Maintain clear ACK semantics and recovery behavior

---

## 3. Non-Goals

- Full distributed scheduling across all future strategies
- Replacing Redis Streams with a different messaging system
- Rewriting all business logic at once
- Building a full orchestration platform in the first phase

---

## 4. Current Problems

### 4.1 Shared Event Loop Contention

Tick and BidAsk loops currently run in the same asyncio event loop, while core Redis and DB operations are synchronous. This causes scheduling starvation and observable delays.

### 4.2 Blocking Database Writes

Tick persistence currently commits to Postgres in the main processing path. This increases per-message latency and delays ACK.

### 4.3 Mixed Responsibilities

The current service mixes:

- stream consumption
- state computation
- Redis updates
- historical persistence
- ACK handling

This makes the critical path too heavy.

### 4.4 No Dedicated Latest-State Path

The 150-symbol spot use case only needs lightweight latest price / high / low state, but currently there is no dedicated low-latency worker for this purpose.

---

## 5. Target Architecture

```text
                         +----------------------+
                         |     API Server       |
                         |  (Control Plane)     |
                         +----------+-----------+
                                    |
                                    | config / status / health
                                    |
        +---------------------------+----------------------------+
        |                            |                           |
        v                            v                           v

+-------------------+     +-------------------+      +------------------------+
|  Tick Worker      |     |  BidAsk Worker    |      | Latest State Worker    |
|-------------------|     |-------------------|      |------------------------|
| consume tick      |     | consume bidask    |      | consume spot streams   |
| aggregate kbar    |     | compute metrics   |      | update latest state    |
| write Redis state |     | write Redis state |      | detect new high/low    |
| enqueue DB sink   |     | enqueue DB sink   |      | write Redis latest     |
| ACK after success |     | ACK after success |      | optional push to FE    |
+---------+---------+     +---------+---------+      +-----------+------------+
          |                           |                            |
          |                           |                            |
          v                           v                            v
    +---------------------------------------------------------------+
    |                      Redis Streams / Redis State              |
    +---------------------------------------------------------------+
                          |                            |
                          |                            |
                          v                            v
               +--------------------+      +----------------------+
               | Tick DB Sink       |      | BidAsk DB Sink       |
               |--------------------|      |----------------------|
               | batch insert/upsert|      | batch insert/upsert  |
               | async persistence  |      | async persistence    |
               +--------------------+      +----------------------+
                          |                            |
                          +------------+---------------+
                                       |
                                       v
                               +---------------+
                               |  PostgreSQL   |
                               +---------------+
6. High-Level Design
6.1 Tick Worker

Responsible for:

consuming Tick Redis Streams
maintaining current K-bar state
writing Redis current and sequence state
enqueueing persistence payloads to Tick DB Sink
ACK only after critical in-memory/Redis updates succeed
6.2 BidAsk Worker

Responsible for:

consuming BidAsk Redis Streams
computing latest BidAsk metrics
writing Redis latest and sequence state
enqueueing persistence payloads to BidAsk DB Sink
ACK only after critical Redis state updates succeed
6.3 Latest State Worker

Responsible for:

consuming 150-symbol spot stream data
maintaining in-memory latest state per symbol
calculating:
last price
session high
session low
new high flag
new low flag
flushing dirty symbol state to Redis in batches
optionally emitting frontend update events

This worker is optimized for low-latency latest-state updates and should not depend on synchronous DB writes.

6.4 Tick DB Sink

Responsible for:

consuming persistence tasks from Tick Worker
batching and writing Tick/KBar historical data to PostgreSQL
retrying failed writes
decoupling DB latency from Tick stream consumption
6.5 BidAsk DB Sink

Responsible for:

consuming persistence tasks from BidAsk Worker
batching and writing BidAsk historical metrics to PostgreSQL
retrying failed writes
decoupling DB latency from BidAsk stream consumption
7. Worker Separation Strategy
7.1 Independent Tick and BidAsk Workers

Tick and BidAsk must run in separate worker processes.

Reason:

isolate backpressure
isolate event loop contention
allow independent tuning
reduce failure blast radius
support different throughput and persistence characteristics
7.2 Dedicated Latest State Worker

The 150-symbol spot latest-state workload should not be mixed into the Tick/BidAsk heavy pipeline.

Reason:

it is low-complexity, high-frequency, low-latency work
it should not be delayed by KBar persistence or metrics history writes
frontend-facing state should have a shorter critical path
8. Async Refactor Strategy
8.1 Remove Blocking Operations from Main Loop

The main consumption loops must not perform blocking Redis or database operations directly in the shared event loop thread.

8.2 Redis Access

Refactor Redis access to async Redis clients where feasible.

If a full migration is not possible immediately, wrap synchronous Redis calls behind:

asyncio.to_thread, or
thread pool execution

This is an intermediate step, not the final target state.

8.3 Database Writes

Database writes must be moved out of the main Tick/BidAsk consumption loops.

Recommended approach:

enqueue persistence jobs into internal async queues or Redis-backed sink streams
separate DB Sink workers perform batch insert/upsert and commit
8.4 Fairness

Each processing loop should explicitly yield control after each iteration, even when messages were processed.

Example principle:

do not only yield when processed == 0
always allow cooperative scheduling
9. ACK Semantics
9.1 Tick Worker

Tick messages are ACKed only after:

Tick processing succeeds
Redis current/sequence state write succeeds
persistence payload is successfully handed off to Tick DB Sink queue

Tick messages should not wait for final PostgreSQL commit in the main worker.

9.2 BidAsk Worker

BidAsk messages are ACKed only after:

BidAsk metrics processing succeeds
Redis latest/sequence state write succeeds
persistence payload is successfully handed off to BidAsk DB Sink queue
9.3 Latest State Worker

Latest State Worker is optimized for frontend-facing state and can use lighter semantics depending on stream guarantees.

Recommended behavior:

update in-memory state first
batch flush to Redis
no synchronous database dependency on the critical path
10. Latest State Worker Design
10.1 Input
spot market stream data for ~150 symbols
10.2 State Model

Per symbol:

{
  "symbol": "2330",
  "last_price": 612.0,
  "session_high": 615.0,
  "session_low": 601.0,
  "is_new_high": false,
  "is_new_low": false,
  "updated_at": "2026-03-21T09:01:02Z"
}
10.3 Processing Model

For each incoming event:

update in-memory symbol state
mark symbol as dirty
if new high/low occurs, optionally emit an immediate frontend event
10.4 Redis Write Strategy

Do not write all 150 symbols on every tick.

Use:

in-memory state
dirty symbol tracking
periodic batched Redis flush
Redis pipelining
10.5 Frontend Path

Preferred frontend path:

Redis latest state lookup via API, or
websocket/pubsub fanout for changed symbols

Database persistence is optional and must not block this path.

11. Database Design
11.1 Tick Historical Table

Existing KBar persistence remains, but moves behind Tick DB Sink.

Example table:

kbar_1m
11.2 BidAsk Historical Table

A new historical table is added for BidAsk metrics.

Example table:

bidask_metrics_1s
- symbol
- event_ts
- bid_price
- ask_price
- spread
- mid_price
- metric_payload
- created_at

Final schema may vary depending on the current BidAsk metric model.

11.3 Write Pattern

Use:

batch insert
upsert when necessary
bounded retries
dead-letter or quarantine handling for unrecoverable failures
12. Component Breakdown
12.1 Tick Worker

Modules:

stream consumer
tick handler
kbar aggregator
Redis writer
persistence queue publisher
ACK manager
12.2 BidAsk Worker

Modules:

stream consumer
bidask handler
metric calculator
Redis writer
persistence queue publisher
ACK manager
12.3 Latest State Worker

Modules:

spot stream consumer
latest-state updater
dirty symbol tracker
Redis batch flusher
optional frontend notifier
12.4 DB Sink Workers

Modules:

queue consumer
batch builder
DB writer
retry handler
metrics reporter
13. Failure Handling
13.1 Tick/BidAsk Main Workers

If Redis state write fails:

do not ACK
let the message remain pending for reclaim/retry

If DB handoff fails:

do not ACK
retry handoff or leave pending
13.2 DB Sink Workers

If PostgreSQL write fails:

retry with backoff
keep the sink payload pending
move to dead-letter handling after retry exhaustion
13.3 Latest State Worker

If Redis flush fails:

retain dirty symbols in memory
retry in the next flush interval
optionally degrade frontend push behavior
14. Observability

Each worker should expose:

14.1 Metrics
messages processed
ACK count
pending count
reclaim count
Redis write latency
DB handoff latency
DB sink batch size
DB sink write latency
error count
retry count
latest-state dirty symbol count
14.2 Logs

Structured logs with:

worker type
instance id
stream key
symbol
stream id
error type
ack decision
persistence queue status
14.3 Health Endpoints
/health
/ready
/metrics
15. Deployment Model

Recommended services:

tick-worker
bidask-worker
latest-state-worker
tick-db-sink
bidask-db-sink

This deployment model ensures:

independent scaling
independent restart
isolated backpressure
isolated event loops
16. Rollout Plan
Phase 0
extend `market_ingestion` to support spot symbol ingestion
add spot stream schema validation, registry loading, and ingestion observability baseline
Phase 1
split Tick and BidAsk into independent workers
add explicit fairness yielding
reduce synchronous blocking in the current path
Phase 2
add Tick DB Sink
move Tick Postgres writes out of the main Tick loop
Phase 3
add BidAsk DB Sink
add BidAsk historical persistence
Phase 4
introduce Latest State Worker for 150 spot symbols
implement in-memory state + dirty flush + Redis pipeline
Phase 5
migrate Redis and supporting clients to async implementations
fully remove blocking I/O from main worker loops

18. Market Ingestion Extension for Spot
18.1 Scope

`market_ingestion` is extended from futures-only ingestion to dual ingestion for futures + spot (~150 symbols).
futures and spot share ingestion process lifecycle but must isolate queue, publish path, and observability.

18.2 Symbol Registry

Spot symbol list is loaded from a static config file.
recommended default path:
- `infra/config/stock150.txt`

recommended runtime config:
- `INGESTOR_SPOT_SYMBOLS_FILE` (default: `infra/config/stock150.txt`)
- `INGESTOR_SPOT_SYMBOLS_EXPECTED_COUNT` (default: `150`, can be overridden for staged rollout)

startup validation must enforce:
- non-empty symbol list
- no duplicates
- valid symbol code format
- expected symbol count range

Failure mode policy:
- if spot ingestion is required: fail fast on invalid configuration
- if spot ingestion is optional: disable spot path and continue futures ingestion

recommended symbol file format:
- UTF-8 text file
- one symbol per line
- allow blank lines and `#` comment lines
- symbol regex: `^\d{4}$`
- in strict mode, valid symbol count must equal `INGESTOR_SPOT_SYMBOLS_EXPECTED_COUNT`

18.3 Stream Contract

Spot event minimum fields:
- `symbol` (string)
- `event_ts` (ISO8601 UTC)
- `last_price` (number)
- `source` (string)
- `ingest_seq` (per-symbol monotonic integer)

Recommended stream naming:
- `{env}:stream:spot:{symbol}`

`ingest_seq` is the ordering and idempotency anchor within each symbol.

18.4 Isolation and Backpressure

Ingestion runtime must maintain separate internal queues and publishers for futures vs spot.
spot overload must not consume futures critical capacity.
spot publish failure must not block futures publish path.

18.5 Observability

Add spot ingestion metrics:
- `ingestion_spot_events_total`
- `ingestion_spot_queue_depth`
- `ingestion_spot_publish_errors_total`
- `ingestion_spot_lag_ms`

Structured logs should include:
- `asset_type` (`futures` / `spot`)
- `symbol`
- `stream_key`
- `ingest_seq`
- `error_type`

18.6 Latest State Worker ACK Semantics Addendum

Spot message is ACKed only after:
- message parse/validation succeeds
- in-memory latest-state update succeeds
- Redis flush succeeds, or persistence task is successfully enqueued to flush queue

If Redis flush fails:
- do not ACK
- keep pending for reclaim/retry

Idempotency requirement:
- replay of same `symbol + ingest_seq` must not regress state.

18.7 Observability Alert Thresholds Addendum

Define explicit alert thresholds for:
- Redis pending count and consumer lag
- DB sink retry growth
- spot ingestion queue depth
- latest-state flush failure ratio

During cutover, maintain a dedicated first-hour dashboard and escalation policy.

19. One-shot Cutover and Rollback
19.1 Cutover Preconditions

Before cutover:
- all new workers must pass `/health` and `/ready`
- spot ingestion and latest-state metrics must be within thresholds
- rollback commands/configuration must be pre-validated

19.2 Cutover Steps

1. start new `market_ingestion` with futures + spot enabled
2. start `tick-worker`, `bidask-worker`, `latest-state-worker`, `tick-db-sink`, `bidask-db-sink`
3. switch API/frontend latest-state reads to new keys/path
4. stop legacy processing path

19.3 Rollback Strategy

Rollback triggers (any):
- sustained elevated error rate
- continuously growing Redis pending backlog
- latest-state lag beyond threshold without recovery

Rollback order:
1. stop new write path
2. restore legacy consumer/processing path
3. validate health, lag, and state freshness

19.4 Recovery SLO

Target:
- rollback recovery `RTO <= 10 minutes`
- latest-state freshness restored within 5 minutes after rollback

20. Summary

This refactor separates the current stream processing responsibilities into dedicated worker types:

Tick Worker for KBar-oriented processing
BidAsk Worker for metrics-oriented processing
Latest State Worker for 150-symbol low-latency frontend state
Tick DB Sink for asynchronous Tick persistence
BidAsk DB Sink for asynchronous BidAsk persistence

Key design principles:

separate heavy historical persistence from the critical stream path
isolate Tick and BidAsk execution
add a dedicated low-latency latest-state path
move blocking I/O out of the main event loop
preserve clear ACK and recovery semantics
