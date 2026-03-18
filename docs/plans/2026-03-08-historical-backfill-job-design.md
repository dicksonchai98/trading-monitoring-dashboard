# Historical Backfill Job Design (2026-03-08)

Reference: `docs/plans/2026-03-08-historical-backfill-job-trd.md`

## 1. Design Overview
Build an admin-triggered historical backfill job that runs as a background batch service. It reuses the ingestion pipeline's core data model but bypasses Redis Streams and the realtime indicator flow. The job fetches historical market data (1-minute bars), transforms it into the unified bar schema, and writes directly to PostgreSQL.

This backfill writes into the same realtime table: `kbars_1m`.

Primary goals:
- Safely backfill missing historical 1-minute bars for configured symbols.
- Keep execution idempotent and resumable.
- Isolate batch failures from API and realtime processing paths.
- Preserve deterministic write semantics when historical and realtime data overlap.

## 2. System Architecture

### Realtime pipeline
Shioaji WS -> Ingestor -> Redis Streams -> Aggregator -> PostgreSQL

### Historical pipeline
Shioaji Historical API -> Historical Backfill Job -> PostgreSQL

The historical pipeline writes to the same `kbars_1m` table as realtime data, using upsert semantics.

Time semantics:
- Timezone baseline: `Asia/Taipei` (aligned with current realtime pipeline).
- Minute key semantics: minute start timestamp (`minute_ts`), e.g. 09:30 bar uses `09:30:00+08:00`.
- Range semantics: `[start_date, end_date]` (both inclusive, exchange-local date).
- Job normalization boundary: all source timestamps are converted to timezone-aware `minute_ts` before dedup/upsert.
- Trading-session boundary (day/night session) must follow exchange calendar configuration, not wall-clock date split.

Data ownership policy:
- Realtime pipeline is source of truth for open market minutes near "now".
- Historical backfill is source of truth for closed minutes in the requested range.
- For overlapping rows, conflict policy in section 4.5 applies.

## 3. Execution Model
- The job executes asynchronously as a background batch process.
- Historical API fetch and DB writes are performed per chunk (date-based).
- API request returns immediately with a job id; work is done by background workers.
- Batch worker runs in a dedicated process (not in API server process).

Job request contract:
- Trigger endpoint: `POST /api/admin/backfill/historical-jobs`
- Required role: `admin`
- Required payload:
  - `code` (e.g. `TXF`)
  - `start_date` (`YYYY-MM-DD`, local trading date)
  - `end_date` (`YYYY-MM-DD`, local trading date)
  - `overwrite_mode` (`closed_only` | `force`)
- Response: `202 Accepted` with `{ job_id, status }`

Job query contract:
- `GET /api/admin/backfill/historical-jobs/{job_id}` returns lifecycle + progress.
- `GET /api/admin/backfill/historical-jobs` supports status filtering and pagination.

## 4. Internal Module Design

Backfill service modules:
- Job Controller
- Range Chunker
- Historical Fetcher
- Bar Transformer
- PostgreSQL Writer

### 4.1 Job Controller
Responsibilities:
- Accept job requests
- Manage lifecycle state
- Aggregate progress and errors
- Enforce dedup/locking policy for overlapping job ranges

### 4.2 Range Chunker
Responsibilities:
- Split date range into daily chunks
- Control concurrency and retries
- Coordinate DB write boundaries
- Persist checkpoint for resume from last successful chunk

Example:
- 2024-01-01 ~ 2024-12-31 -> 365 daily chunks

Chunk policy:
- Chunk unit: 1 trading day.
- Max in-flight chunks per job: configurable (`BACKFILL_MAX_CONCURRENCY`, default `2`).
- Retry backoff: exponential with jitter (base 1s, max 30s).

### 4.3 Historical Fetcher
Responsibilities:
- Call Shioaji historical API
- Retry on transient failures
- Return raw historical data
- Rate-limit outbound requests to avoid provider throttling

### 4.4 Bar Transformer
Responsibilities:
- Map raw data into normalized schema

Output fields:
- code
- trade_date
- minute_ts
- open
- high
- low
- close
- volume
- source

Validation rules:
- Drop bars with null critical fields (`minute_ts`, `open`, `high`, `low`, `close`).
- Enforce `low <= open/close <= high`.
- Enforce minute alignment (`second=0`, `microsecond=0`).
- Record invalid row counts in job progress metadata.

### 4.5 PostgreSQL Writer
Responsibilities:
- Write to PostgreSQL with upsert

SQL example:
```sql
INSERT INTO kbars_1m (...)
ON CONFLICT (code, minute_ts)
DO UPDATE SET ...;
```

Conflict resolution policy:
- `overwrite_mode=closed_only` (default):
  - Only overwrite rows where `minute_ts < market_close_cutoff` of that trade date.
  - Overlaps in open session are skipped and counted as `rows_skipped_conflict`.
