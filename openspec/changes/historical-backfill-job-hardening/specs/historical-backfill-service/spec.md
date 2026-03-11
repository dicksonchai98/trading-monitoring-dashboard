## ADDED Requirements

### Requirement: Admin can trigger historical backfill job
The system SHALL provide an admin-only API to create a historical backfill job for a symbol and date range.

#### Scenario: Admin trigger accepted
- **WHEN** an admin calls `POST /api/admin/backfill/historical-jobs` with valid `code`, `start_date`, `end_date`, and optional `overwrite_mode`
- **THEN** the system returns `202` with a `job_id` and initial job status

#### Scenario: Non-admin trigger rejected
- **WHEN** a non-admin actor calls `POST /api/admin/backfill/historical-jobs`
- **THEN** the system rejects the request with `403`

### Requirement: Duplicate active backfill requests are deduplicated
The system SHALL prevent duplicate active jobs for the same `(code, requested_start_date, requested_end_date, overwrite_mode)` tuple and SHALL return the existing active `job_id`.

#### Scenario: Duplicate active request returns existing job id
- **WHEN** an admin triggers backfill with parameters matching an existing active job
- **THEN** the system returns `202` with the existing active `job_id` instead of creating a new job

#### Scenario: Finished job parameters can be retriggered
- **WHEN** an admin triggers backfill with parameters matching a previously completed or failed job
- **THEN** the system creates a new job record with a new `job_id`

### Requirement: Backfill jobs execute asynchronously in isolated worker runtime
The system SHALL execute historical backfill jobs asynchronously in a dedicated worker process separate from the API process.

#### Scenario: API request path is non-blocking
- **WHEN** a valid backfill trigger request is accepted
- **THEN** the API responds immediately and job execution continues in background worker runtime

#### Scenario: Worker failure is isolated from API process
- **WHEN** a backfill worker job fails at runtime
- **THEN** API request handling and realtime ingestion remain available

### Requirement: Backfill write semantics are idempotent and deterministic
The system SHALL normalize fetched timestamps to timezone-aware minute-start `minute_ts` in `Asia/Taipei` and upsert bars by `(code, minute_ts)`.

#### Scenario: Duplicate run does not create duplicate rows
- **WHEN** the same range is processed more than once for the same symbol
- **THEN** the target table remains deduplicated by `(code, minute_ts)`

#### Scenario: Source timestamps are normalized before write
- **WHEN** historical bars are transformed before persistence
- **THEN** each row uses minute-aligned timezone-aware `minute_ts` and is written with canonical key semantics

### Requirement: Trading-session boundaries follow exchange calendar
The system SHALL determine day/night session boundaries using configured exchange calendar rules rather than wall-clock date splits.

#### Scenario: Session split follows exchange calendar
- **WHEN** bars span a night-session boundary for a trading date
- **THEN** chunking and normalization apply exchange-calendar session definitions

#### Scenario: Wall-clock date change does not force incorrect session boundary
- **WHEN** local date changes during an active night session
- **THEN** bars remain associated by exchange-calendar session logic

### Requirement: Overlap behavior with realtime data is controlled by overwrite mode
The system SHALL support `overwrite_mode` with default `closed_only` and optional `force` for conflict handling.

#### Scenario: Closed-only mode preserves open-session rows
- **WHEN** `overwrite_mode` is `closed_only` and a conflict occurs in an open session minute
- **THEN** the conflicting row is skipped and recorded as skipped conflict

#### Scenario: Force mode overwrites conflicting rows
- **WHEN** `overwrite_mode` is `force` and a conflict occurs on `(code, minute_ts)`
- **THEN** the existing row is updated with historical values

### Requirement: Job lifecycle and progress are observable
The system SHALL persist job lifecycle and progress metadata, including status transitions, row counters, chunk counters, checkpoint cursor, and heartbeat timestamp.

#### Scenario: Job detail exposes lifecycle and progress
- **WHEN** an admin calls `GET /api/admin/backfill/historical-jobs/{job_id}`
- **THEN** the response includes status, processed/total chunks, row counters, and last heartbeat

#### Scenario: Worker restart can resume from checkpoint
- **WHEN** worker process restarts while a job is incomplete
- **THEN** the job resumes from persisted checkpoint without duplicating committed chunk effects

### Requirement: Job listing supports operational filtering and pagination
The system SHALL provide list query behavior on `GET /api/admin/backfill/historical-jobs` that supports status filtering and pagination.

#### Scenario: Admin can list jobs by status
- **WHEN** an admin requests the list endpoint with a status filter
- **THEN** only jobs matching the requested status are returned

#### Scenario: Admin can paginate through job history
- **WHEN** an admin requests the list endpoint with pagination parameters
- **THEN** the response returns a deterministic page window and paging metadata

### Requirement: Trigger actions are auditable with required fields
The system SHALL create an audit record for each accepted backfill trigger action with `actor_user_id`, `request_payload_hash`, `job_id`, and timestamp.

#### Scenario: Trigger action writes audit record
- **WHEN** a backfill trigger request is accepted
- **THEN** an audit record is persisted with the required fields

#### Scenario: Audit record links actor and created job
- **WHEN** an operator inspects trigger audit events
- **THEN** each event can be correlated to both initiating actor and resulting `job_id`

### Requirement: Sensitive credentials are never logged
The system SHALL NOT emit `SHIOAJI_API_KEY` or `SHIOAJI_SECRET_KEY` values in application logs, error logs, or structured event payloads.

#### Scenario: Runtime error does not expose secrets
- **WHEN** a provider login or fetch error occurs
- **THEN** logs include diagnostic context without exposing secret values

#### Scenario: Structured logs keep secrets redacted
- **WHEN** backfill worker emits structured logs for execution stages
- **THEN** secret-bearing fields are absent or redacted

### Requirement: Structured execution logs include required operational fields
The system SHALL emit structured execution logs for backfill runtime with at least `job_id`, `job_type`, `code`, `chunk_cursor`, `status`, and `elapsed_ms`.

#### Scenario: Chunk execution log includes required fields
- **WHEN** a chunk starts, retries, succeeds, or fails
- **THEN** the corresponding structured log event includes all required operational fields

#### Scenario: Job lifecycle transitions are traceable from logs
- **WHEN** operators inspect logs for a job lifecycle
- **THEN** events can be correlated by required fields across lifecycle stages

### Requirement: Chunk retries and failure classification are explicit
The system SHALL retry retryable chunk failures with bounded exponential backoff and SHALL mark the job failed for non-retryable failures.

#### Scenario: Retryable chunk error is retried
- **WHEN** a transient provider timeout occurs for a chunk
- **THEN** the chunk is retried according to configured retry policy

#### Scenario: Non-retryable error fails the job
- **WHEN** an unrecoverable validation or configuration error occurs
- **THEN** the job is marked `failed` and error details are recorded

### Requirement: Backfill operations meet minimum SLO targets
The system SHALL target at least 95% successful daily chunk completion within 2 retries and SHALL update job heartbeat at most every 30 seconds while running.

#### Scenario: Chunk success ratio is measurable against target
- **WHEN** operators evaluate chunk execution outcomes over a reporting window
- **THEN** the measured daily chunk success rate can be compared against the 95% within-2-retries target

#### Scenario: Running job heartbeat remains fresh
- **WHEN** a job is in `running` state
- **THEN** `last_heartbeat_at` is updated within 30-second intervals
