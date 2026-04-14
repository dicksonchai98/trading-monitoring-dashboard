# Add KBar Analytics Backend - Plan Summary

## Change Overview

- **Change name**: `add-kbar-analytics-backend`
- **Workflow**: `spec-driven` (proposal/specs/tasks completed)
- **Primary references**:
  - `docs/plans/2026-04-05-kbar-analytics-backend-design.md`
  - `docs/plans/2026-02-16-futures-dashboard-design.md`

## Why This Change

Current backend has ingestion and serving capabilities, but lacks a standardized analytics backend for event-based next-day outcomes and historical metric distributions. This change adds a dedicated analytics capability with reproducible computation, traceable samples, and query-ready precomputed stats.

## Scope

### In Scope

- Build daily k-bar feature layer from `intraday_kbars`.
- Add event analytics pipeline: event detection, sample generation, next-day outcome computation, aggregated event stats.
- Add distribution analytics pipeline: aggregate stats, percentiles, histogram payload.
- Add analytics registries for canonical event IDs and metric IDs.
- Add query APIs for registry, event stats/samples, and distribution stats.
- Add async job APIs and worker lifecycle for manual recomputation and scheduled runs.
- Add persistence model for features, samples, stats, and job tracking with versioning/indexing.

### Out of Scope

- Real-time streaming analytics in this capability.
- Multi-instrument expansion beyond current futures analytics scope.
- Historical backfill framework redesign outside this analytics pipeline.

## Capability Defined

- **New capability**: `kbar-analytics`

## Specification Baseline (WHAT)

### 1) Feature Materialization

- System MUST compute and persist `kbar_daily_features` before downstream analytics.
- Feature writes MUST be keyed by `(code, trade_date)` and support idempotent upsert.

### 2) Event Analytics and Traceability

- System MUST persist `kbar_event_samples` for each matched event day.
- Samples MUST include event-day fields and next-trade-day outcomes.
- System MUST compute versioned aggregated event stats in `kbar_event_stats`.

### 3) Distribution Analytics

- System MUST compute metric distribution aggregates and percentiles.
- System MUST persist versioned distribution results in `kbar_distribution_stats`.
- Histogram payload format MUST be deterministic and query-safe.

### 4) Deterministic Outcome Rules

- `next_day_category` MUST be:
  - `up` if `next_day_return > 0`
  - `down` if `next_day_return < 0`
  - `flat` if `next_day_return = 0`

### 5) API Contracts

- Registry endpoints MUST expose supported events and metrics.
- Event sample endpoint MUST support bounded retrieval via filters and pagination.
- Job trigger endpoints MUST be async and return `202` + `job_id`.
- Invalid IDs/params MUST return deterministic `404` / `400`.

### 6) Job Reliability

- Job lifecycle MUST follow `pending -> running -> success|failed`.
- Recompute jobs MUST be idempotent under retry.
- Failure reason MUST be persisted in `error_message`.

## Technical Design Decisions (HOW)

- Use precompute-first architecture for analytics reads.
- Separate feature layer and analytics aggregation logic.
- Keep sample-level data for event explainability; keep distribution as aggregate-only storage.
- Implement canonical event/metric registries and validate IDs at API boundary.
- Use versioned stats rows to preserve historical recomputation outputs.
- Use async job orchestration for manual and cron-triggered pipeline execution.

## Risks and Mitigations

- **Risk**: Large sample query payloads and slow reads  
  **Mitigation**: Mandatory pagination, bounded page size, indexed filters.
- **Risk**: Recompute inconsistency across retries  
  **Mitigation**: Idempotent upsert strategy and deterministic formula/category rules.
- **Risk**: Registry drift between API and worker logic  
  **Mitigation**: Single-source registry module referenced by both API and worker.
- **Risk**: Storage growth in sample table  
  **Mitigation**: Explicit indexing, retention/archival policy discussion in ops follow-up.

## Implementation Task Groups

1. **Data Model and Persistence**
2. **Analytics Pipeline**
3. **Registry and Contracts**
4. **API and Job Orchestration**
5. **Worker Reliability and Operations**
6. **Verification and Test Coverage**

## Done Criteria

- Daily features, event samples, event stats, and distribution stats persist with defined keys/indexes.
- Registry APIs and analytics query APIs match spec contracts and validation behavior.
- Async analytics jobs execute with deterministic lifecycle and retry safety.
- End-to-end tests verify raw kbars -> features -> samples -> stats path.
- API tests cover pagination, filtering, and error semantics.
- Recomputed versioned stats are queryable and reproducible.