- `overwrite_mode=force`:
  - Historical row overwrites existing row on conflict.
- All writes are idempotent by `(code, minute_ts)` key.

Transaction boundary:
- One DB transaction per chunk.
- On chunk failure, rollback chunk transaction only.
- Successfully committed chunks remain durable and must not be re-written unless job resumes with same checkpoint contract.

## 5. Database Schema

### Table: `kbars_1m`
Fields:
- code: instrument code
- trade_date: trade date
- minute_ts: bar minute timestamp (`Asia/Taipei`, minute-start semantics)
- open
- high
- low
- close
- volume

Unique key:
- (code, minute_ts)

Note:
- If `(code, minute_ts)` unique constraint/index is not present yet, it must be added before enabling UPSERT.
- Recommended index for job scans: `(code, trade_date)`.

### Table: `historical_backfill_jobs`
Fields:
- job_id
- job_type (`historical_backfill`)
- code
- requested_start_date
- requested_end_date
- status
- rows_written
- rows_processed
- rows_failed_validation
- rows_skipped_conflict
- error_message
- retry_count
- processed_chunks
- total_chunks
- checkpoint_cursor
- last_heartbeat_at
- created_at
- started_at
- finished_at

Status enum:
- `created`
- `running`
- `retrying`
- `failed`
- `completed`

Uniqueness and dedup:
- A running job lock must prevent duplicate active jobs on the same `(code, requested_start_date, requested_end_date, overwrite_mode)` tuple.
- Duplicate request behavior:
  - If same active job exists, return existing `job_id`.
  - If previous job finished, create a new job record.

## 6. Shared Infrastructure
Shared components and cross-service infrastructure are defined in:
- `docs/plans/2026-03-08-batch-shared-infrastructure-design.md`

## 6.1 Shioaji Session Alignment (with Market Ingestion)
Shioaji login + API key alignment with market ingestion:
- Reuse the existing `ShioajiClient` wrapper from `app/market_ingestion/shioaji_client.py` to keep the login contract consistent.
- Credentials and mode MUST use the same env vars as ingestion:
  - `SHIOAJI_API_KEY`
  - `SHIOAJI_SECRET_KEY`
  - `SHIOAJI_SIMULATION`
- Login flow should follow the ingestion sequence:
  - `api.login(api_key=..., secret_key=..., fetch_contract=False)`
  - `api.fetch_contracts(contract_download=True)` when historical calls need contract context

Implementation note:
- Shared factory lives in `app/services/shioaji_session.py` (`build_shioaji_api()` / `build_shioaji_client()`). Backfill should use this to share credentials and session setup with ingestion.

## 7. Failure Handling
- Retry per chunk up to N times
- On permanent failure, mark job status as `failed`
- Log failure details for audit and debugging

Failure classes:
- Retryable:
  - provider timeout / transient network errors
  - temporary DB connectivity issues
  - provider throttling
- Non-retryable:
  - invalid request range
  - auth/permission misconfiguration
  - schema mismatch or unrecoverable transform errors

Operational safety:
- Failure of a single job must not block other jobs or realtime ingestion.
- Worker restart must recover running jobs from persisted checkpoint.

## 8. Security / RBAC / Audit
- Trigger/list/detail endpoints are admin-only and must enforce backend RBAC checks.
- All job trigger actions must create audit records including:
  - actor user id
  - request payload hash
  - job_id
  - timestamp
- Secrets (`SHIOAJI_API_KEY`, `SHIOAJI_SECRET_KEY`) must never appear in logs.

## 9. Observability and SLO
Required metrics:
- `backfill_job_duration_seconds`
- `backfill_job_failure_count`
- `backfill_rows_processed_total`
- `backfill_chunk_retry_total`
- `backfill_active_jobs`

Minimum log fields:
- `job_id`
- `job_type`
- `code`
- `chunk_cursor`
- `status`
- `elapsed_ms`

SLO target (MVP):
- 95% of daily chunks complete successfully within 2 retries.
- Job status heartbeat update interval <= 30 seconds while running.

## 10. Testing Scope
Unit:
- chunk boundary generation
- overwrite policy (`closed_only` vs `force`)
- transformer validation rules

Integration:
- chunk transaction rollback isolation
- resume from checkpoint after worker restart
- concurrent duplicate job trigger dedup behavior

API:
- admin RBAC enforcement
- trigger/list/detail contracts
- deterministic 202 response with `job_id`

Non-functional:
- worker concurrency stress for multiple jobs
- provider throttling behavior under retry/backoff

## 11. Future Extensions
- Automatic gap detection
- Scheduled backfill
- Multi-symbol backfill
- Multiple data vendors
- Data validation pipeline
