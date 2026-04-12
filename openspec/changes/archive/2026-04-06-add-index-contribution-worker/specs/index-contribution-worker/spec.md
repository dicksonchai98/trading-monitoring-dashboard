## ADDED Requirements

### Requirement: Worker SHALL compute symbol contribution points for TSE001 constituents
The system SHALL consume spot latest updates and compute `contribution_points` for `TSE001` constituent symbols using the configured index previous close and daily constituent weight table.

#### Scenario: Compute contribution for valid constituent update
- **WHEN** a spot latest event arrives for a symbol in the current `TSE001` constituent universe with valid `last_price`, `prev_close`, `weight`, and `index_prev_close`
- **THEN** the worker computes contribution as `index_prev_close * weight * ((last_price / prev_close) - 1)`
- **THEN** the worker updates in-memory symbol state with computed values and `updated_at`

#### Scenario: Skip invalid contribution update
- **WHEN** required inputs are missing or invalid (`prev_close <= 0`, missing `weight`, `weight < 0` or `weight > 1`, missing `index_prev_close`, or missing `last_price`)
- **THEN** the worker MUST skip contribution update for that symbol event
- **THEN** the worker MUST continue processing subsequent events

### Requirement: Worker SHALL enforce deterministic event ordering and idempotency
The system SHALL prevent duplicate and stale events from mutating attribution state.

#### Scenario: Duplicate event is ignored
- **WHEN** an event with the same `event_id` (or fallback idempotency key `(symbol, updated_at)`) has already been processed
- **THEN** the worker MUST ignore the duplicate event
- **THEN** no ranking or sector aggregate mutation occurs

#### Scenario: Stale event is dropped
- **WHEN** an event arrives with `updated_at` less than or equal to the current symbol state's `updated_at`
- **THEN** the worker MUST drop the event as stale
- **THEN** the current symbol/ranking/sector states remain unchanged

### Requirement: Worker SHALL maintain real-time top/bottom rankings and sector aggregates
The system SHALL maintain top-20 positive and bottom-20 negative rankings and sector-level contribution totals from current symbol state.

#### Scenario: Ranking is refreshed after accepted update
- **WHEN** a valid non-stale constituent event is accepted
- **THEN** the worker MUST refresh top/bottom ranking structures
- **THEN** ranking ties MUST be resolved by `symbol` ascending order after contribution sorting

#### Scenario: Sector totals use delta update
- **WHEN** a symbol contribution value changes from old to new
- **THEN** the worker MUST update sector total via delta (`sector_total = sector_total - old + new`)
- **THEN** sector aggregate MUST not double count repeated symbol updates

### Requirement: Worker SHALL enforce sector source priority
The system SHALL resolve `sector` from configured internal sector mapping as source of truth, and fallback to weight-table sector only when mapping is missing.

#### Scenario: Sector is resolved from mapping first
- **WHEN** both internal mapping sector and weight-table sector are available for a symbol
- **THEN** the worker MUST use the internal mapping sector value
- **THEN** symbol and sector-aggregate states MUST use the same resolved sector

#### Scenario: Sector falls back to weight table when mapping is unavailable
- **WHEN** internal mapping does not provide sector for a symbol and weight table provides sector
- **THEN** the worker MUST use the weight-table sector value as fallback
- **THEN** the symbol update MUST continue without rejection due to missing mapping

### Requirement: Worker SHALL enforce numeric precision for contribution values
The system SHALL use deterministic numeric precision for persisted contribution values to avoid rounding drift across snapshots and serving layers.

#### Scenario: Contribution persistence rounds to six decimal places
- **WHEN** contribution points are computed for accepted events
- **THEN** persisted `contribution_points` values MUST be rounded to 6 decimal places
- **THEN** repeated computation for the same inputs MUST produce the same persisted value

### Requirement: Worker SHALL publish real-time attribution state to Redis
The system SHALL write real-time symbol latest, ranking, and sector aggregate states to Redis for serving.

#### Scenario: Symbol latest state is written
- **WHEN** an accepted constituent event updates symbol attribution state
- **THEN** the worker MUST write `{env}:state:index_contrib:TSE001:{trade_date}:{symbol}:latest`
- **THEN** stored payload MUST include symbol identity, sector, prices, weight, contribution points, and `updated_at`

#### Scenario: Ranking and sector states are updated
- **WHEN** ranking or sector aggregate changes
- **THEN** the worker MUST update Redis ranking keys for top and bottom sets and the sector aggregate key
- **THEN** Redis state SHOULD retain only top 20 entries for each ranking set

### Requirement: Worker SHALL persist minute-boundary attribution snapshots
The system SHALL persist minute snapshots for symbol, ranking, and sector layers using minute-boundary writes.

#### Scenario: Minute flush writes three snapshot layers
- **WHEN** minute boundary is reached in trading timezone (`Asia/Taipei`)
- **THEN** the worker MUST write symbol snapshots to `index_contribution_snapshot_1m`
- **THEN** the worker MUST write ranking snapshots to `index_contribution_ranking_1m`
- **THEN** the worker MUST write sector snapshots to `sector_contribution_snapshot_1m`

#### Scenario: Snapshot persistence is idempotent by primary key
- **WHEN** a minute flush is retried for the same primary keys
- **THEN** writes MUST use upsert semantics
- **THEN** duplicate rows for the same PK MUST NOT be created

#### Scenario: Late event does not rewrite historical minute snapshot by default
- **WHEN** an accepted event arrives after its event-time minute boundary has already been flushed
- **THEN** the worker MUST NOT rewrite prior minute snapshot rows by default
- **THEN** the event only affects current real-time state and subsequent minute snapshots

### Requirement: Worker SHALL support startup, daily reset, and warm restart recovery
The system SHALL initialize required inputs before market processing and define recovery behavior for restarts.

#### Scenario: Pre-session startup loads required daily inputs
- **WHEN** worker starts before trading session
- **THEN** it MUST load daily constituent weights, sector mapping, and index previous close before event processing
- **THEN** it MUST initialize empty in-memory symbol/ranking/sector states

#### Scenario: Warm restart rebuilds state before consuming stream
- **WHEN** worker restarts during trading session
- **THEN** it MUST attempt state rebuild from Redis latest keys first
- **THEN** if Redis is insufficient, it MUST fallback to latest DB minute snapshot before resuming real-time consumption

#### Scenario: Daily reset clears state and reloads daily inputs
- **WHEN** trade date rolls over to a new trading day
- **THEN** the worker MUST clear in-memory symbol, ranking, and sector states
- **THEN** the worker MUST reload daily weights, sector mapping, and index previous close before accepting new-day events

### Requirement: Worker SHALL isolate failures and expose observability metrics
The system SHALL continue processing despite symbol-level failures and expose operational metrics for reliability.

#### Scenario: Symbol-level processing failure does not block worker loop
- **WHEN** a single symbol event processing fails
- **THEN** the worker MUST log the failure and skip that event
- **THEN** the worker MUST continue subsequent event processing

#### Scenario: Redis/DB write failures are retried and measured
- **WHEN** Redis write or minute DB flush fails
- **THEN** the worker MUST apply configured retry policy and record retry/failure metrics
- **THEN** repeated failure beyond threshold MUST trigger operational alerting

### Requirement: Worker SHALL remain API-independent
The worker SHALL not expose HTTP APIs directly and SHALL only produce attribution state/snapshots for downstream serving layers.

#### Scenario: Worker runtime has no direct HTTP route registration
- **WHEN** the worker process is started
- **THEN** no HTTP API routes are registered by this worker module
- **THEN** attribution data is exposed only via Redis and snapshot tables for separate serving components
