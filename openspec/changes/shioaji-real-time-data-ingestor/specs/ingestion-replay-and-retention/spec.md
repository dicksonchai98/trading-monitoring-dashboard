## ADDED Requirements

### Requirement: Ingestor SHALL provide bounded replay retention in Redis Streams
The ingestor MUST retain recent events in Redis Streams for short-term replay and MUST apply stream trimming to keep memory bounded.

#### Scenario: Retention window is maintained through stream history
- **WHEN** consumers restart after temporary failure
- **THEN** they can resume from stream IDs within the configured replay retention window

#### Scenario: Stream growth is bounded by trimming policy
- **WHEN** continuous high-frequency events are published
- **THEN** stream length is controlled by configured `MAXLEN` trimming and does not grow unbounded

### Requirement: Ingestor SHALL use performance-safe approximate MAXLEN trimming
Redis `XADD` writes MUST apply approximate trimming (`MAXLEN ~`) with environment-configurable limits targeting approximately three hours of replay under expected load.

#### Scenario: Approximate MAXLEN is applied on publish
- **WHEN** an event is written with stream retention enabled
- **THEN** the write call includes approximate `MAXLEN` trimming parameters

#### Scenario: Retention tuning can vary by environment
- **WHEN** deployment configuration differs between non-prod and prod environments
- **THEN** each environment uses its configured retention limit without code changes
