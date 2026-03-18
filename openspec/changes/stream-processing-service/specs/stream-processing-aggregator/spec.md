## ADDED Requirements

### Requirement: Consume tick and bidask streams
The aggregator SHALL consume tick and bidask Redis Streams using consumer groups and maintain independent consumers for each stream type.

#### Scenario: Stream consumption starts
- **WHEN** the service starts
- **THEN** it reads pending entries for each stream consumer group and then begins reading new entries

### Requirement: Compute 1-minute K bars
The aggregator SHALL compute 1-minute K bars from tick events and archive a completed bar when the minute changes.

#### Scenario: Minute boundary archives a bar
- **WHEN** a tick event arrives with a minute greater than the current bar minute
- **THEN** the current bar is archived and a new bar is initialized

### Requirement: Drop late or invalid events
The aggregator SHALL drop tick events whose event_ts is earlier than the current minute and SHALL drop events with missing or malformed event_ts.

#### Scenario: Late tick event
- **WHEN** a tick event arrives with event_ts earlier than the current minute
- **THEN** the event is dropped and a late_tick_drops metric is incremented

### Requirement: Persist completed K bars
The aggregator SHALL persist each completed 1-minute K bar to Postgres.

#### Scenario: Bar persistence
- **WHEN** a 1-minute bar is archived
- **THEN** it is written to the kbars_1m table in Postgres

### Requirement: At-least-once processing with ACK after required writes
The aggregator SHALL ACK stream entries only after all required writes for that stream entry succeed.

#### Scenario: Tick entry ACKs after Redis and Postgres
- **WHEN** a tick entry's Redis state and Postgres writes succeed
- **THEN** the entry is ACKed in the consumer group

#### Scenario: Bidask entry ACKs after Redis
- **WHEN** a bidask entry's Redis state writes succeed
- **THEN** the entry is ACKed in the consumer group

### Requirement: Do not ACK on write failure
The aggregator SHALL NOT ACK a stream entry if Redis or Postgres writes fail and SHALL leave the entry pending for retry.

#### Scenario: Write failure preserves pending
- **WHEN** Redis or Postgres write fails for a stream entry
- **THEN** the entry is not ACKed and remains pending

### Requirement: Reclaim idle pending entries with configured parameters
The aggregator SHALL reclaim idle pending entries using XAUTOCLAIM with configurable idle_ms and claim_count parameters.

#### Scenario: Pending reclaim uses configured thresholds
- **WHEN** pending entries exceed idle_ms
- **THEN** the service reclaims up to claim_count entries via XAUTOCLAIM

### Requirement: Trading day boundary rules
The aggregator SHALL compute trade_date using Asia/Taipei time where event_ts.time >= 15:00 uses the current date and otherwise uses the prior date.

#### Scenario: Trade date before 15:00
- **WHEN** a tick event has event_ts at 09:30 Asia/Taipei
- **THEN** trade_date is set to the prior date

### Requirement: Emit processing metrics
The aggregator SHALL emit observability metrics including consume_rate, archive_rate, sampling_rate, stream_lag, write_errors, write_latency, and late_tick_drops.

#### Scenario: Metrics emission
- **WHEN** the service is running
- **THEN** the metrics are reported on the configured interval
