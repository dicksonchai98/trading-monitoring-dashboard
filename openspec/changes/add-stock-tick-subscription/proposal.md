## Why

The current `market_ingestion` path only supports futures tick and bidask subscriptions, but the stream refactor now requires adding spot tick ingestion for about 150 stock symbols. We need this now to support the dual-asset ingestion target (futures + spot) while keeping futures reliability and latency protected.

## What Changes

- Extend `market_ingestion` from futures-only to dual ingestion: existing futures path plus new spot tick subscription path.
- Introduce spot symbol registry loading from configuration (default `infra/config/stock150.txt`) with startup validation (non-empty, no duplicates, symbol format, expected count).
- Add runtime controls for spot symbol file path and expected symbol count.
- Define and enforce spot stream contract for tick events (including per-symbol monotonic `ingest_seq`).
- Isolate futures and spot ingestion internals (queue/publish path/observability) so spot overload or failures do not block futures ingestion.
- Add spot-ingestion observability baseline (metrics and structured logs) required for operations and cutover monitoring.

## Capabilities

### New Capabilities

- `market-ingestion-spot-tick`: Add spot tick ingestion for ~150 symbols with config-driven symbol registry, stream contract validation, isolated publish path, and spot-specific observability.

### Modified Capabilities

- None.

## Impact

- Backend ingestion module: `market_ingestion` lifecycle, subscription wiring, validation, queueing, and publish flow.
- Infrastructure/config surface: `infra/config/stock150.txt`, environment variables for symbol registry controls.
- Redis stream topology and contracts for spot tick events.
- Monitoring/operations: new spot ingestion metrics, logging fields, and alert dashboard inputs.
