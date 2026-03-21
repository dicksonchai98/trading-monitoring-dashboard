# Add Stock Tick Subscription - Plan Summary

## Change Overview

- **Change name**: `add-stock-tick-subscription`
- **Workflow**: `spec-driven` (proposal/design/specs/tasks completed)
- **Primary reference**: `docs/plans/2026-03-21-stream-process-refactor.md` (market ingestion section)

## Why This Change

Current `market_ingestion` only handles futures tick + bidask.  
This change adds spot tick ingestion for about 150 stocks while preserving futures reliability, latency, and isolation.

## Scope

### In Scope

- Extend `market_ingestion` to dual ingestion: futures + spot tick.
- Load spot symbol registry from config (default `infra/config/stock150.txt`).
- Validate symbol list at startup:
  - non-empty
  - no duplicates
  - format `^\d{4}$`
  - expected count constraint
- Add required/optional failure mode for invalid spot config.
- Publish spot tick events with required contract fields and per-symbol monotonic `ingest_seq`.
- Isolate futures and spot queue/publish paths.
- Add spot-specific metrics and structured logs.

### Out of Scope

- Redesign downstream workers beyond ingestion-side contract alignment.
- Expand beyond futures + spot.
- Historical backfill/replay redesign.

## Capability Defined

- **New capability**: `market-ingestion-spot-tick`

## Specification Baseline (WHAT)

### 1) Symbol Registry and Startup Validation

- System MUST load spot symbols from runtime-configured file.
- System MUST validate non-empty, unique, and valid symbol format.
- System MUST enforce expected symbol count constraints.
- Required mode MUST fail startup on invalid config.
- Optional mode MUST disable only spot path and keep futures path running.

### 2) Spot Stream Contract

- Published spot event MUST include:
  - `symbol`
  - `event_ts` (ISO8601 UTC)
  - `last_price`
  - `source`
  - `ingest_seq` (per-symbol monotonic)
- Stream key MUST follow `{env}:stream:spot:{symbol}`.

### 3) Runtime Isolation and Backpressure

- Futures and spot MUST use separate internal queues and publish paths.
- Spot backlog/failure MUST NOT block futures publish path.

### 4) Observability

- Required metrics:
  - `ingestion_spot_events_total`
  - `ingestion_spot_queue_depth`
  - `ingestion_spot_publish_errors_total`
  - `ingestion_spot_lag_ms`
- Spot error logs MUST include:
  - `asset_type`
  - `symbol`
  - `stream_key`
  - `ingest_seq`
  - `error_type`

## Technical Design Decisions (HOW)

- Use file-based symbol registry with runtime env controls.
- Support required vs optional spot-ingestion startup policy.
- Use per-symbol stream and per-symbol monotonic `ingest_seq` for ordering/idempotency anchor.
- Enforce futures/spot queue and publish isolation to contain blast radius.
- Add dedicated spot metrics/log schema for cutover and operations.

## Risks and Mitigations

- **Risk**: 150-symbol fanout increases runtime pressure  
  **Mitigation**: queue isolation + lag/depth metrics + alert thresholds.
- **Risk**: bad symbol file causes startup/runtime issues  
  **Mitigation**: strict validation + required/optional mode.
- **Risk**: increased Redis key cardinality  
  **Mitigation**: standardized naming and capacity checks before cutover.
- **Risk**: ordering/idempotency regression  
  **Mitigation**: enforce per-symbol monotonic `ingest_seq`.

## Implementation Task Groups

1. **Configuration and Symbol Registry**
2. **Spot Tick Ingestion Pipeline**
3. **Isolation and Backpressure Controls**
4. **Observability and Operational Readiness**
5. **Verification and Regression Coverage**

## Done Criteria

- Spot tick ingestion works for configured symbol set.
- Startup validation and required/optional policy behave as specified.
- Spot stream contract is consistently enforced.
- Futures path remains unaffected under spot pressure/failures.
- Required spot metrics/log fields are emitted and monitored.
- Unit/integration/contract verification for the new capability is in place.
