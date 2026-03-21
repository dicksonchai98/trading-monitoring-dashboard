## 1. Configuration and Symbol Registry

- [x] 1.1 Add spot symbol registry config (`INGESTOR_SPOT_SYMBOLS_FILE`, `INGESTOR_SPOT_SYMBOLS_EXPECTED_COUNT`) with defaults aligned to `infra/config/stock150.txt`.
- [x] 1.2 Implement spot symbol file loader supporting UTF-8, one symbol per line, blank lines, and `#` comments.
- [x] 1.3 Implement startup validation for spot symbols (non-empty, unique, `^\d{4}$`, expected count constraints).
- [x] 1.4 Implement startup failure policy switch (required mode: fail fast; optional mode: disable spot path and continue futures).

## 2. Spot Tick Ingestion Pipeline

- [x] 2.1 Extend `market_ingestion` subscription bootstrap to include spot tick subscriptions for the validated symbol list.
- [x] 2.2 Add spot tick normalization/publish payload mapping to required fields (`symbol`, `event_ts`, `last_price`, `source`, `ingest_seq`).
- [x] 2.3 Implement per-symbol monotonic `ingest_seq` generation in ingestion path.
- [x] 2.4 Implement stream key routing for spot events using `{env}:stream:spot:{symbol}`.

## 3. Isolation and Backpressure Controls

- [x] 3.1 Split futures and spot internal ingestion queues so spot backlog cannot consume futures critical capacity.
- [x] 3.2 Split futures and spot publish execution paths with error isolation.
- [x] 3.3 Add failure handling to ensure spot publish failures are recorded and do not block futures publishing.

## 4. Observability and Operational Readiness

- [x] 4.1 Add spot ingestion metrics (`ingestion_spot_events_total`, `ingestion_spot_queue_depth`, `ingestion_spot_publish_errors_total`, `ingestion_spot_lag_ms`).
- [x] 4.2 Add structured log fields for spot ingestion diagnostics (`asset_type`, `symbol`, `stream_key`, `ingest_seq`, `error_type`).
- [x] 4.3 Add/update alert thresholds and dashboard panels for spot queue depth, lag, and publish error monitoring during cutover.

## 5. Verification and Regression Coverage

- [x] 5.1 Add unit tests for symbol registry parsing and validation rules, including required/optional failure-mode behavior.
- [x] 5.2 Add integration tests for dual-ingestion behavior to verify spot overload/failure does not regress futures path.
- [x] 5.3 Add contract tests to verify spot event schema fields, per-symbol `ingest_seq` monotonicity, and stream naming.
- [x] 5.4 Add observability assertions/tests (or validation scripts) for required spot metrics and structured log fields.
