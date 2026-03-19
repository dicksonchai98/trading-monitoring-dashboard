# Stream Worker Minimal Go-Live Design

Date: 2026-03-19  
Owner: Backend

## 1. Goal

Split stream aggregator out of API process into a dedicated worker service for docker-compose deployment, with minimal risk and minimal code churn.

Primary objective:
- Remove aggregator workload from API event loop/process.
- Keep existing stream-processing behavior unchanged.
- Reach production-safe baseline before adding control-plane APIs.

## 2. Scope

In scope:
- New standalone stream worker entrypoint.
- Runtime wrapper for worker lifecycle management.
- Docker compose split: `backend-api` and `backend-stream-worker`.
- API mode disables aggregator startup.
- Minimal worker health metadata and logs.

Out of scope:
- Control plane API (`reload/pause/resume/config/status`).
- Redesign of aggregation algorithms or schema.
- Refactor to generic unified runtime across queue jobs and stream jobs.

## 3. Architecture (Minimal Version)

### 3.1 Process Boundary

- `backend-api`: HTTP only.
- `backend-stream-worker`: stream processing only.

Aggregator must no longer start in API startup path.

### 3.2 New Modules

- `apps/backend/workers/stream_processing_worker.py`
  - Parse config/env.
  - Build runtime.
  - Start runtime and block.
  - Handle SIGTERM/SIGINT.

- `apps/backend/app/stream_processing/worker_runtime.py`
  - Build `StreamProcessingRunner`.
  - Provide `start()`, `run_forever()`, `stop()`.
  - Maintain runtime flags:
    - `up`
    - `last_tick_ts`
    - `fatal_error`

## 4. Lifecycle Contract

### 4.1 Startup

1. Load env/config.
2. Initialize logging/metrics.
3. Build `StreamProcessingRunner`.
4. `await runner.start()`.
5. Mark runtime healthy (`up=1`).

### 4.2 Run

- Keep supervision loop alive with heartbeat update (`last_tick_ts`).
- Observe fatal errors and fail fast when unrecoverable.

### 4.3 Graceful Shutdown

1. Receive SIGTERM/SIGINT.
2. Set stop flag.
3. `await runner.stop_async()` with timeout budget.
4. Flush logs and exit:
   - `0` on clean stop
   - non-zero on fatal stop failure/timeout

## 5. Reliability Rules

- Keep current at-least-once semantics.
- Message-level failure: keep no-ACK behavior for retry/reclaim path.
- Process-level failure: rely on compose/container restart policy.
- Do not change checkpoint and pending reclaim behavior in this phase.

## 6. Docker Compose Contract

Required services:
- `backend-api`
- `backend-stream-worker`
- `redis` (and existing DB service if already required)

Configuration rules:
- API container: `AGGREGATOR_ENABLED=false`
- Worker container: run `python -m workers.stream_processing_worker`
- Prevent dual-run in same environment (API and worker must not both run aggregator)

## 7. Health and Observability (Minimal)

### 7.1 Health Separation

- API health checks API only.
- Worker health checks worker loop only.

Do not use API endpoint health to represent worker status.

### 7.2 Worker Minimal Metrics

- `stream_worker_up` (gauge)
- `stream_worker_last_tick_ts` (gauge)
- `stream_worker_fatal_errors_total` (counter)

### 7.3 Required Logs

- startup config summary (no secrets)
- signal reception and shutdown duration
- fatal exception stack trace and exit code

## 8. Acceptance Criteria

1. API startup does not create aggregator task.
2. Stream worker independently consumes stream and writes the same outputs as before.
3. Stopping worker does not impact API availability.
4. Restarting worker resumes processing via existing checkpoint/reclaim behavior.
5. API p95 latency no longer regresses due to in-process aggregator execution.

## 9. Minimal Test Plan

### Unit

- Runtime bootstrap builds runner with expected config.
- Signal handling triggers graceful stop path.
- Fatal exception path returns non-zero exit status.

### Integration

- Two-service compose topology still produces correct stream outputs.
- Worker restart continues pending reclaim path.
- API remains healthy while worker is down/restarting.

### Smoke (Manual)

- `docker compose up` shows independent health for API and worker.
- Kill worker process and verify API still serves requests.
- Restart worker and confirm stream output resumes.

## 10. Rollout Sequence

1. Add worker entrypoint + runtime wrapper.
2. Update compose with dedicated worker service.
3. Disable API-side aggregator startup.
4. Run unit/integration/smoke checks.
5. Deploy to staging before production.
