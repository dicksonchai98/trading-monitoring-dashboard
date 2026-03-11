## ADDED Requirements

### Requirement: Single-Date Job Execution Contract
The system SHALL support single-date execution using `dataset_code + target_date` as the primary execution key.

#### Scenario: Valid single-date run request
- **WHEN** a run request includes a valid dataset code and target date
- **THEN** the system SHALL create a job record, execute crawler stages, and persist final job status with row counters

### Requirement: Range Backfill Parent-Child Tracking
The system SHALL support date-range backfill by decomposing range requests into per-date jobs with one parent job/correlation id.

#### Scenario: Range backfill request is accepted
- **WHEN** admin submits a range backfill request
- **THEN** the system SHALL create one parent range job and child jobs for each date in range

#### Scenario: Query range progress
- **WHEN** operator queries by parent job id or correlation id
- **THEN** the system SHALL return aggregated range progress and per-date child statuses

### Requirement: Deterministic Failure Classification and Retry
The system SHALL classify crawler failures into retryable and non-retryable categories and enforce retry rules per run context.

#### Scenario: Transient network failure in fetch stage
- **WHEN** fetch stage receives transient timeout or HTTP 5xx
- **THEN** the system SHALL retry with exponential backoff up to configured max attempts in the same run context

#### Scenario: Publication not ready during publication window
- **WHEN** payload is fetch-successful but classified as not ready
- **THEN** the system SHALL classify as `publication_not_ready` and retry only within configured publication windows

#### Scenario: Parser schema mismatch
- **WHEN** parser or validation detects schema-breaking payload mismatch
- **THEN** the system SHALL fail fast without blind retry and persist failure category/stage
