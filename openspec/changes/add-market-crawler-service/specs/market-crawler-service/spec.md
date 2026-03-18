## ADDED Requirements

### Requirement: Crawler Runtime Isolation
The system SHALL execute market crawler workloads in a dedicated `crawler-worker` process that is isolated from the API request thread and realtime ingestion/SSE path.

#### Scenario: Crawler job is triggered from admin API
- **WHEN** an admin requests a crawler run
- **THEN** the API SHALL persist a job request and return without executing crawl stages inline

#### Scenario: Crawler failure occurs during batch run
- **WHEN** a crawler job fails in any execution stage
- **THEN** realtime ingestion and SSE delivery SHALL remain unaffected

### Requirement: Canonical Crawler Pipeline
The system SHALL execute crawler logic in canonical stage order: `Job Orchestrator -> Fetcher -> Parser -> Normalizer -> Validator -> Persistence`.

#### Scenario: Single-date crawler execution
- **WHEN** a valid dataset code and target date are submitted
- **THEN** the worker SHALL execute all canonical stages in order and persist final status

#### Scenario: Validation fails for normalized records
- **WHEN** validator detects invalid normalized records
- **THEN** persistence SHALL NOT write invalid records and job status SHALL be marked as failed

### Requirement: Crawler Observability Baseline
The system SHALL emit structured logs and metrics for crawler executions with stable field and metric names.

#### Scenario: Stage execution is logged
- **WHEN** any crawler stage runs
- **THEN** logs SHALL include `job_id`, `dataset_code`, `source_name`, `target_date`, `execution_stage`, `parser_version`, `rows_fetched`, `rows_normalized`, `rows_persisted`, and `retry_count`

#### Scenario: Metrics are published for crawler jobs
- **WHEN** crawler jobs execute
- **THEN** the system SHALL publish `crawler_job_duration_seconds`, `crawler_job_failures_total`, `crawler_rows_fetched_total`, `crawler_rows_normalized_total`, `crawler_rows_persisted_total`, `crawler_retry_count_total`, and `crawler_stage_duration_seconds`
