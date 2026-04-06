## ADDED Requirements

### Requirement: Quote Worker Consumes Quote Streams Reliably
The system SHALL run a dedicated quote worker that consumes quote events from Redis Streams using consumer groups and pending reclaim semantics.

#### Scenario: Pending entries are reclaimed before new reads
- **WHEN** quote worker starts or iterates consume loop
- **THEN** it reclaims idle pending entries via `XAUTOCLAIM` before reading new entries via `XREADGROUP`

### Requirement: Quote ACK Happens After Critical Path Success
The system SHALL ACK quote stream entries only after successful feature computation, successful Redis quote state write, and successful DB sink handoff.

#### Scenario: Redis state write failure
- **WHEN** quote feature computation succeeds but Redis latest/zset write fails
- **THEN** the worker MUST NOT ACK the entry and the message remains pending for retry/reclaim

#### Scenario: Sink handoff failure
- **WHEN** quote feature computation and Redis write succeed but minute snapshot handoff fails
- **THEN** the worker MUST NOT ACK the entry and the message remains retryable

### Requirement: Quote Features Are Aggregated at 1-Second Cadence
The system SHALL aggregate quote events into 1-second snapshots for phase-1 features `main_chip` and `long_short_force`, including day high/low and strength values.

#### Scenario: Second boundary emits snapshot
- **WHEN** quote events are accumulated within a second bucket and second boundary is reached
- **THEN** the worker emits one snapshot containing `main_chip`, `long_short_force`, corresponding day highs/lows, and strengths

### Requirement: Minute Snapshot Persistence Uses Last-Second Semantics
The system SHALL persist the last emitted second snapshot of each minute to `quote_features_1m`.

#### Scenario: Minute has emitted snapshots
- **WHEN** minute boundary is reached and at least one second snapshot exists in that minute
- **THEN** the worker persists the latest second snapshot for that minute to `quote_features_1m`

#### Scenario: Minute has no emitted snapshots
- **WHEN** minute boundary is reached and no second snapshot exists in that minute
- **THEN** the worker skips DB write for that minute

### Requirement: Quote DB Sink Retries and Dead-Letters on Terminal Failure
The system SHALL retry quote minute snapshot DB writes with bounded backoff and dead-letter failed payloads after retry exhaustion.

#### Scenario: Transient DB failure
- **WHEN** a quote snapshot batch write fails with a transient DB error
- **THEN** the worker retries according to configured retry/backoff policy

#### Scenario: Retry limit exceeded
- **WHEN** a quote snapshot batch continues failing beyond retry limit
- **THEN** the worker writes failed payloads to a quote dead-letter stream and continues processing
