## 1. Data Model and Persistence

- [x] 1.1 Add `kbar_daily_features` schema and upsert strategy keyed by `(code, trade_date)`.
- [x] 1.2 Add `kbar_event_samples` schema keyed by `(event_id, code, trade_date)` for traceability.
- [x] 1.3 Add versioned `kbar_event_stats` and `kbar_distribution_stats` schemas with query indexes.
- [x] 1.4 Add `analytics_jobs` schema with lifecycle fields and status indexes.

## 2. Analytics Pipeline

- [x] 2.1 Implement feature builder from `intraday_kbars` into `kbar_daily_features`.
- [x] 2.2 Implement event detection, sample generation, next-day outcome computation, and event stats aggregation.
- [x] 2.3 Implement metric distribution computation (mean/percentiles/histogram) and persistence.
- [x] 2.4 Enforce deterministic rules for `next_day_category` and histogram binning.

## 3. Registry and Contracts

- [x] 3.1 Implement event registry with canonical event IDs and threshold definitions.
- [x] 3.2 Implement metric registry with supported analytics metrics.
- [x] 3.3 Ensure registry entries are exposed via API and validated before computation.

## 4. API and Job Orchestration

- [x] 4.1 Add registry query endpoints (`/analytics/events`, `/analytics/metrics`).
- [x] 4.2 Add event stats/samples endpoints with required filters and samples pagination.
- [x] 4.3 Add distribution stats endpoint with version-aware reads.
- [x] 4.4 Add async job trigger endpoints for feature rebuild and stats recomputation.

## 5. Worker Reliability and Operations

- [x] 5.1 Implement job lifecycle transitions (`pending -> running -> success|failed`).
- [x] 5.2 Implement idempotent recomputation via upserts and safe retries.
- [x] 5.3 Add retry policy and error capture (`error_message`) for failed jobs.
- [x] 5.4 Add cron integration for daily full pipeline execution.

## 6. Verification and Test Coverage

- [x] 6.1 Add unit tests for feature formulas, event matching, and distribution/stat calculations.
- [x] 6.2 Add integration tests for end-to-end path: raw kbars -> features -> samples -> stats.
- [x] 6.3 Add API tests for filters, pagination, validation, and error responses.
- [x] 6.4 Add regression checks for versioned reads and deterministic output contracts.
