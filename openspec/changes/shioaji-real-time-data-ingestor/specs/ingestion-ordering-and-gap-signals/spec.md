## ADDED Requirements

### Requirement: Ingestor SHALL provide per-stream transport ordering guarantees
For a single ingestor process, the service MUST preserve enqueue-to-write order for each Redis stream key and SHALL document that ordering is only guaranteed within the same stream key.

#### Scenario: Ordering guarantee holds within single stream key
- **WHEN** three events for `prod:stream:tick:MTX` are received and queued in order A, B, C
- **THEN** Redis stream entries for that key are written in A, B, C order

#### Scenario: Cross-stream global order is not guaranteed
- **WHEN** events are received concurrently for `prod:stream:tick:MTX` and `prod:stream:bidask:MTX`
- **THEN** the ingestor does not claim a single global ordering across the two stream keys

### Requirement: Ingestor SHALL emit gap-detection operational signals
The ingestor MUST emit signals required for downstream gap detection, including `event_ts`, `recv_ts`, reconnect counts, queue depth, ingest lag, and dropped-event counters.

#### Scenario: Event envelope carries timing signals
- **WHEN** an event is published to Redis stream
- **THEN** it includes both business time (`event_ts`) and receive time (`recv_ts`)

#### Scenario: Backpressure and reconnect signals are observable
- **WHEN** queue overflow or websocket reconnect events occur
- **THEN** corresponding metrics and logs are emitted for downstream and operations monitoring
