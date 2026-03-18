## Context

The platform currently has a realtime path (`market_ingestion -> Redis Streams -> indicator_engine -> SSE`) but does not have a dedicated batch pipeline for low-frequency public market datasets used in strategy research, backtesting, and statistics. Data preparation for these use cases is currently manual and inconsistent.

This change introduces a separate crawler service that fetches TAIFEX public data, transforms it to canonical internal records, validates quality, and persists to PostgreSQL. The crawler must remain isolated from realtime serving and must support idempotent reruns and date-range backfill.

Key constraints:
- No impact on realtime ingestion latency or SSE delivery.
- Admin-only trigger surfaces with backend RBAC and audit logging.
- Dataset-driven extensibility (new dataset by config + adapter, not runtime rewrites).
- First MVP dataset and publication window are fixed by the design baseline.

## Goals / Non-Goals

**Goals:**
- Build a dedicated `crawler-worker` execution path independent from API request threads and realtime services.
- Implement canonical crawler stages: Fetcher -> Parser -> Normalizer -> Validator -> Persistence.
- Define dataset registry and contract validation to enable one-dataset-per-config onboarding.
- Support single-date execution and date-range backfill decomposed into per-date jobs.
- Ensure idempotent persistence using upsert semantics into `market_open_interest_daily`.
- Standardize failure categories, retry behavior, and publication-not-ready detection.
- Provide operational observability (structured logs + metrics) and range-level traceability via parent job/correlation id.

**Non-Goals:**
- Realtime fan-out via Redis Streams or SSE.
- Signal/factor generation and generalized analytics warehouse modeling.
- Multi-node distributed crawler orchestration in MVP.
- Full multi-dataset rollout beyond the initial TAIFEX institutional open-interest dataset.

## Decisions

### 1. Isolate crawler runtime as a dedicated worker process
- Decision: Run crawler in a separate `crawler-worker` process.
- Rationale: Keeps failures and latency from impacting API/realtime path.
- Alternative considered: Run crawler in API background tasks. Rejected due to resource contention and failure blast radius.

### 2. Use dataset-driven architecture (config + registry + stage bindings)
- Decision: Each dataset is declared by config and resolved through registry (`parser/normalizer/validator` symbolic bindings).
- Rationale: Reduces hardcoded source logic and supports incremental dataset onboarding.
- Alternative considered: Hardcode per-dataset flows in orchestrator. Rejected due to high maintenance and poor extensibility.

### 3. Fix canonical execution pipeline and responsibilities
- Decision: Enforce stage order `Job Orchestrator -> Fetcher -> Parser -> Normalizer -> Validator -> Persistence`.
- Rationale: Clear boundaries improve testability, incident diagnosis, and predictable retries.
- Alternative considered: Combine parse/normalize/validate in one dataset module. Rejected due to low observability and coupling.

### 4. Choose per-date idempotent persistence as transaction unit
- Decision: Upsert rows keyed by `(data_date, market_code, instrument_code, entity_code, source)`; one date per transaction boundary.
- Rationale: Enables safe reruns, partial recovery, and deterministic final state.
- Alternative considered: Range-wide transaction. Rejected due to lock duration and poor fault isolation.

### 5. Implement range backfill as parent + child per-date jobs
- Decision: `run_range` creates a parent job/correlation id and decomposes into per-date child jobs.
- Rationale: Preserves per-date retry/recovery while enabling range-level progress tracking.
- Alternative considered: Single monolithic range job. Rejected due to weak observability and restart complexity.

### 6. Standardize retry precedence and publication window behavior
- Decision: Retry counter applies per run context (one scheduled execution), not across whole publication window.
- Rationale: Avoids ambiguous counting and aligns scheduler behavior with error handling.
- Alternative considered: Global max-attempt across full window. Rejected due to fragile behavior under mixed transient failures.

### 7. Define deterministic publication readiness classification
- Decision: Treat fetch-success + non-ready payload signals (empty/header-only/no-data marker/row count below minimum) as `publication_not_ready`; malformed payload as `source_format_error`.
- Rationale: Ensures consistent retry/fail-fast outcomes across implementations.
- Alternative considered: Use HTTP status only. Rejected because data source can return HTTP 200 before data is truly ready.

### 8. Fix MVP source and schema baseline
- Decision: Use TAIFEX open data endpoint for institutional futures positions; normalize into `market_open_interest_daily` with fixed MVP fields and types.
- Rationale: Locks data contract early to reduce downstream drift across parser/validator/repository.
- Alternative considered: Keep schema open-ended in MVP. Rejected due to higher integration risk and unclear acceptance criteria.

## Risks / Trade-offs

- [Source format drift in TAIFEX payload] -> Mitigation: keep parser versioned, fail fast on schema break, explicit `source_format_error`, admin rerun after parser fix.
- [Publication timing variance causes noisy failures] -> Mitigation: enforce Taipei-time window retries and delayed `T+1 08:30` retry.
- [Data quality ambiguity when payload is technically valid but incomplete] -> Mitigation: dataset-specific minimum row/count checks and deterministic classification rules.
- [Backfill fan-out produces high DB write pressure] -> Mitigation: per-date transaction boundaries, controlled worker concurrency, per-date rerun semantics.
- [Operational complexity from parent/child jobs] -> Mitigation: require parent job/correlation id in APIs and standardized job/event logging fields.

## Migration Plan

1. Add crawler domain modules and registry abstractions in backend batch module.
2. Add initial dataset config and stage implementations for TAIFEX institutional open-interest CSV.
3. Add persistence schema (`crawler_jobs` with parent/correlation fields, `market_open_interest_daily`, optional raw payload extension point).
4. Add admin trigger/query endpoints guarded by RBAC and audited.
5. Deploy `crawler-worker` process in parallel with existing API and backfill worker.
6. Run dry-run in staging for selected historical dates, validate idempotency and classification behavior.
7. Enable production schedule window (`13:50-18:00` + delayed `T+1 08:30`) and monitor.

Rollback strategy:
- Disable scheduler trigger and admin run endpoints for crawler.
- Keep existing realtime pipeline untouched (no rollback coupling required).
- Preserve job records for audit; rerun after fix using per-date scope.

## Open Questions

- None for MVP baseline. Endpoint, publication window, normalized schema, and range-backfill behavior are fixed by current design decisions.
