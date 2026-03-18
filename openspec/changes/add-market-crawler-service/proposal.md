## Why

The platform has a mature realtime market path but lacks a dedicated batch crawler for low-frequency public market datasets. This gap makes research, backtesting, and statistical workflows depend on manual data preparation and inconsistent data quality.

## What Changes

- Add a dedicated `crawler-worker` service for fetch -> parse -> normalize -> validate -> persist.
- Introduce dataset-driven crawler configuration with registry-based binding to parser/normalizer/validator modules.
- Add single-date execution and date-range backfill (range split into per-date jobs).
- Add job lifecycle tracking, retry/error classification, and parent-child correlation for range runs.
- Add MVP dataset contract for TAIFEX institutional futures open-interest data and persist to `market_open_interest_daily`.
- Add admin trigger and query API surface with backend RBAC enforcement and audit records.
- Add operational observability requirements (structured logs and crawler metrics).

## Capabilities

### New Capabilities
- `market-crawler-service`: Dedicated crawler runtime isolated from API and realtime paths, with canonical stage execution.
- `market-crawler-dataset-registry`: Dataset config loading, schema validation, and registry-based runtime resolution.
- `market-crawler-job-control`: Single-date and range job orchestration, retry policy, and failure classification.
- `market-crawler-mvp-open-interest-dataset`: Fixed TAIFEX source contract, publication-window behavior, and normalized upsert contract.

### Modified Capabilities
- `identity-access-prd`: Extend admin RBAC requirements to crawler trigger and query endpoints with auditability constraints.

## Impact

- Affected systems: crawler worker runtime, backend admin API layer, RBAC/audit pipeline, PostgreSQL schema.
- Affected APIs: `POST /admin/crawler/run`, `POST /admin/crawler/backfill`, `GET /admin/crawler/jobs`, `GET /admin/crawler/jobs/{job_id}`.
- Affected data: `crawler_jobs` (including parent/correlation tracking), `market_open_interest_daily`, optional `crawler_raw_payloads`.
- Dependencies: TAIFEX endpoint stability, batch shared infrastructure, database upsert behavior, existing auth/RBAC modules.
