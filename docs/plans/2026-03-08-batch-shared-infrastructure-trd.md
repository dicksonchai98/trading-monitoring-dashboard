# Batch Shared Infrastructure Technical Requirements Document (TRD)

Version: v1.0
Status: Draft
Owner: Engineering

Reference:

- `docs/plans/batch-shared-infrastructure-design.md`
- `docs/plans/historical-backfill-job-design.md`
- `docs/plans/market-crawler-design.md`

---

# 1. Purpose

This document defines the **technical implementation details** of the Batch Shared Infrastructure used by all batch data services.

Batch services include:

- Historical Backfill Jobs
- Market Crawlers
- Future research dataset builders

The shared infrastructure provides:

- job lifecycle management
- background worker runtime
- retry handling
- configuration loading
- database utilities
- logging and observability

This document describes the **concrete module structure, database schema, and execution model** used by the batch runtime.

---

# 2. System Overview

Batch jobs run in **dedicated worker processes** and use shared runtime components.

High-level runtime structure:

```
Worker Process
      │
      ▼
Job Runner
      │
      ▼
Job Implementation
      │
      ▼
Repositories / Data Access
      │
      ▼
PostgreSQL
```

Each batch service plugs its own job implementation into the shared runtime.

---

# 3. Module Structure

Recommended module layout:

```
backend/
  modules/
    batch_shared/
      config/
      runtime/
      jobs/
      retry/
      logging/
      metrics/
      database/
      repositories/
```

Each module is described below.

---

# 4. Configuration Module

Location:

```
batch_shared/config/
```

Responsibilities:

- load environment configuration
- validate required settings
- expose configuration objects to runtime

Example configuration fields:

```
DATABASE_URL
WORKER_NAME
RETRY_MAX_ATTEMPTS
RETRY_BACKOFF_SECONDS
LOG_LEVEL
```

Configuration should be loaded once during worker startup.

Example configuration object:

```
BatchSettings
  database_url
  retry_max_attempts
  retry_backoff_seconds
  log_level
```

---

# 5. Worker Runtime

Location:

```
batch_shared/runtime/
```

Core responsibility:

- start worker process
- load configuration
- initialize database connection
- dispatch jobs

Worker startup flow:

```
load settings
initialize logger
initialize database session
register job implementations
start worker loop
```

Worker entrypoint example:

```
python workers/backfill_worker.py
python workers/crawler_worker.py
```

Each worker loads the shared runtime but registers different job types.

---

# 6. Job Runner

Location:

```
batch_shared/jobs/job_runner.py
```

The Job Runner is responsible for executing jobs with lifecycle tracking.

Responsibilities:

- create job record
- update job status
- execute job implementation
- catch exceptions
- record completion or failure

Execution flow:

```
create job record
mark RUNNING
execute job
update progress
mark COMPLETED or FAILED
```

Pseudo implementation:

```
run_job(job_type, params):

  job = repository.create_job(job_type)

  try:
      repository.mark_running(job.id)
      result = job_impl.execute(params)
      repository.mark_completed(job.id)
  except Exception as e:
      repository.mark_failed(job.id, error=e)
      raise
```

---

# 7. Retry Framework

Location:

```
batch_shared/retry/
```

Retry module provides reusable retry behavior.

Supported features:

- configurable retry count
- exponential backoff
- retry logging

Example retry policy:

```
max_attempts = 3
backoff = 2^attempt seconds
```

Pseudo retry wrapper:

```
retry(operation):

  for attempt in range(max_attempts):
      try:
          return operation()
      except Exception:
          sleep(backoff)
```

Retry should be applied to:

- HTTP fetch
- external API calls
- transient database conflicts

---

# 8. Database Infrastructure

Location:

```
batch_shared/database/
```

Responsibilities:

- database connection creation
- session management
- transaction helpers

Recommended components:

```
DatabaseSessionFactory
TransactionManager
BulkInsertHelper
UpsertHelper
```

Example usage:

```
with db.transaction():
    repository.upsert_records(records)
```

---

# 9. Repository Layer

Location:

```
batch_shared/repositories/
```

Responsibilities:

- encapsulate SQL operations
- provide domain-safe database access
- isolate persistence logic

Common repositories include:

```
JobRepository
RawPayloadRepository
DatasetRepository
```

Example methods:

```
create_job()
mark_running()
mark_completed()
mark_failed()
update_progress()
```

---

# 10. Job Status Database Schema

Shared batch infrastructure requires a job tracking table.

Table: `batch_jobs`

Fields:

```
id
job_type
status
created_at
started_at
finished_at
retry_count
rows_processed
error_message
metadata_json
```

Status values:

```
CREATED
RUNNING
FAILED
COMPLETED
RETRYING
```

Indexes:

```
(status)
(job_type)
(created_at)
```

---

# 11. Logging Framework

Location:

```
batch_shared/logging/
```

Logging must be structured.

Each log record should include:

```
job_id
job_type
execution_stage
elapsed_time
error_message
```

Example log:

```
job_id=123
job_type=crawler_dataset
stage=parse
rows=120
duration=0.43s
```

---

# 12. Metrics

Location:

```
batch_shared/metrics/
```

Recommended metrics:

```
batch_job_duration_seconds
batch_job_failures_total
batch_rows_processed_total
batch_retry_count_total
```

Metrics should be exposed to the system monitoring platform.

---

# 13. Error Handling Strategy

Errors are categorized into:

Network errors
Source format errors
Validation errors
Persistence errors

Handling strategy:

```
retry transient errors
mark job failed for non-recoverable errors
log full error context
```

All failures must update the job record.

---

# 14. Worker Isolation

Batch services must run in separate worker processes.

Example deployment:

```
api
backfill-worker
crawler-worker
```

This ensures:

- API stability
- independent scaling
- failure isolation

---

# 15. Future Extensions

The shared infrastructure should support additional batch services without modification.

Examples:

- settlement import jobs
- financial statement crawlers
- dataset builders for strategy research

Each new service should only implement its job logic and reuse the shared runtime.

---
