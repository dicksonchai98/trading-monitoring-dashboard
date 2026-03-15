# Batch Job Admin Queue Redesign

Date: 2026-03-15
Status: Draft
Owner: Engineering

## Summary

Refactor batch execution so historical backfill and market crawler no longer maintain separate
job lifecycle runtimes or write status into different lifecycle tables. Standardize admin-triggered
job creation under `/api/admin`, persist all lifecycle state in `batch_jobs`, and trigger workers
through Redis lists consumed by dedicated worker processes via `BRPOP`.

This redesign keeps domain-specific request validation in each service module while consolidating
job creation, queue dispatch, lifecycle updates, retry, metrics, and structured logging into
`batch_shared`.

## Goals

- Make `batch_jobs` the single lifecycle source of truth for historical backfill and market crawler.
- Require admin authorization for all job creation paths.
- Move worker triggering to Redis list queues with blocking pop (`BRPOP`).
- Keep separate worker processes for backfill and crawler while removing duplicated runtime logic.
- Centralize lifecycle metrics, logging, retry, and progress handling in `batch_shared`.
- Standardize admin API routing under `/api/admin`.

## Non-Goals

- Reworking domain fetch, parse, normalize, validate, or persistence logic.
- Converting workers into a generalized multi-tenant pool.
- Designing a long-term scheduler or cron system.
- Expanding batch infrastructure beyond historical backfill and market crawler in this change.

## Problems With The Current State

The current codebase still has drift between the intended shared runtime design and the actual
implementation:

- Historical backfill and market crawler still carry service-specific lifecycle repositories.
- Market crawler persists lifecycle state in `crawler_jobs`; historical backfill persists lifecycle
  state in `historical_backfill_jobs`; shared runtime persists to `batch_jobs`.
- Worker entrypoints execute a single job directly instead of acting as queue consumers.
- Admin-triggered job creation is split across different route structures and persistence models.

This creates duplicated lifecycle behavior, inconsistent observability, and unnecessary maintenance
overhead.

## Decision Summary

Adopt a hybrid design:

- Keep domain-specific create-job routes separate so each service retains its own request schema and
  validation logic.
- Move all actual job creation and enqueue behavior behind a shared batch admin service.
- Use `batch_jobs` as the only lifecycle table for both workers.
- Use one Redis list per worker type and `BRPOP` for task dispatch.
- Keep lifecycle retry, progress updates, logging, and metrics exclusively in `batch_shared`.

## Admin API Design

### Route Structure

All admin-triggered batch routes move under `/api/admin`.

Recommended create routes:

- `POST /api/admin/batch/backfill/jobs`
- `POST /api/admin/batch/crawler/jobs`

Recommended shared query routes:

- `GET /api/admin/batch/jobs`
- `GET /api/admin/batch/jobs/{job_id}`

### Route Responsibilities

Domain-specific create routes remain responsible for:

- request schema validation
- domain-level request normalization
- domain-level dedupe policy
- audit event naming

Shared batch admin service becomes responsible for:

- verifying requested `worker_type` and `job_type`
- creating the `batch_jobs` row
- storing canonical metadata
- computing queue name
- enqueueing the job to Redis

### Authorization

All create-job routes require backend admin authorization through `require_admin`. Public or
member-level access must return deterministic `401/403` behavior consistent with the existing auth
and RBAC baseline.

## Data Model Design

### Canonical Lifecycle Table

`batch_jobs` becomes the only lifecycle persistence table for backfill and crawler jobs.

Required fields:

- `id`
- `worker_type`
- `job_type`
- `status`
- `created_at`
- `started_at`
- `finished_at`
- `retry_count`
- `rows_processed`
- `checkpoint_cursor`
- `processed_chunks`
- `total_chunks`
- `last_heartbeat_at`
- `error_message`
- `dedupe_key`
- `metadata_json`

### Field Semantics

- `worker_type`: identifies which dedicated worker queue and process owns the job. Initial values:
  `historical_backfill`, `market_crawler`.
- `job_type`: identifies the concrete runtime implementation within that worker, for example
  `historical-backfill`, `crawler-single-date`, `crawler-backfill`.
- `dedupe_key`: stable hash or canonical string used during create-job dedupe checks.
- `metadata_json`: domain-specific payload for the job implementation.

### Metadata Policy

Service-specific payload fields move into `metadata_json` rather than separate lifecycle tables.

Examples:

- historical backfill:
  - `code`
  - `start_date`
  - `end_date`
  - `overwrite_mode`
