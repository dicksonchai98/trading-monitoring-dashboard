## ADDED Requirements

### Requirement: Independent Tick and BidAsk Worker Runtime
The system SHALL run Tick and BidAsk stream processing in separate worker services with isolated consumer loops, configuration, and failure domains.

#### Scenario: Tick worker failure does not halt BidAsk processing
- **WHEN** `tick-worker` crashes or is restarted
- **THEN** `bidask-worker` continues consuming and processing BidAsk stream messages without dependency on Tick worker availability

### Requirement: ACK After Critical State and Sink Handoff
The system SHALL ACK Tick/BidAsk stream messages only after successful message processing, successful critical Redis state write, and successful enqueue/handoff of persistence payload to the corresponding DB sink queue.

#### Scenario: Redis state write fails
- **WHEN** a Tick or BidAsk message is processed but Redis state write fails
- **THEN** the worker MUST NOT ACK the message and the message remains pending for reclaim/retry

#### Scenario: Sink handoff fails
- **WHEN** a Tick or BidAsk message is processed and Redis write succeeds but sink queue handoff fails
- **THEN** the worker MUST NOT ACK the message and MUST treat the message as retryable

### Requirement: Main Processing Loop Non-Blocking Behavior
The system SHALL prevent blocking I/O in Tick/BidAsk critical consume loops by using async clients or bounded async wrappers, and SHALL yield control cooperatively on each loop iteration.

#### Scenario: Processed iteration still yields
- **WHEN** the worker processes one or more messages in an iteration
- **THEN** the loop yields control before the next iteration to preserve scheduler fairness

