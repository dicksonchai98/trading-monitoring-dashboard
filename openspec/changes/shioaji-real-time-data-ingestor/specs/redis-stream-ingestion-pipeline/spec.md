## ADDED Requirements

### Requirement: Ingestor SHALL decouple callbacks from Redis writes using queue-writer pipeline
The ingestor MUST enqueue callback events into an internal bounded FIFO queue and MUST use a dedicated writer task to publish events to Redis Streams. Callback handlers MUST NOT perform blocking Redis I/O.

#### Scenario: Callback path remains non-blocking
- **WHEN** a Shioaji callback event is received
- **THEN** the callback only performs enqueue operations and does not execute Redis write operations directly

#### Scenario: Writer publishes queued events in enqueue order
- **WHEN** multiple events are queued for the same stream key
- **THEN** the writer publishes them to Redis in FIFO dequeue order

### Requirement: Ingestor SHALL publish normalized envelope events to Redis stream namespace
Each published event MUST include envelope fields `source`, `code`, `quote_type`, `event_ts`, and `recv_ts`, and MUST be written to stream key format `{env}:stream:{quote_type}:{code}`.

#### Scenario: Tick event is published to correct namespaced stream
- **WHEN** a tick callback is received for contract code `MTX` in `prod` environment
- **THEN** the event is published to `prod:stream:tick:MTX` with required envelope fields

#### Scenario: Bidask event is published to correct namespaced stream
- **WHEN** a bidask callback is received for contract code `MTX` in `prod` environment
- **THEN** the event is published to `prod:stream:bidask:MTX` with required envelope fields
