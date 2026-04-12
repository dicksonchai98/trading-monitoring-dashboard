## ADDED Requirements

### Requirement: Serving API Exposes Quote Latest State
The system SHALL expose an authenticated REST endpoint for quote latest feature state reads.

#### Scenario: Successful latest read
- **WHEN** an authenticated client requests `GET /v1/quote/latest` for a supported code
- **THEN** the API returns the latest quote feature payload from Redis latest state

#### Scenario: Redis unavailable for latest read
- **WHEN** Redis state backend is unavailable during latest read
- **THEN** the API returns `503` with `redis_unavailable`

### Requirement: Serving API Exposes Quote Intraday Second Series
The system SHALL expose an authenticated REST endpoint for quote intraday second-level series reads.

#### Scenario: Successful today range read
- **WHEN** an authenticated client requests `GET /v1/quote/today` with a valid time range
- **THEN** the API returns quote second snapshots from Redis zset within the requested range

### Requirement: Serving API Exposes Quote Minute History and Aggregates
The system SHALL expose authenticated REST endpoints for quote minute history and aggregate analytics backed by PostgreSQL.

#### Scenario: Successful history read
- **WHEN** an authenticated client requests `GET /v1/quote/history` with a valid range
- **THEN** the API returns rows from `quote_features_1m` in time order

#### Scenario: Successful aggregate read
- **WHEN** an authenticated client requests `GET /v1/quote/aggregates` with a valid range
- **THEN** the API returns aggregate values (`min`, `max`, `avg`, `last`, `count`) for both quote features

#### Scenario: DB unavailable for history/aggregates
- **WHEN** PostgreSQL is unavailable during history or aggregate reads
- **THEN** the API returns `503` with `db_unavailable`

### Requirement: Existing SSE Stream Emits Quote Latest Updates
The system SHALL extend existing `GET /v1/stream/sse` to emit `quote_latest` events when quote latest state changes.

#### Scenario: Quote state change triggers push
- **WHEN** quote latest state differs from last pushed quote payload for an active SSE connection
- **THEN** the server emits one `quote_latest` event with the updated payload

#### Scenario: No quote change avoids duplicate push
- **WHEN** quote latest state has not changed since last push
- **THEN** the server does not emit duplicate `quote_latest` events

### Requirement: Quote Serving Reuses Existing Access Controls
The system SHALL enforce the same authenticated serving access policy and limits for quote REST/SSE as existing serving endpoints.

#### Scenario: Unauthenticated request
- **WHEN** a client without valid auth token requests quote REST or SSE
- **THEN** the request is rejected with auth failure (`401`/`403` per existing authz contract)
