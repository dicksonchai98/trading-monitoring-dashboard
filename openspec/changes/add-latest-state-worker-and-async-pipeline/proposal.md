## Why

Current stream processing couples Tick and BidAsk workloads in a shared loop with synchronous Redis/DB operations, causing fairness issues, delayed ACK, and high latency under load. We need to isolate responsibilities and move blocking paths to asynchronous workers so the system can safely support 150-symbol spot latest-state updates and more stable persistence behavior.

## What Changes

- Add a dedicated `latest-state-worker` optimized for low-latency spot (about 150 symbols) state updates (`last/high/low/new-high/new-low`) with batched Redis flush.
- Split the current combined processing into independent `tick-worker` and `bidask-worker` processes to isolate contention and backpressure.
- Move Tick and BidAsk historical writes out of main consume loops into separate async sink workers (`tick-db-sink`, `bidask-db-sink`).
- Add BidAsk historical persistence path in PostgreSQL (new table/model and write flow), in addition to existing Tick persistence.
- Refactor blocking code paths (Redis/DB and other synchronous hotspots) to asynchronous implementations or controlled async wrappers (`asyncio.to_thread`/executor as intermediate).
- Clarify ACK semantics so main workers ACK after critical state update + successful sink handoff, without waiting for final DB commit.
- Reuse existing spot ingestion capability and stream contract as an upstream dependency for latest-state processing.

## Capabilities

### New Capabilities

- `stream-worker-separation-and-async-ack`: Define independent Tick/BidAsk workers, async critical-path behavior, and ACK/handoff contracts.
- `latest-state-worker-spot150`: Define latest-state processing for ~150 spot symbols, dirty-state batching, Redis flush semantics, and frontend-facing freshness behavior.
- `stream-db-sink-persistence`: Define decoupled Tick/BidAsk DB sink workers, retry/dead-letter handling, and BidAsk historical persistence requirements.

### Modified Capabilities

- `stream-processing-aggregator`: Update ACK and persistence requirements from inline Postgres writes to sink-handoff semantics and split-worker operation.

## Impact

- Backend modules: Tick/BidAsk stream processors, worker runtime/process management, ACK/retry handling.
- Data layer: Redis Streams/state keys, new persistence queue/sink paths, PostgreSQL schema additions for BidAsk history.
- Infra/runtime: service topology expands to five worker services with independent scaling and health checks.
- Observability: new metrics/log fields for worker lag, pending/retry growth, and latest-state flush failures.