- market crawler:
  - `dataset_code`
  - `target_date`
  - `start_date`
  - `end_date`
  - `trigger_type`
  - optional correlation fields if still needed for operator visibility

The lifecycle table remains generic; domain services own metadata shape and validation.

## Dedupe Policy

### Definition

Dedupe means preventing creation of a second active job that represents the same requested unit of
work.

This protects against:

- repeated admin clicks
- duplicate manual operations by different admins
- overlapping jobs that waste worker capacity and external API quota

### Placement

Dedupe must remain a domain-level rule, not a generic shared-runtime rule.

Reason:

- only the domain service knows which fields define "the same work"
- different services may need different duplicate semantics
- shared runtime should stay limited to lifecycle and infrastructure concerns

### Active Status Set

Dedupe checks should treat these statuses as active:

- `CREATED`
- `RUNNING`
- `RETRYING`
- `PARTIALLY_COMPLETED`

### Initial Dedupe Rules

Historical backfill duplicates an active job when:

- `worker_type = historical_backfill`
- `job_type = historical-backfill`
- `dedupe_key` derived from `code + start_date + end_date + overwrite_mode` matches

Market crawler single-date duplicates an active job when:

- `worker_type = market_crawler`
- `job_type = crawler-single-date`
- `dedupe_key` derived from `dataset_code + target_date` matches

Market crawler range duplicates an active job when:

- `worker_type = market_crawler`
- `job_type = crawler-backfill`
- `dedupe_key` derived from `dataset_code + start_date + end_date + trigger_type` matches

If an active duplicate exists, the create API should return the existing job instead of creating a
new one.

## Queueing Design

### Queue Model

Each worker type consumes from its own Redis list:

- `queue:batch:historical_backfill`
- `queue:batch:market_crawler`

Admin create flow:

1. validate request in domain route/service
2. check domain dedupe rule against active `batch_jobs`
3. create `batch_jobs` row with status `CREATED`
4. `LPUSH` serialized queue message to the worker-specific Redis list
5. return accepted response with `job_id`

### Queue Payload

Queue payload should be minimal and use the database as the source of truth.

Recommended payload:

- `job_id`

Optional defensive payload:

- `job_id`
- `worker_type`

The worker must always reload the full job record from `batch_jobs` before execution. The queue
payload must not be treated as authoritative job metadata.

### Worker Consumption

Each worker process becomes a long-running queue consumer:

1. call `BRPOP` on its queue
2. parse `job_id`
3. load the `batch_jobs` row
4. verify `worker_type` matches the worker
5. dispatch by `job_type`
6. execute the job through shared runtime

This replaces the current single-run CLI execution model as the primary path.

## Shared Runtime Design

### Worker Registry

Each worker still owns its own job registry:

- backfill worker registers `historical-backfill`
- crawler worker registers `crawler-single-date`, `crawler-backfill`

The runtime remains isolated per process, but lifecycle orchestration is shared.

### Runner Contract

`JobRunner` should be refactored so it executes an existing `batch_jobs` record instead of creating
another lifecycle row at execution time.

Required execution flow:

1. load existing job by `job_id`
2. mark `RUNNING`
3. invoke job implementation with metadata-derived params
4. update progress and heartbeat as job runs
5. apply retry policy for retryable failures
6. mark `COMPLETED` or `FAILED`

This change is required because job creation now occurs at the admin API boundary, not inside the
worker runtime.

### Progress Tracking

Shared runtime remains responsible for:

- `rows_processed`
- `processed_chunks`
- `total_chunks`
- `checkpoint_cursor`
- `last_heartbeat_at`

Job implementations may report progress through shared context callbacks, but they should not write
direct lifecycle state themselves.

## Retry Design

Retry policy remains centralized in `batch_shared`.

Shared runtime responsibilities:

- classify exceptions into retryable vs non-retryable categories
- apply configured retry count and backoff
- update lifecycle status to `RETRYING`
- increment retry counters
- emit retry logs and metrics

Job implementations should not maintain their own lifecycle retry loops. They should surface
failures as exceptions with enough context for shared error classification.

## Logging Design

Lifecycle logging becomes shared-runtime only.

Every lifecycle log entry should include at least:

- `job_id`
- `worker_type`
- `job_type`
- `execution_stage`
- `elapsed_time` when applicable
- `retry_count` when applicable

Expected shared lifecycle stages:

