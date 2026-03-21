# Stream Worker Service Design

## 1. Overview

The Stream Worker Service is a long-running background service that continuously consumes events from Redis Streams, performs real-time stream processing, and writes derived state to Redis and/or a database.

Typical use cases include:

- Aggregating tick data into 1-minute candles
- Computing technical indicators
- Maintaining latest market state
- Persisting historical aggregates

This service is **not** an API-triggered batch job. It is a **continuously running stream processor**.

---

## 2. Goals

- Decouple stream processing from the API server
- Prevent stream workloads from affecting API latency
- Support continuous real-time processing
- Provide operational visibility and control
- Support restart and recovery through checkpoints

---

## 3. Non-Goals

- Ad hoc batch job execution
- User-facing request processing
- Complex workflow orchestration
- Distributed stream processing in the first phase

---

## 4. Architecture

```text
                +----------------------+
                |      API Server      |
                |    (Control Plane)   |
                +----------+-----------+
                           |
                           | read/update config
                           | query status
                           |
                           v
                +----------------------+
                | Config / Status Store|
                +----------+-----------+
                           |
                           |
                           v
+--------------------------------------------------+
|           Stream Worker Service                  |
|--------------------------------------------------|
| Stream Consumer                                  |
| Event Normalizer                                 |
| Window Aggregator                                |
| Indicator Engine                                 |
| State Writer                                     |
| Checkpoint Manager                               |
| Health Reporter                                  |
+-------------------+------------------------------+
                    |
          +---------+---------+
          |                   |
          v                   v
   +-------------+     +--------------+
   | Redis Stream|     | Redis / DB   |
   | Input Source|     | Output Store |
   +-------------+     +--------------+
5. Responsibilities
5.1 API Server (Control Plane)

The API server does not process stream data directly. Its responsibilities are:

Manage worker configuration

Expose worker status

Provide health and monitoring endpoints

Trigger config reload / pause / resume actions

5.2 Stream Worker (Data Plane)

The worker service is responsible for:

Continuously consuming Redis Stream events

Normalizing input events

Aggregating ticks into time windows

Computing indicators

Writing latest state and historical outputs

Tracking checkpoints for recovery

Reporting runtime health and metrics

6. Processing Flow

The worker starts and loads configuration

The worker restores checkpoint state

The worker begins consuming Redis Stream events

Each event is normalized

Events are routed into aggregation windows

Completed windows emit candles

Indicators are computed from finalized candles

Outputs are written to Redis state and/or database

Checkpoint is updated

The message is acknowledged

7. Core Components
7.1 Stream Consumer

Consumes messages from Redis Streams or Redis Stream consumer groups.

7.2 Event Normalizer

Converts raw input events into a standard internal event format.

7.3 Window Aggregator

Maintains in-memory per-symbol/per-timeframe state and produces OHLCV candles.

7.4 Indicator Engine

Computes technical indicators such as EMA, RSI, or MACD from candle streams.

7.5 State Writer

Writes:

latest state to Redis

historical records to database

7.6 Checkpoint Manager

Stores the last successfully processed stream position for restart recovery.

7.7 Health Reporter

Publishes runtime status such as heartbeat, lag, throughput, and errors.

8. Runtime State Model

The worker should expose a service-level status model instead of a batch-job model.

Suggested states:

STARTING

RUNNING

DEGRADED

PAUSED

STOPPING

STOPPED

FAILED

9. Configuration

Example configuration fields:

input stream key

consumer group

enabled symbols

enabled timeframes

indicator settings

Redis output prefix

database write enabled flag

checkpoint mode

reload version

Configuration is managed by the control plane and loaded by the worker at startup and reload time.

10. Checkpoint and Recovery

The worker must persist checkpoint metadata to allow restart recovery.

Minimum checkpoint data:

last processed stream ID

last processed event timestamp

last flush timestamp

Recovery strategy:

Read persisted checkpoint

Resume consumption from the checkpoint

Rebuild in-memory partial window state if needed

Continue processing

11. Output Model
11.1 Redis Output

Used for low-latency latest state, for example:

latest 1-minute candle

latest indicators

latest trading signals

11.2 Database Output

Used for durable historical storage, for example:

candle history

indicator history

audit data

Database writes should support idempotent upsert when possible.

12. Failure Handling
12.1 Redis Read Failure

retry with backoff

mark worker as DEGRADED

12.2 Invalid Event

log the error

increment error metrics

optionally route to quarantine

continue processing

12.3 Output Write Failure

retry when appropriate

avoid acknowledging the message before critical writes succeed

12.4 Process Crash

restart via process manager / container platform

recover from checkpoint

13. Observability

The worker should provide:

Logs

Structured logs with fields such as:

processor name

instance ID

symbol

timeframe

stream ID

checkpoint

error type

Metrics

At minimum:

events processed

candles emitted

indicators computed

processing latency

stream lag

write latency

error count

heartbeat timestamp

Health Endpoints

/health

/ready

/metrics

14. Deployment Model

The Stream Worker Service should run as a separate process or container from the API server.

Recommended deployment model:

api-service

stream-worker-service

redis

optional database

This separation ensures that stream processing does not affect API request handling.

15. Scaling Strategy
Phase 1

Single worker instance for all symbols.

Phase 2

Shard by symbol or market group.

Phase 3

Split the pipeline into specialized services if needed, such as:

candle aggregator

indicator processor

signal engine

16. Summary

The Stream Worker Service is a dedicated long-running processor for real-time Redis Stream consumption and stateful market data processing.

Key design principles:

separate control plane from data plane

keep API and stream processing isolated

persist checkpoints for recovery

maintain service-level status and observability

support future scaling without coupling to request lifecycle