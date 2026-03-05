## ADDED Requirements

### Requirement: External read access is provided via REST
The system SHALL expose REST endpoints that provide read access to near-month market data for external users.

#### Scenario: Successful REST read
- **WHEN** a client requests a supported read endpoint with a valid instrument code
- **THEN** the system responds with the requested data in the defined response schema

### Requirement: Realtime updates are provided via SSE
The system SHALL provide a Server-Sent Events (SSE) endpoint that streams realtime updates for near-month market data.

#### Scenario: Successful SSE stream
- **WHEN** a client opens an SSE connection for a supported instrument code
- **THEN** the system streams update events and periodic heartbeats

### Requirement: Serving reads are state-based
The serving layer SHALL read from Redis state for intraday data and Postgres for historical data.

#### Scenario: Intraday read uses Redis state
- **WHEN** a client requests intraday data
- **THEN** the system reads from Redis state and returns the result

### Requirement: Serving is read-only and separated from compute
The serving layer SHALL not compute metrics or read event streams directly.

#### Scenario: Serving does not read streams
- **WHEN** the serving layer processes a client request
- **THEN** it reads only state stores and does not consume event streams

### Requirement: SSE pushes only on state change
The SSE pipeline SHALL emit updates only when the underlying state changes.

#### Scenario: No change, no push
- **WHEN** the polled state has not changed since the last check
- **THEN** no update event is emitted

### Requirement: SSE includes periodic heartbeats
The SSE pipeline SHALL emit heartbeat events at a fixed interval to keep connections alive.

#### Scenario: Heartbeat emitted
- **WHEN** an SSE connection is open and no state change occurs
- **THEN** the system emits a heartbeat event at the configured interval

### Requirement: MVP safety controls are enforced
The system SHALL enforce basic rate limiting and CORS allowlists for external access.

#### Scenario: Rate limit enforced
- **WHEN** a client exceeds the allowed request rate
- **THEN** the system returns a rate limit error response

### Requirement: Time range queries use a consistent parameter format
The system SHALL support time range queries using a consistent from/to format (from_ms/to_ms or ISO) across endpoints.

#### Scenario: Valid time range request
- **WHEN** a client provides from/to parameters in the supported format
- **THEN** the system returns data limited to the requested range

### Requirement: Safe defaults limit response size
The system SHALL apply safe default limits when time range parameters are omitted.

#### Scenario: Missing time range parameters
- **WHEN** a client omits from/to parameters on a range endpoint
- **THEN** the system returns a bounded default window to avoid excessive payloads

### Requirement: Response schemas are consistent and time formats unified
The system SHALL return consistent response schemas and a unified time format (epoch ms or ISO) across serving endpoints.

#### Scenario: Consistent response format
- **WHEN** a client calls multiple serving endpoints
- **THEN** the responses use the same schema conventions and time format

### Requirement: Availability behavior is explicit under dependency failure
The system SHALL return clear errors when Redis or Postgres is unavailable and define SSE behavior during dependency outages.

#### Scenario: Redis unavailable during request
- **WHEN** Redis is unavailable for an intraday request
- **THEN** the system returns a clear error response indicating dependency failure

### Requirement: Minimal observability is provided
The system SHALL expose minimal serving metrics including REST latency, active SSE connections, SSE push rate, and Redis/DB error rates.

#### Scenario: Metrics available
- **WHEN** an operator queries the metrics endpoint
- **THEN** the required serving metrics are reported
