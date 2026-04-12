## ADDED Requirements

### Requirement: Serving SHALL expose independent market-summary REST endpoints
The system SHALL expose dedicated endpoints for market-summary reads under `/v1/market-summary/*`.

#### Scenario: Read latest market summary
- **WHEN** a client calls `GET /v1/market-summary/latest`
- **THEN** the API SHALL return the latest market summary state for the requested/default code

#### Scenario: Read intraday market summary range
- **WHEN** a client calls `GET /v1/market-summary/today` with an optional time range
- **THEN** the API SHALL return intraday market summary points from Redis state

#### Scenario: Read historical market summary range
- **WHEN** a client calls `GET /v1/market-summary/history` with a required time range
- **THEN** the API SHALL return minute snapshots from Postgres history

### Requirement: Serving responses SHALL normalize time format
Market-summary serving responses SHALL return timestamps in epoch milliseconds.

#### Scenario: Timestamp normalization
- **WHEN** latest, today, or history endpoints return timestamp fields
- **THEN** those timestamp fields SHALL be normalized to epoch ms

### Requirement: Market-summary SSE updates SHALL be independently named
Serving SSE SHALL emit market-summary updates using an independent event name.

#### Scenario: SSE pushes market summary change
- **WHEN** market-summary latest state changes
- **THEN** SSE SHALL emit event `market_summary_latest`

### Requirement: SSE failures SHALL be isolated per connection
The serving layer SHALL isolate market-summary SSE failures per client connection.

#### Scenario: Single client stream failure
- **WHEN** one SSE client connection fails or disconnects
- **THEN** other active SSE market-summary client connections SHALL continue unaffected

### Requirement: Market-summary serving SHALL enforce existing MVP guards
Market-summary endpoints SHALL enforce authentication, rate limiting, and explicit dependency-failure behavior.

#### Scenario: Unauthorized request
- **WHEN** request lacks valid authentication
- **THEN** API SHALL reject the request with authorization error

#### Scenario: Redis dependency failure
- **WHEN** Redis is unavailable for latest/today reads
- **THEN** API SHALL return `503` with `redis_unavailable`

#### Scenario: DB dependency failure
- **WHEN** Postgres is unavailable for history reads
- **THEN** API SHALL return `503` with `db_unavailable`
