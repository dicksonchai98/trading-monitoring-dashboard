# Batch Shared Runtime Full Integration Design

Date: 2026-03-11
Status: Draft
Owner: Engineering

## Summary

Fully migrate historical backfill and market crawler workers to the shared batch runtime. Remove
legacy per-service runtimes and rely on `batch_shared` for lifecycle, retry, progress, logging,
metrics, and persistence. Service modules keep only job-specific logic.

## Goals

- Single runtime path via `batch_shared` for all batch workers.
- Remove legacy runtime modules from historical backfill and market crawler services.
- Centralize lifecycle, retry, logging, metrics, and job persistence in `batch_shared`.
- Keep job implementations focused on domain logic only.

## Non-Goals

- Changing domain fetch/transform/validate/persist logic.
- Introducing new external dependencies.
- Altering public API behavior beyond runtime orchestration changes.

## Architecture

- Worker entrypoints:
  - `workers/backfill_worker.py`
  - `workers/crawler_worker.py`
- Shared runtime:
  - `build_worker_runtime()` loads settings, configures logging, constructs `JobRunner`,
    `RetryPolicy`, `JobRepository`, and `BatchMetrics`.
- Job execution:
  - `JobRunner` creates `batch_jobs` record, marks RUNNING, executes job, updates progress,
    marks COMPLETED/FAILED.

## Component Changes

- Historical backfill:
  - Remove legacy worker runtime module.
  - `HistoricalBackfillJobImplementation.execute` raises errors and defers retry to shared
    `RetryPolicy`.
- Market crawler:
  - Remove per-job retry loops from job implementations.
  - Shared runtime handles retries; job implementations return `JobResult` or raise errors.

## Error Handling

- Error classification uses `batch_shared.retry.errors.classify_error`.
- `RetryPolicy` determines retryability based on error category.
- Non-recoverable errors fail and mark job FAILED with context.

## Metrics & Logging

- Lifecycle metrics (`batch_*`) emitted by shared runtime only.
- Domain metrics may remain within job implementations.
- Structured logging uses `batch_shared.logging` for lifecycle stages.

## Testing

- Remove/update tests that depend on legacy runtimes.
- Add or adjust integration tests to exercise job execution via shared runtime.
- Ensure shared runtime unit tests cover retry, lifecycle, and progress.
