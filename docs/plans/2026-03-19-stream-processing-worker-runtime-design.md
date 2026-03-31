# Stream Processing Worker Runtime Design (Standalone)

Date: 2026-03-19  
Owner: Backend

## 1. Context

`StreamProcessingRunner` is currently started from FastAPI startup via `asyncio.create_task(...)`.
When enabled in the API process, synchronous Redis/DB calls inside the runner can increase API latency.

This design introduces a dedicated worker runtime for stream processing, independent from the existing `batch_shared` queue runtime.

## 2. Goals

- Run stream processing in a separate process from API workers.
- Keep current stream-processing domain logic (`StreamProcessingRunner`) reusable with minimal modification.
- Provide clear lifecycle hooks: bootstrap, run, graceful shutdown, restart policy.
- Preserve current Redis Stream consumer-group semantics and at-least-once behavior.

## 3. Non-Goals

- Reusing `batch_shared` job queue runtime (`QueueWorkerRuntime`) for stream processing.
- Migrating stream processing to Celery/RQ.
- Redesigning aggregation algorithms (KBar state machine, bidask metrics) in this change.

## 4. Why Not Reuse `batch_shared` Runtime

`batch_shared` runtime is queue-job oriented:

- Input model: `BRPOP queue:batch:{worker_type}` -> `job_id`
- Execution model: finite `run_existing_job(job_id)` with status transitions in `batch_jobs`
- Lifecycle model: job lifecycle (`CREATED/RUNNING/RETRYING/COMPLETED/FAILED`)

`StreamProcessingRunner` is a continuous stream consumer:

- Input model: Redis Streams + consumer groups (`XREADGROUP`, `XAUTOCLAIM`)
- Execution model: infinite event loop with periodic polling and sampling
- Lifecycle model: process lifecycle, not per-job lifecycle

Therefore, sharing runtime would create mismatched semantics and unnecessary coupling.

## 5. Proposed Architecture

### 5.1 New Dedicated Worker Entrypoint

Add a new process entrypoint:

- `apps/backend/workers/stream_processing_worker.py`

Responsibilities:

- Load config
- Build standalone runtime
- Start runner and block until shutdown signal
- Perform graceful stop on SIGTERM/SIGINT

### 5.2 New Runtime Wrapper

Add runtime wrapper module:

- `apps/backend/app/stream_processing/worker_runtime.py`

Responsibilities:

- Construct Redis client and `StreamProcessingRunner`
- Encapsulate `start()`, `run_forever()`, and `stop()`
- Handle signal-safe shutdown coordination
- Expose minimal health metadata (last loop tick, stop state, fatal error)

### 5.3 API Process Boundary

API service must not own stream-processing runtime.

- `app.main` should not start aggregator background task for API deployment mode.
- Aggregator starts only in `stream_processing_worker` process.

## 6. Runtime Lifecycle

### 6.1 Bootstrap

1. Load env/config (`REDIS_URL`, aggregator consumer/group settings, code/env, ttl).
2. Initialize logging and metrics registry.
3. Build `StreamProcessingRunner`.
4. Ensure consumer groups and initial stream discovery.

### 6.2 Run

1. `await runner.start()`
2. Keep process alive with supervision loop (sleep heartbeat + fatal error checks).
3. Track health counters:
- processed message rate
- write errors
- stream lag
- last successful consume timestamp

### 6.3 Graceful Shutdown

1. Catch SIGTERM/SIGINT.
2. Set runtime stop flag.
3. `await runner.stop_async()` with timeout budget.
4. Flush final logs/metrics and exit non-zero only on fatal stop failure.

## 7. Failure and Recovery Strategy

- Message-level failures: keep current behavior (`no ACK` on processing failure) to allow retry via pending reclaim.
- Process-level failures: rely on container restart policy (`restart: unless-stopped` or equivalent).
- Redis transient failures: retain current retry/backoff behavior in runner and log error counters.

## 8. Configuration Model

Use existing aggregator settings as-is:

- `AGGREGATOR_ENV`
- `AGGREGATOR_CODE`
- `AGGREGATOR_TICK_GROUP`
- `AGGREGATOR_BIDASK_GROUP`
- `AGGREGATOR_TICK_CONSUMER`
- `AGGREGATOR_BIDASK_CONSUMER`
- `AGGREGATOR_READ_COUNT`
- `AGGREGATOR_BLOCK_MS`
- `AGGREGATOR_CLAIM_IDLE_MS`
- `AGGREGATOR_CLAIM_COUNT`
- `AGGREGATOR_STATE_TTL_SECONDS`
- `AGGREGATOR_SERIES_FIELDS`

Deployment contract:

- API container: `AGGREGATOR_ENABLED=false`
- Stream worker container: start `python -m workers.stream_processing_worker`

## 9. Deployment Shape (Docker)

Define separate services:

- `backend-api`: serves HTTP only
- `backend-stream-worker`: runs stream processing only

Both may share image/build but use different commands and env toggles.

## 10. Observability

Keep existing metrics and add worker-process level metadata:

- `stream_worker_up` (gauge)
- `stream_worker_last_tick_ts` (gauge)
- `stream_worker_fatal_errors_total` (counter)

Log requirements:

- startup config summary (without secrets)
- signal received + shutdown duration
- fatal exception with stack trace and exit code

## 11. Test Plan

### Unit

- Runtime bootstrap builds runner with expected config.
- Signal handling triggers graceful stop path.
- Fatal exception path sets failure state and returns non-zero.

### Integration

- Worker process consumes stream and writes Redis state/Postgres as before.
- API latency remains stable when worker runs as separate process.
- Restart worker and verify pending reclaim continues processing.

## 12. Migration Plan

1. Add standalone worker runtime and entrypoint.
2. Update deployment manifests/compose with new worker service.
3. Disable aggregator startup in API service mode.
4. Run integration and non-functional latency checks.
5. Roll out to staging, then production.

## 13. Acceptance Criteria

- Stream processing no longer runs inside API process in normal deployment.
- Existing stream-to-state outputs remain unchanged.
- API p95 latency no longer regresses when aggregator is enabled in deployment.
- Worker can be independently restarted without API interruption.
