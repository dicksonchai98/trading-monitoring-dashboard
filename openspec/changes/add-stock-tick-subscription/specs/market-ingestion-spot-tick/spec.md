## ADDED Requirements

### Requirement: Spot symbol registry MUST be config-driven and validated at startup
The system MUST load spot symbols from a runtime-configured file path and MUST validate the symbol list before enabling spot ingestion. Validation MUST enforce non-empty list, unique symbols, symbol format `^\d{4}$`, and expected symbol count constraints.

#### Scenario: Valid symbol registry enables spot ingestion
- **WHEN** the symbol file exists, symbols are unique 4-digit codes, and count satisfies configured expectation
- **THEN** the system SHALL enable spot ingestion with the loaded symbol set

#### Scenario: Invalid symbol registry in required mode fails startup
- **WHEN** spot ingestion is configured as required and symbol validation fails
- **THEN** the system SHALL fail startup instead of running with an invalid spot configuration

#### Scenario: Invalid symbol registry in optional mode disables spot path
- **WHEN** spot ingestion is configured as optional and symbol validation fails
- **THEN** the system SHALL disable only the spot ingestion path and keep futures ingestion available

### Requirement: Spot tick events MUST follow a per-symbol stream contract
The system MUST publish spot tick events that include `symbol`, `event_ts` (ISO8601 UTC), `last_price`, `source`, and per-symbol monotonic `ingest_seq`. Spot stream keys MUST follow `{env}:stream:spot:{symbol}`.

#### Scenario: Published spot event contains required contract fields
- **WHEN** a spot tick is ingested for a configured symbol
- **THEN** the published event SHALL include all required fields with valid types and format

#### Scenario: Per-symbol ordering anchor is preserved
- **WHEN** multiple ticks for the same symbol are published in sequence
- **THEN** `ingest_seq` SHALL increase monotonically for that symbol

### Requirement: Futures and spot ingestion paths MUST be runtime-isolated
The system MUST maintain separate internal queues and publish execution paths for futures and spot ingestion. Spot overload or spot publish failures MUST NOT block or degrade the futures publish path.

#### Scenario: Spot backlog does not block futures publishing
- **WHEN** spot queue depth grows under load
- **THEN** futures events SHALL continue to be consumed and published on their own path

#### Scenario: Spot publish error is contained to spot path
- **WHEN** spot publish operations return errors
- **THEN** the system SHALL record the error and continue futures publish processing without shared-path blocking

### Requirement: Spot ingestion MUST expose dedicated observability signals
The system MUST publish spot-specific ingestion metrics: `ingestion_spot_events_total`, `ingestion_spot_queue_depth`, `ingestion_spot_publish_errors_total`, and `ingestion_spot_lag_ms`. Structured logs for spot ingestion errors MUST include `asset_type`, `symbol`, `stream_key`, `ingest_seq`, and `error_type`.

#### Scenario: Spot metrics are emitted during normal ingestion
- **WHEN** spot ticks are ingested and published
- **THEN** spot ingestion metrics SHALL be emitted and updated with spot-only traffic

#### Scenario: Spot error log contains required diagnostic fields
- **WHEN** a spot ingestion publish failure occurs
- **THEN** the structured log SHALL include all required spot diagnostic fields