- job dequeued
- job started
- progress updated
- retry scheduled
- job completed
- job failed

Domain jobs may add their own structured fields such as `dataset_code`, `target_date`, or
`overwrite_mode`, but they should not replace lifecycle logging.

## Metrics Design

Shared lifecycle metrics should be emitted only by `batch_shared`.

Recommended shared metrics:

- `batch_job_started_total`
- `batch_job_completed_total`
- `batch_job_failed_total`
- `batch_job_retry_total`
- `batch_job_duration_seconds`
- `batch_rows_processed_total`
- `batch_queue_dequeue_total`

Recommended labels:

- `worker_type`
- `job_type`
- `error_category` where relevant

Domain-specific throughput metrics may still exist inside service modules, for example:

- crawler fetch/normalize/persist counters
- backfill validation or write counters

The rule is:

- lifecycle metrics are shared-only
- domain processing metrics are service-specific

## Route And Query Model

### Create Responses

Create endpoints should return accepted job information from `batch_jobs`, for example:

- `job_id`
- `worker_type`
- `job_type`
- `status`

### Shared Job Queries

Shared query endpoints should read from `batch_jobs` and support filters such as:

- `worker_type`
- `job_type`
- `status`
- `limit`
- `offset`

If existing clients still expect service-specific response shapes, routes may temporarily adapt the
shared record into domain-specific response objects during migration.

## Migration Strategy

### Phase 1: Introduce Shared Create And Queue Flow

- add `worker_type` and `dedupe_key` to `batch_jobs`
- implement shared admin create/enqueue service
- add Redis queue abstraction for `LPUSH` and worker `BRPOP`
- switch admin create routes to create `batch_jobs` rows only

### Phase 2: Switch Workers To Existing-Job Execution

- refactor worker runtime to consume queue messages
- refactor `JobRunner` to execute existing jobs by `job_id`
- remove lifecycle row creation from worker execution path

### Phase 3: Remove Legacy Lifecycle Tables From The Runtime Path

- stop writing lifecycle status to `crawler_jobs`
- stop writing lifecycle status to `historical_backfill_jobs`
- migrate query APIs to read `batch_jobs`
- keep legacy tables read-only temporarily only if needed for compatibility

### Phase 4: Clean Up

- delete obsolete lifecycle repositories and runtime helpers
- remove dead migrations or add follow-up drop-table migrations once compatibility is no longer
  needed
- update operations docs and test fixtures

## Testing Strategy

### Unit Tests

- domain create services compute dedupe keys correctly
- duplicate active jobs return the existing row
- shared batch admin service maps worker type to Redis queue correctly
- shared runtime executes existing job rows and applies lifecycle transitions correctly
- retry policy updates status and counters correctly

### Integration Tests

- admin create route writes one `batch_jobs` row and enqueues one Redis message
- backfill worker consumes queue item and completes lifecycle in `batch_jobs`
- crawler worker consumes queue item and completes lifecycle in `batch_jobs`
- non-admin requests to create-job routes receive deterministic `401/403`

### Regression Tests

- list/detail APIs still return operator-usable job data after removal of service lifecycle tables
- progress and heartbeat fields continue updating during long-running jobs
- retryable failures still move through `RETRYING`

## Risks

- Parent-child modeling used by crawler range runs may not map one-to-one with the generic shared
  lifecycle table.
- Existing tests and operational tooling may still depend on `crawler_jobs` or
  `historical_backfill_jobs`.
- Queue consumers introduce at-least-once delivery behavior; worker execution must stay idempotent.

## Mitigations

- Keep crawler correlation or hierarchy metadata inside `metadata_json` during the first migration
  step instead of over-designing new shared columns.
- Use `dedupe_key` plus idempotent domain writers to limit duplicate work.
- Keep queue payload minimal and reload from `batch_jobs` to reduce drift.
- Roll out query API migration before dropping legacy tables.

## Open Questions

- Whether crawler range jobs need explicit parent-child lifecycle rows in `batch_jobs` or whether
  metadata-based grouping is sufficient for MVP operations.
- Whether a follow-up change should unify queue names and worker registration through configuration
  rather than constants.

## Outcome

After this redesign:

- admin-triggered batch jobs always enter through `/api/admin`
- lifecycle state for both workers is stored only in `batch_jobs`
- workers are triggered through Redis lists and `BRPOP`
- lifecycle retry, logging, metrics, and progress are maintained only in `batch_shared`
- historical backfill and market crawler keep only domain-specific validation and execution logic
