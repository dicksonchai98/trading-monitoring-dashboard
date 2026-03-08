## 1. Module Scaffolding

- [ ] 1.1 Define `batch_runtime` module/package structure
- [ ] 1.2 Create `backend/modules/batch_shared/` submodules per TRD
- [ ] 1.3 Add base interfaces for job runner and pipeline hooks

## 2. Job Lifecycle & Retry

- [ ] 2.1 Implement job lifecycle state model and persistence helpers
- [ ] 2.2 Implement retry policy with configurable backoff
- [ ] 2.3 Add progress tracking updates (rows/chunks/percent)
- [ ] 2.4 Add error classification (network/source format/validation/persistence)

## 3. Logging & Configuration

- [ ] 3.1 Implement structured logging context (job_id, job_type, stage)
- [ ] 3.2 Implement configuration loader (env + config file)
- [ ] 3.3 Add logging fields for elapsed_time and error_message

## 4. Database Helpers

- [ ] 4.1 Implement shared DB connection/transaction helpers
- [ ] 4.2 Implement bulk insert and upsert utilities
- [ ] 4.3 Add `batch_jobs` table migration and indexes
- [ ] 4.4 Implement JobRepository methods (create/mark/update)

## 5. Service Integration

- [ ] 5.1 Implement worker startup flow (load config, init logger/db, register jobs, loop)
- [ ] 5.2 Integrate historical backfill worker with shared runtime
- [ ] 5.3 Integrate market crawler worker with shared runtime

## 6. Validation

- [ ] 6.1 Add unit tests for lifecycle, retry, and progress tracking
- [ ] 6.2 Add unit tests for JobRepository and error classification
- [ ] 6.3 Add integration tests for worker + runtime DB write path
- [ ] 6.4 Add metrics emission validation in integration tests
