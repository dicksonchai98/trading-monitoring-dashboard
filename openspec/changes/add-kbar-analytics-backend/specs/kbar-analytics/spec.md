## ADDED Requirements

### Requirement: Daily k-bar features are materialized before analytics
The system SHALL build and persist daily-level k-bar features from intraday input data before computing analytics.

#### Scenario: Daily feature build succeeds
- **WHEN** the analytics pipeline runs for a code/date range
- **THEN** the system materializes `kbar_daily_features` rows keyed by `(code, trade_date)`

### Requirement: Event analytics include traceable sample records
The system SHALL persist per-event sample rows that map each detected event day to its next-trade-day outcome.

#### Scenario: Event sample is traceable
- **WHEN** an event condition matches on a trade date
- **THEN** the system stores a `kbar_event_samples` row containing event-day values and next-day outcomes

### Requirement: Event statistics are versioned and reproducible
The system SHALL persist aggregated event statistics as versioned records for a given event/code/date-window.

#### Scenario: Event stats recomputed
- **WHEN** event stats are recomputed for the same event/code/window
- **THEN** the system writes a new versioned `kbar_event_stats` record and preserves prior versions

### Requirement: Distribution analytics are aggregated and versioned
The system SHALL compute and store aggregated distribution statistics for supported metrics, including percentiles and histogram payload.

#### Scenario: Distribution stats computed
- **WHEN** distribution computation runs for a metric/code/window
- **THEN** the system stores `kbar_distribution_stats` with mean/percentiles and `histogram_json`

### Requirement: Event outcome categorization is deterministic
The system SHALL apply deterministic category rules for next-day outcomes.

#### Scenario: Category assignment
- **WHEN** `next_day_return` is greater than 0
- **THEN** `next_day_category` is `up`

#### Scenario: Category assignment down
- **WHEN** `next_day_return` is less than 0
- **THEN** `next_day_category` is `down`

#### Scenario: Category assignment flat
- **WHEN** `next_day_return` equals 0
- **THEN** `next_day_category` is `flat`

### Requirement: Analytics registries are discoverable through API
The system SHALL expose supported event and metric registries through dedicated read endpoints.

#### Scenario: Query event registry
- **WHEN** a client requests `GET /analytics/events`
- **THEN** the system returns the canonical event IDs and definitions

#### Scenario: Query metric registry
- **WHEN** a client requests `GET /analytics/metrics`
- **THEN** the system returns the supported analytics metric IDs

### Requirement: Event samples API supports bounded result retrieval
The system SHALL require bounded retrieval for samples via filter and pagination parameters.

#### Scenario: Paginated sample read
- **WHEN** a client requests event samples with `page` and `page_size`
- **THEN** the system returns only the requested page in deterministic sort order

### Requirement: Async analytics jobs are externally triggerable
The system SHALL provide async job trigger endpoints for feature rebuild and analytics recomputation.

#### Scenario: Job trigger accepted
- **WHEN** a client posts a valid analytics job trigger request
- **THEN** the system responds with `202 Accepted` and a `job_id`

### Requirement: Analytics worker lifecycle and retry behavior are explicit
The system SHALL track job status transitions and support retryable, idempotent execution.

#### Scenario: Job status transition
- **WHEN** a queued job starts execution
- **THEN** status transitions from `pending` to `running`

#### Scenario: Retry-safe rerun
- **WHEN** a failed job is retried with the same payload
- **THEN** recomputation remains idempotent and final persisted records are consistent

### Requirement: Invalid analytics queries fail deterministically
The system SHALL return deterministic validation errors for unsupported IDs or invalid query parameters.

#### Scenario: Unknown event ID
- **WHEN** a client requests stats for an unsupported `event_id`
- **THEN** the system returns `404`

#### Scenario: Invalid query parameters
- **WHEN** a client provides invalid date range or pagination values
- **THEN** the system returns `400`
