## Context

Historical backfill and market crawler run as separate batch workers but share a common execution
model. Both need consistent job lifecycle management, retries, progress reporting, structured
logging, configuration loading, and DB helper utilities. These concerns are duplicated today, which
increases maintenance cost and causes behavioral drift. The shared batch infrastructure document
(`docs/plans/2026-03-08-batch-shared-infrastructure-design.md`) defines the desired common runtime.
The TRD (`docs/plans/2026-03-08-batch-shared-infrastructure-trd.md`) specifies concrete module
layout, job tracking schema, and runtime behavior to implement.

## Goals / Non-Goals

**Goals:**
- Provide a shared batch runtime layer used by backfill and crawler workers.
- Standardize job lifecycle states, retry behavior, progress tracking, and logging.
- Centralize configuration and DB helper utilities for batch jobs.
- Keep domain-specific pipeline logic in each service module.
- Implement the concrete module structure and worker startup flow defined in the TRD.
- Provide a shared job tracking table and repository interface.
- Expose batch metrics required for observability.

**Non-Goals:**
- Rewriting or altering the domain-specific fetch/transform logic for backfill or crawler.
- Introducing new external dependencies beyond the existing stack.
- Changing realtime ingestion paths or SSE behavior.

## Decisions

- **Shared runtime module (recommended architecture):** Create a `batch_runtime` package that
  provides job runner, retry policy, progress tracking, logging, config loading, and DB helpers.
  This keeps lifecycle/infra code centralized while preserving service isolation.
  - **Alternative considered:** Base-class inheritance for jobs. Rejected due to tight coupling and
    reduced composability across worker types.
  - **Alternative considered:** Share only low-level utilities. Rejected because lifecycle/retry
    logic would remain duplicated and drift.

- **Service isolation preserved:** Each worker remains a separate process (backfill-worker,
  crawler-worker). The runtime is a shared library, not a shared process.

- **Idempotent DB writes:** Use upsert semantics in shared DB helpers so reruns and retries do not
  corrupt data. This aligns with shared infrastructure principles.

- **Concrete module layout:** Implement shared code under `backend/modules/batch_shared/` with
  submodules: `config/`, `runtime/`, `jobs/`, `retry/`, `logging/`, `metrics/`, `database/`,
  `repositories/`. This matches the TRD and keeps the runtime cohesive.

- **Worker startup flow:** Each worker entrypoint loads config, initializes logging and DB session,
  registers job implementations, and starts the worker loop. Entry points remain
  `workers/backfill_worker.py` and `workers/crawler_worker.py`.

- **Job tracking persistence:** Use a `batch_jobs` table with fields and indexes defined in the TRD.
  The JobRunner uses `JobRepository` methods (`create_job`, `mark_running`, `mark_completed`,
  `mark_failed`, `update_progress`).

- **Metrics surface:** Emit `batch_job_duration_seconds`, `batch_job_failures_total`,
  `batch_rows_processed_total`, `batch_retry_count_total` from the shared runtime.

- **Job runner execution flow:** The job runner creates the job record, marks RUNNING, executes the
  job implementation, updates progress, and marks COMPLETED or FAILED with error context.

## Risks / Trade-offs

- **Risk:** Shared runtime becomes too generic and hard to evolve. -> **Mitigation:** Keep clear
  interfaces (job runner + pipeline hooks) and avoid embedding domain logic.
- **Risk:** Retrying logic may mask systemic failures. -> **Mitigation:** classify recoverable vs.
  non-recoverable errors, cap retries, and log retry counts.
- **Risk:** Migration complexity for existing workers. -> **Mitigation:** phase adoption per worker
  and maintain parity tests for lifecycle behavior.
- **Risk:** Schema and repository changes affect existing deployments. -> **Mitigation:** add a
  dedicated migration for `batch_jobs`, keep backward compatible fields, and provide rollback plan.
