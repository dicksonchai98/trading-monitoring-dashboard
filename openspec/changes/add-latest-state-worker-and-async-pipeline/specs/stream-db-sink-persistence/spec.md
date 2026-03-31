## ADDED Requirements

### Requirement: Dedicated Tick and BidAsk DB Sink Workers
The system SHALL run dedicated sink workers for Tick and BidAsk persistence that consume persistence payloads from queue/stream handoff channels independent of main processing workers.

#### Scenario: Main worker continues during DB slowdown
- **WHEN** PostgreSQL write latency increases
- **THEN** Tick/BidAsk main workers continue consuming and ACKing messages based on handoff success without waiting for sink commit completion

### Requirement: Batched Persistent Writes with Retry
The sink workers SHALL batch insert/upsert payloads to PostgreSQL and SHALL retry failed writes with bounded backoff before dead-letter/quarantine handling.

#### Scenario: Transient database error
- **WHEN** a sink batch write fails with a transient PostgreSQL error
- **THEN** the sink worker retries the batch according to configured backoff policy and does not drop payloads silently

### Requirement: BidAsk Historical Persistence
The system SHALL persist BidAsk historical metrics to PostgreSQL in a dedicated schema/table that includes symbol, event timestamp, bid/ask core values, derived spread or midpoint values, and extensible metric payload content.

#### Scenario: BidAsk metrics are produced
- **WHEN** bidask-worker hands off a processed BidAsk payload
- **THEN** bidask-db-sink writes a historical record that can be queried by symbol and event time

### Requirement: Sink Observability
The system SHALL expose sink metrics for queue depth, batch size, write latency, retry count, and dead-letter count.

#### Scenario: Retry growth alerting input
- **WHEN** sink retries grow continuously above threshold
- **THEN** metrics and logs expose enough dimensions (worker, queue, error class) to trigger and diagnose operational alerts

