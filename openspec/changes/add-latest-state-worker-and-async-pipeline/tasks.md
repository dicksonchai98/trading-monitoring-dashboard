## 1. Worker Boundary and Runtime Split

- [x] 1.1 Refactor stream processing runtime to run Tick and BidAsk pipelines as independently deployable workers with isolated startup flags and health reporting.
- [x] 1.2 Move shared loop control utilities into reusable worker lifecycle helpers so each worker can run, stop, and recover independently.
- [x] 1.3 Add runtime configuration and service wiring for `tick-worker` and `bidask-worker` in deployment manifests/scripts.

## 2. Tick/BidAsk ACK Contract Refactor

- [x] 2.1 Update Tick processing ACK flow to require successful parse/process, Redis state write, and sink handoff (without waiting for DB commit).
- [x] 2.2 Update BidAsk processing ACK flow to require successful parse/process, Redis state write, and sink handoff.
- [x] 2.3 Ensure Redis write failure or sink handoff failure leaves message pending for reclaim/retry and emits structured error metrics/logs.
- [x] 2.4 Add explicit cooperative scheduling yield in processing loops for fairness under sustained throughput.

## 3. DB Sink Persistence Pipeline

- [x] 3.1 Finalize `tick-db-sink` consumption and batch persistence path with bounded retry/backoff and error metrics.
- [x] 3.2 Finalize `bidask-db-sink` consumption and batch persistence path with bounded retry/backoff and error metrics.
- [x] 3.3 Add/adjust BidAsk historical persistence schema and repository logic for queryable symbol + event timestamp records.
- [x] 3.4 Add dead-letter/quarantine handling path for sink payloads that exceed retry limits.

## 4. Latest-State Worker for Spot150

- [x] 4.1 Implement dedicated `latest-state-worker` that consumes canonical spot streams (`{env}:stream:spot:{symbol}`) and maintains per-symbol in-memory state.
- [x] 4.2 Implement dirty-symbol tracking and batched Redis pipeline flush so only changed symbols are written each interval.
- [x] 4.3 Implement idempotency/ordering checks using `symbol + ingest_seq` to prevent stale replay from regressing state.
- [x] 4.4 Implement latest-state ACK behavior to require successful validation, in-memory update, and successful flush-path handoff.
- [x] 4.5 Add optional immediate notification hook for new-high/new-low transitions without blocking main state updates.

## 5. Async and Blocking-Path Elimination

- [x] 5.1 Inventory sync Redis/DB calls on Tick/BidAsk critical loops and migrate to async clients where feasible.
- [x] 5.2 Wrap remaining unavoidable sync operations with bounded executor/to-thread adapters and latency instrumentation.
- [x] 5.3 Add blocking-path latency metrics and alert thresholds to detect residual loop stalls during rollout.

## 6. Testing and Verification

- [x] 6.1 Add/refresh unit tests for ACK decision logic, sink handoff failure behavior, and latest-state idempotency.
- [x] 6.2 Add integration tests for end-to-end flow: stream consume -> Redis state -> sink handoff -> sink persistence for Tick and BidAsk.
- [x] 6.3 Add integration tests for latest-state worker dirty flush behavior and replay safety with duplicate/out-of-order `ingest_seq`.
- [x] 6.4 Add non-functional tests for fairness/throughput under mixed Tick/BidAsk load and sink backpressure.
- [ ] 6.5 Validate cutover and rollback runbook in staging, including health/readiness checks and lag/error SLO gates.

## 7. Spec and Rollout Alignment

- [x] 7.1 Add delta spec updates to reconcile existing `stream-processing-aggregator` ACK semantics with sink-handoff architecture.
- [x] 7.2 Update operations documentation for new worker topology (`tick-worker`, `bidask-worker`, `latest-state-worker`, `tick-db-sink`, `bidask-db-sink`) and incident response playbooks.
