## ADDED Requirements

### Requirement: Spot150 Latest-State Processing
The system SHALL provide a dedicated latest-state worker that consumes spot stream events for the configured symbol set and maintains per-symbol latest state including `last_price`, `session_high`, `session_low`, `is_new_high`, `is_new_low`, and `updated_at`.

#### Scenario: Normal spot event updates symbol state
- **WHEN** a valid spot event arrives for a configured symbol
- **THEN** the worker updates the in-memory latest state for that symbol with recalculated high/low and update timestamp

### Requirement: Latest-State Worker Consumes Existing Spot Ingestion Contract
The system SHALL consume spot events from the existing ingestion stream contract (`{env}:stream:spot:{symbol}` with per-symbol monotonic `ingest_seq`) and SHALL not redefine upstream ingestion requirements in this change.

#### Scenario: Worker reads canonical spot stream key
- **WHEN** the latest-state worker is configured for symbol `2330` in environment `prod`
- **THEN** it reads from `prod:stream:spot:2330` and applies `ingest_seq` ordering/idempotency rules

### Requirement: Dirty-State Batched Redis Flush
The system SHALL track dirty symbols in memory and flush only changed symbol states to Redis in periodic batches using pipelined writes.

#### Scenario: Multiple updates for subset of symbols
- **WHEN** only a subset of configured symbols receives updates within a flush interval
- **THEN** the worker writes only dirty symbols to Redis and does not rewrite unchanged symbols

### Requirement: Latest-State ACK Semantics
The system SHALL ACK a spot message only after successful parse/validation, successful in-memory state update, and successful Redis flush or successful enqueue to an internal flush queue with equivalent durability semantics.

#### Scenario: Flush path fails
- **WHEN** in-memory update succeeds but Redis flush and flush-queue handoff both fail
- **THEN** the worker MUST NOT ACK the message and the message remains pending for reclaim/retry

### Requirement: Idempotent Replay by Symbol Sequence
The system SHALL enforce idempotent state progression for spot replay such that duplicate or older events for the same `symbol + ingest_seq` do not regress latest state.

#### Scenario: Duplicate ingest sequence is replayed
- **WHEN** an event with previously applied `symbol + ingest_seq` is delivered again
- **THEN** the worker does not regress the symbol latest state and the resulting Redis state remains unchanged
