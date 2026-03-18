## 1. Data Model and Persistence

- [x] 1.1 Add/verify DB migration for `kbars_1m` unique key on `(code, minute_ts)` and index `(code, trade_date)`
- [x] 1.2 Add/verify `historical_backfill_jobs` schema fields for lifecycle, counters, checkpoint, and heartbeat
- [x] 1.3 Implement repository methods for job create/update/detail/list and atomic checkpoint updates
- [x] 1.4 Implement idempotent upsert writer for `kbars_1m` keyed by `(code, minute_ts)` with overwrite-mode branches

## 2. Backfill Domain Implementation

- [x] 2.1 Implement job controller for lifecycle transitions (`created/running/retrying/failed/completed`) and duplicate active-job locking
- [x] 2.2 Implement range chunker for trading-day chunks with configurable concurrency and backoff policy
- [x] 2.3 Implement historical fetcher integration using shared Shioaji session factory and request rate limiting
- [x] 2.4 Implement bar transformer normalization (`Asia/Taipei`, minute-start `minute_ts`) and validation rules
- [x] 2.5 Implement retry classification (retryable vs non-retryable) and per-chunk transaction rollback handling
- [x] 2.6 Implement resume behavior from persisted checkpoint after worker restart
- [x] 2.7 Implement exchange-calendar-based day/night session boundary handling (avoid wall-clock date split assumptions)

## 3. API, RBAC, and Audit

- [x] 3.1 Add admin endpoint `POST /api/admin/backfill/historical-jobs` with request validation and 202 response contract
- [x] 3.2 Add admin endpoint `GET /api/admin/backfill/historical-jobs` with status filter and pagination
- [x] 3.3 Add admin endpoint `GET /api/admin/backfill/historical-jobs/{job_id}` with progress/heartbeat payload
- [x] 3.4 Enforce backend RBAC for all backfill admin routes and return deterministic 401/403 behavior
- [x] 3.5 Add audit logging for job trigger actions including actor id, payload hash, job id, and timestamp
- [x] 3.6 Update identity-access PRD route inventory artifacts to include backfill admin routes

## 4. Worker Runtime and Operations

- [x] 4.1 Wire dedicated backfill worker process startup, config loading, and graceful shutdown handling
- [x] 4.2 Add config knobs (`BACKFILL_MAX_CONCURRENCY`, retry count, backoff, optional max range guard)
- [x] 4.3 Add structured log fields (`job_id`, `job_type`, `code`, `chunk_cursor`, `status`, `elapsed_ms`)
- [x] 4.4 Add required metrics (`backfill_job_duration_seconds`, `backfill_job_failure_count`, `backfill_rows_processed_total`, `backfill_chunk_retry_total`, `backfill_active_jobs`)
- [x] 4.5 Add job heartbeat update mechanism (<= 30s while running)
- [x] 4.6 Enforce secret-safe logging so `SHIOAJI_API_KEY` and `SHIOAJI_SECRET_KEY` are never emitted

## 5. Verification and Quality Gates

- [x] 5.1 Unit tests for chunk boundary generation, overwrite policy (`closed_only` vs `force`), and transformer validation rules
- [x] 5.2 Integration tests for chunk transaction rollback isolation and checkpoint resume behavior
- [x] 5.3 API tests for admin RBAC enforcement and trigger/list/detail response contracts
- [x] 5.4 Concurrency test for duplicate trigger dedup returning existing active `job_id`
- [x] 5.5 Non-functional test for provider throttling/retry backoff and worker concurrency stress
- [x] 5.6 Update docs and run final verification (`openspec validate` and project test suite) before `/opsx:apply`
- [x] 5.7 Verify operational SLO signals: 95% chunk success within 2 retries and heartbeat freshness <= 30s
