## ADDED Requirements

### Requirement: Market-level ingest events SHALL be produced for TSE001
The system SHALL publish normalized market events for `TSE001` into Redis Stream key `{env}:stream:market:TSE001` by reusing the existing ingestion process.

#### Scenario: Ingestion publishes market event envelope
- **WHEN** a valid `TSE001` market feed event is received
- **THEN** the ingestion process SHALL publish an event containing `code`, `quote_type=market`, `event_ts`, `recv_ts`, and payload fields `index_value` and `cumulative_turnover`

### Requirement: Market summary worker SHALL consume via consumer groups
The worker SHALL consume market stream events using consumer-group semantics with pending recovery.

#### Scenario: Worker consumes and acknowledges successfully
- **WHEN** the worker reads or claims a valid stream entry
- **THEN** it SHALL process the entry and `XACK` only after successful state write and DB enqueue

### Requirement: Completion ratio and estimated turnover SHALL follow safe numeric rules
The worker SHALL compute market summary metrics using bounded completion ratio and divide-safe behavior.

#### Scenario: Completion ratio is within valid range
- **WHEN** elapsed trading time is computed from configured session boundaries
- **THEN** `completion_ratio` SHALL be clamped to `[0.0, 1.0]`

#### Scenario: Ratio is zero or negative
- **WHEN** `completion_ratio <= 0`
- **THEN** `estimated_turnover` SHALL be set to `null` and the worker SHALL NOT perform division

#### Scenario: Out-of-session semantics are deterministic
- **WHEN** event time is before trading start or after trading end
- **THEN** the worker SHALL keep state updates deterministic by freezing `completion_ratio` to boundary values and preserving divide-safe output behavior

### Requirement: Estimated turnover SHALL apply configurable adjustment factor
The worker SHALL apply a configurable adjustment factor in estimated turnover computation.

#### Scenario: Static factor is applied
- **WHEN** `MARKET_ADJUSTMENT_FACTOR` is configured
- **THEN** `estimated_turnover` SHALL be computed with that factor for all phase-1 events

### Requirement: Redis market-summary state SHALL use shared key convention
The worker SHALL persist latest and intraday series state using shared key format `{env}:state:{code}:{trade_date}:{suffix}`.

#### Scenario: Latest state write
- **WHEN** a market summary update is computed
- **THEN** the worker SHALL write latest JSON to `{env}:state:TSE001:{trade_date}:market_summary:latest`

#### Scenario: Intraday series append
- **WHEN** a market summary update is computed
- **THEN** the worker SHALL append a JSON snapshot to `{env}:state:TSE001:{trade_date}:market_summary:zset` using unix-seconds score

### Requirement: Minute snapshots SHALL be persisted with duplicate tolerance
The system SHALL persist minute-level snapshots into `market_summary_1m` with uniqueness `(market_code, minute_ts)` and duplicate-tolerant behavior.

#### Scenario: Minute rollover flush
- **WHEN** event-time minute changes from the currently buffered minute
- **THEN** the worker SHALL flush the prior minute snapshot to DB

#### Scenario: Duplicate minute insert during replay
- **WHEN** DB insert conflicts on `(market_code, minute_ts)`
- **THEN** the worker SHALL tolerate and skip the duplicate without failing the process

### Requirement: DB sink failures SHALL support retry and dead-letter
The worker SHALL retry DB sink writes and publish exhausted batches to a dead-letter stream.

#### Scenario: DB write retries exhausted
- **WHEN** a DB sink batch exceeds configured retry limit
- **THEN** the worker SHALL publish dead-letter entries containing error metadata and payload

### Requirement: Market summary observability SHALL use dedicated metric namespace
The system SHALL expose market-summary processing metrics with `market_summary_*` prefixes.

#### Scenario: Metrics emitted during normal processing
- **WHEN** worker processes events
- **THEN** it SHALL emit processed/lag/error/sink metrics under the `market_summary_*` namespace
