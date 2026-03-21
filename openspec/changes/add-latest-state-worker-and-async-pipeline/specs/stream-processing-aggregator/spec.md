## MODIFIED Requirements

### Requirement: Persist completed K bars
The aggregator SHALL hand off each completed 1-minute K bar to the Tick DB sink path and SHALL decouple final Postgres commit from the main Tick consume loop.

#### Scenario: Bar persistence handoff
- **WHEN** a 1-minute bar is archived
- **THEN** the bar is enqueued to the Tick DB sink path for batched Postgres persistence

### Requirement: At-least-once processing with ACK after required writes
The aggregator SHALL ACK stream entries only after required in-loop processing succeeds and persistence handoff succeeds, without waiting for final sink commit.

#### Scenario: Tick entry ACKs after Redis and sink handoff
- **WHEN** a tick entry's Redis state write succeeds and Tick DB sink handoff succeeds
- **THEN** the entry is ACKed in the consumer group

#### Scenario: Bidask entry ACKs after Redis and sink handoff
- **WHEN** a bidask entry's Redis state writes succeed and BidAsk DB sink handoff succeeds
- **THEN** the entry is ACKed in the consumer group

### Requirement: Do not ACK on write failure
The aggregator SHALL NOT ACK a stream entry if critical Redis writes fail or sink handoff fails, and SHALL leave the entry pending for reclaim/retry.

#### Scenario: Redis failure preserves pending
- **WHEN** a stream entry processing path encounters Redis write failure
- **THEN** the entry is not ACKed and remains pending

#### Scenario: Sink handoff failure preserves pending
- **WHEN** a stream entry processing path cannot enqueue payload to DB sink handoff
- **THEN** the entry is not ACKed and remains pending
