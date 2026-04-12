## Why

The current backend focuses on ingestion and serving, but it does not provide a standardized analytics surface for k-bar event outcomes and historical metric distributions. We need a dedicated backend analytics capability to support repeatable statistical analysis, traceable samples, and operator-triggered recomputation.

## What Changes

- Add a new backend analytics capability for k-bar event analytics and distribution analytics.
- Define batch pipeline boundaries: daily feature build, event sample generation, stats aggregation, and distribution computation.
- Define canonical event/metric registries and stable API contracts for querying stats and samples.
- Introduce async job triggers and worker lifecycle requirements (idempotency, retry, status updates).
- Define persistence contracts for features, event samples, event stats, distribution stats, and analytics job tracking.

## Capabilities

### New Capabilities

- `kbar-analytics`: Provide precomputed event-based and distribution-based analytics over intraday futures k-bars, including query APIs and async recomputation jobs.

### Modified Capabilities

- None.

## Impact

- Backend modules: new analytics API routes, worker execution flow, repositories, schemas, and registries.
- Database: new analytics tables/indexes for features, samples, stats, and jobs.
- Operations: cron-based daily analytics pipeline and manual recomputation controls.
- Testing: unit/integration/API coverage for analytics correctness and contract stability.
