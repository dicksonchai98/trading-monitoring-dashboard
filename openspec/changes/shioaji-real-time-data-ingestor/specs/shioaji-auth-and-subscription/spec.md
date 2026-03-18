## ADDED Requirements

### Requirement: Ingestor SHALL authenticate with Shioaji before opening subscriptions
The ingestion service MUST perform Shioaji login using configured credentials at startup before any market data subscription is attempted. If authentication fails, the service SHALL surface a structured error and retry according to reconnect policy.

#### Scenario: Startup authentication succeeds before subscribe
- **WHEN** the ingestor process starts with valid Shioaji credentials
- **THEN** it completes login successfully and only then starts contract subscriptions

#### Scenario: Startup authentication failure triggers retryable failure path
- **WHEN** the ingestor process starts with invalid or expired credentials
- **THEN** it does not subscribe, records an authentication failure signal, and enters retry flow

### Requirement: Ingestor SHALL manage subscription lifecycle for configured contracts
The ingestion service MUST subscribe to configured quote types and contract codes after successful login and MUST restore subscriptions after reconnect.

#### Scenario: Initial subscriptions are established from configuration
- **WHEN** login succeeds and contract configuration includes `tick` and `bidask` for a target code
- **THEN** the ingestor registers both subscriptions and starts receiving callbacks

#### Scenario: Subscriptions are restored after disconnect recovery
- **WHEN** websocket disconnect occurs and reconnect succeeds
- **THEN** the ingestor re-authenticates if required and re-subscribes all configured topics
