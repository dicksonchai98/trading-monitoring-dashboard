## 1. Crawler Foundation

- [x] 1.1 Create `market_crawler` module structure (`application/domain/infrastructure/jobs/registry/fetchers/parsers/normalizers/validators/repositories`)
- [x] 1.2 Implement `crawler-worker` entrypoint and register it in worker runtime/deployment config
- [x] 1.3 Add core domain contracts (`CrawlerJobParams`, `FetchedPayload`, `ParsedRow`, `NormalizedRecord`, `ValidationResult`)

## 2. Dataset Registry and Config

- [x] 2.1 Define dataset config schema and loader for crawler datasets
- [x] 2.2 Implement dataset registry startup checks (unique `dataset_code`, parser/normalizer/validator binding resolution, fail-fast)
- [x] 2.3 Add MVP dataset config `taifex_institution_open_interest_daily` with fixed endpoint, schedule window, and storage bindings

## 3. Pipeline Implementation

- [x] 3.1 Implement job orchestrator for single-date run (`dataset_code + target_date`)
- [x] 3.2 Implement fetcher/parser/normalizer/validator/persistence interfaces and stage wiring
- [x] 3.3 Implement MVP TAIFEX CSV parser + normalizer + validator with deterministic `publication_not_ready` classification
- [x] 3.4 Implement per-date upsert persistence into `market_open_interest_daily` with uniqueness key `(data_date, market_code, instrument_code, entity_code, source)`

## 4. Job Control and Retry

- [x] 4.1 Implement job lifecycle persistence (`CREATED`, `RUNNING`, `COMPLETED`, `FAILED`) with stage/error tracking
- [x] 4.2 Implement range backfill orchestration that creates one parent job/correlation id and per-date child jobs
- [x] 4.3 Implement retry rules: per-run-context max attempts, publication window retries (`13:50-18:00`) and delayed retry (`T+1 08:30`)
- [x] 4.4 Add failure-category mapping (`network_error`, `publication_not_ready`, `source_format_error`, `validation_error`, `persistence_error`)

## 5. API, RBAC, and Audit

- [x] 5.1 Add admin endpoints: `POST /admin/crawler/run`, `POST /admin/crawler/backfill`, `GET /admin/crawler/jobs`, `GET /admin/crawler/jobs/{job_id}`
- [x] 5.2 Enforce backend RBAC for crawler endpoints (admin-only) and return proper unauthorized responses
- [x] 5.3 Add audit logging for crawler trigger/rerun/backfill actions with parent/correlation references
- [x] 5.4 Ensure backfill trigger response returns parent job id / correlation id

## 6. Schema and Observability

- [x] 6.1 Add DB schema/migration for `crawler_jobs` (including `parent_job_id`, `correlation_id`), `market_open_interest_daily`, and optional raw payload extension point
- [x] 6.2 Add structured logs for required fields (`job_id`, `dataset_code`, `source_name`, `target_date`, `execution_stage`, row counters, `retry_count`)
- [x] 6.3 Add crawler metrics (`crawler_job_duration_seconds`, `crawler_job_failures_total`, `crawler_rows_*`, `crawler_retry_count_total`, `crawler_stage_duration_seconds`)

## 7. Verification and Rollout

- [x] 7.1 Add unit tests for dataset registry validation, parser/normalizer/validator behavior, and retry classification
- [x] 7.2 Add integration tests for single-date and range backfill flows (parent-child tracking, idempotent rerun, per-date failure isolation)
- [x] 7.3 Add API tests for crawler admin endpoints, RBAC, and audit side effects
- [ ] 7.4 Execute staging dry-run for selected dates and validate publication-window behavior before enabling production schedule
