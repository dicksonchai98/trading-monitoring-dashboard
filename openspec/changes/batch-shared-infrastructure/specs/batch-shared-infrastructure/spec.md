## ADDED Requirements

### Requirement: Shared batch runtime module
The system SHALL provide a shared batch runtime module that can be used by batch workers
to execute job pipelines with consistent lifecycle handling, retries, progress tracking, logging,
configuration loading, and DB helper utilities.

#### Scenario: Worker runs a batch job using shared runtime
- **WHEN** a batch worker initializes a job pipeline
- **THEN** the worker executes the pipeline through the shared runtime interface

### Requirement: Standardized job lifecycle states
The shared batch runtime SHALL manage job lifecycle states including CREATED, RUNNING,
COMPLETED, and FAILED, and SHALL persist these states for auditability.

#### Scenario: Job state transitions are recorded
- **WHEN** a job transitions between lifecycle states
- **THEN** the new state is persisted with timestamps

### Requirement: Retry policy with backoff
The shared batch runtime SHALL support configurable retry policies with exponential backoff
for recoverable failures.

#### Scenario: Recoverable failure triggers retry
- **WHEN** a recoverable error occurs during job execution
- **THEN** the runtime retries the job according to the configured policy

### Requirement: Progress tracking
The shared batch runtime SHALL record job progress metrics such as rows processed,
chunks processed, or percentage completion.

#### Scenario: Progress updates during long-running jobs
- **WHEN** a long-running job advances its work
- **THEN** the runtime updates progress metrics for the job

### Requirement: Structured logging
The shared batch runtime SHALL emit structured logs containing job_id, job_type,
execution stage, and error details when applicable.

#### Scenario: Error is logged with job context
- **WHEN** a job execution error occurs
- **THEN** the error is logged with job_id and execution stage

### Requirement: Shared configuration loading
The shared batch runtime SHALL load configuration from environment variables and
configuration files to support consistent deployment.

#### Scenario: Runtime loads configuration on startup
- **WHEN** a worker starts
- **THEN** the runtime loads configuration values from the supported sources

### Requirement: Shared DB helper utilities
The shared batch runtime SHALL provide DB helpers for connection management, transactions,
bulk insert, and upsert operations.

#### Scenario: Job uses shared upsert helper
- **WHEN** a job writes data that may already exist
- **THEN** the runtime upsert helper writes without creating duplicates

### Requirement: Shared module layout
The system SHALL implement the shared batch runtime under `backend/modules/batch_shared/` with
submodules `config/`, `runtime/`, `jobs/`, `retry/`, `logging/`, `metrics/`, `database/`,
and `repositories/`.

#### Scenario: Shared runtime modules are discoverable
- **WHEN** a batch worker imports shared runtime components
- **THEN** the module paths resolve under `backend/modules/batch_shared/`

### Requirement: Worker startup flow
The shared runtime SHALL initialize in the following order: load configuration, initialize
logger, initialize database session, register job implementations, start worker loop.

#### Scenario: Worker starts with shared runtime
- **WHEN** a worker process starts
- **THEN** it executes the standardized startup flow before processing jobs

### Requirement: Job repository interface
The shared repository layer SHALL provide `JobRepository` methods including `create_job`,
`mark_running`, `mark_completed`, `mark_failed`, and `update_progress`.

#### Scenario: Job runner updates lifecycle state
- **WHEN** a job transitions state
- **THEN** the job runner calls the corresponding `JobRepository` method

### Requirement: Job tracking table schema
The system SHALL persist job lifecycle state in a `batch_jobs` table with fields: `id`, `job_type`,
`status`, `created_at`, `started_at`, `finished_at`, `retry_count`, `rows_processed`,
`error_message`, and `metadata_json`, and SHALL index `status`, `job_type`, and `created_at`.

#### Scenario: Job record is created with required fields
- **WHEN** a job is created
- **THEN** the `batch_jobs` record includes the required fields

### Requirement: Metrics emission
The shared runtime SHALL emit metrics including `batch_job_duration_seconds`,
`batch_job_failures_total`, `batch_rows_processed_total`, and `batch_retry_count_total`.

#### Scenario: Metrics are emitted for completed job
- **WHEN** a job completes or fails
- **THEN** the runtime emits the corresponding metrics

### Requirement: Structured logging fields
The shared runtime SHALL include `job_id`, `job_type`, `execution_stage`, `elapsed_time`,
and `error_message` in structured logs when applicable.

#### Scenario: Structured log includes elapsed time
- **WHEN** a job stage completes
- **THEN** the log record includes `elapsed_time` and job context

### Requirement: Error classification
The shared runtime SHALL classify errors into network, source format, validation, and persistence
errors to determine retry vs. fail behavior.

#### Scenario: Non-recoverable error is not retried
- **WHEN** a validation or source format error occurs
- **THEN** the runtime marks the job failed without retrying
