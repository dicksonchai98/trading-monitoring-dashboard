# Analytics Distribution Latest-By-Code Design (2026-04-09)

## Goal

Make `GET /analytics/distributions/{metric_id}` usable without forcing users to input an exact `start_date` and `end_date`, while keeping existing exact-window query behavior for advanced users.

## Problem

Current distribution query requires exact match on `(metric_id, code, start_date, end_date, version)`. In practice, frontend users do not know which windows have precomputed stats, so they frequently get `distribution_not_found` unless they try many date ranges manually.

## Decision Summary

Keep the existing endpoint and make date range optional:

- Endpoint remains: `GET /analytics/distributions/{metric_id}`
- Required query: `code`
- Optional query: `start_date`, `end_date`, `version`

Behavior:

- If `start_date` and `end_date` are both provided:
  - Keep current exact-window lookup behavior.
- If both are omitted:
  - Return the latest record for `(metric_id, code)` by `computed_at DESC`.
  - Tie-break by `version DESC`.
- If only one date is provided:
  - Return `400 invalid_date_params`.

`version` semantics:

- Exact-window mode: unchanged (`latest` or integer version).
- Latest-by-code mode: ignored, because selection is driven by latest `computed_at`.

## API Contract

### Request

`GET /analytics/distributions/{metric_id}`

Query params:

- `code` (required)
- `start_date` (optional)
- `end_date` (optional)
- `version` (optional, default `latest`)

### Response

No shape changes. Existing fields are preserved:

- `metric_id`
- `code`
- `start_date`
- `end_date`
- `sample_count`
- summary stats (`mean`, `median`, `min`, `max`, `p25`, `p50`, `p75`, `p90`, `p95`)
- `histogram_json`
- `version`

### Errors

- `400 invalid_date_params` when exactly one of `start_date`/`end_date` is provided.
- `404 metric_not_found` for unknown metric.
- `404 distribution_not_found` when no matching data exists (both exact-window mode and latest-by-code mode).

## Backend Design

### Route Layer

File: `apps/backend/app/routes/analytics.py`

- Update `distribution_stats` signature:
  - `start_date: date | None = None`
  - `end_date: date | None = None`
- Add XOR validation for partial date input.
- Branch to:
  - existing `get_distribution_stats(...)` when both dates are present
  - new `get_distribution_latest(...)` when no dates are provided

### Service Layer

File: `apps/backend/app/modules/kbar_analytics/service.py`

Add method:

- `get_distribution_latest(metric_id: str, code: str) -> KbarDistributionStatModel | None`

Query:

- `WHERE metric_id = :metric_id AND code = :code`
- `ORDER BY computed_at DESC, version DESC`
- `LIMIT 1`

Keep `ensure_metric_exists(metric_id)` in this method to preserve current error behavior.

## Frontend Design

### Request Strategy

File: `apps/frontend/src/features/analytics/api/analytics.ts`

- Make distribution date fields optional in request parameter type.
- Build query with:
  - always `code`
  - add `start_date` and `end_date` only when both present
  - add `version` only in exact-window mode

### Page Behavior

File: `apps/frontend/src/features/dashboard/pages/HistoricalAmplitudeDistributionPage.tsx`

- Default mode: request by `metric_id + code` only.
- Date filters become optional advanced filters.
- Keep existing invalid-date-range UI if user enters partial/invalid range.

## Data Flow

1. User picks `metric` and `code`.
2. Frontend calls `/analytics/distributions/{metric_id}?code=...`.
3. Backend returns latest computed distribution for that pair.
4. Frontend renders summary + histogram using returned window metadata.
5. If user provides full date range, frontend sends window query and gets exact result.

## Reliability and Error Handling

- Deterministic fallback removed from frontend; backend now owns latest selection logic.
- `distribution_not_found` remains explicit and predictable.
- No silent fallback from exact-window query to latest, to avoid analytical ambiguity.

## Testing Plan

### Backend

- Route tests for:
  - no-date query returns latest-by-computed_at
  - exact-window query unchanged
  - partial date input returns `400 invalid_date_params`
  - unknown metric remains `404 metric_not_found`
- Service tests for ordering correctness:
  - latest by `computed_at`
  - tie break by `version`

### Frontend

- API unit tests:
  - no-date request only sends `code`
  - exact-window request sends `start_date`, `end_date`, `version`
- Page tests:
  - default load succeeds without date range
  - optional date range still works when fully provided

## Compatibility and Migration

- Backward compatible for existing callers passing full date range.
- Frontend can be updated incrementally; backend change alone already improves DX for new callers.
- No database migration required.

## Out of Scope

- Multi-window comparison in one call.
- Returning a list of candidate windows.
- Changes to event stats endpoints.
