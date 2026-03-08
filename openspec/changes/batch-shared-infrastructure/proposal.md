## Why

Historical backfill and market crawler are separate batch workers but repeat the same job lifecycle,
retry, logging, and DB helper logic. A shared batch runtime avoids duplication and makes batch
behavior consistent across services.

## What Changes

- Add a shared batch runtime component to standardize job lifecycle, retries, progress, logging,
  config loading, and DB helpers for batch workers.
- Update batch services to plug into the shared runtime while keeping domain-specific pipelines
  in their own modules.
- Align documentation to reference the shared infrastructure design.
- Define concrete module layout, job tracking schema, and runtime startup flow for workers.
- Add metrics and structured logging field requirements for batch jobs.

## Capabilities

### New Capabilities
- `batch-shared-infrastructure`: Shared batch runtime framework used by historical backfill and
  market crawler workers.

### Modified Capabilities
- (none)

## Impact

- Batch worker code paths for historical backfill and market crawler
- Shared runtime module and DB helper utilities
- Operational logging/metrics for batch jobs
- Documentation in `docs/plans/` referencing shared infrastructure
- New `batch_jobs` tracking table and repository layer for job lifecycle persistence
