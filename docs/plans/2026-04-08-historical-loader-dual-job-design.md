# Historical Data Loader Dual-Job Design

Date: 2026-04-08  
Status: Approved for implementation

## 1. Context

The current `historical-data-loader` page mixes concepts that belong to two different backend job APIs:

- Historical backfill admin API (`/api/admin/batch/backfill/jobs`)
- Market crawler admin API (`/api/admin/batch/crawler/jobs`)

These APIs have different request models and semantics. The UI must support both without collapsing them into one ambiguous form.

## 2. Decision

Keep a single route (`/historical-data-loader`) and split the page into two independent sections:

1. `BackfillPanel`
2. `CrawlerPanel`

Add a third section below both:

3. `UnifiedJobsTable`

This keeps workflows separated while giving operators one consolidated operations page.

## 3. UX Structure

## 3.1 BackfillPanel

Inputs:

- Code multi-select (`TXFR1`, `TXFD1`, `TXF`, extensible later)
- Date mode (`single` / `range`)
- Date inputs
- `overwrite_mode` (`closed_only` / `force`)

Behavior:

- `single` maps to `start_date=end_date`
- Submits one job per selected code
- Shows local status/progress/errors
- Shows local result table (`job_id`, `status`, `code`, `from`, `to`)

## 3.2 CrawlerPanel

Inputs:

- Dataset selector (`dataset_code`)
- Date mode (`single` / `range`)
- Date inputs
- `trigger_type` (default `manual`)

Behavior:

- `single` uses `target_date`
- `range` uses `start_date` and `end_date`
- Submits crawler jobs with independent local status/progress/errors
- Shows local result table

## 3.3 UnifiedJobsTable

Aggregates successful creations from both panels.

Unified row shape:

- `source` (`backfill` | `crawler`)
- `job_id`
- `worker_type`
- `job_type`
- `status`
- `target` (code or dataset)
- `window` (single/range + dates)
- `created_at` (frontend timestamp)

Display order: newest first.

## 4. Data & State Design

- Panel states remain isolated:
  - `idle/loading/success/error`
  - progress
  - local result rows
- Parent page owns `unifiedJobs[]`.
- On successful submit from either panel:
  - append standardized records into `unifiedJobs[]`
  - do not mutate sibling panel state.

## 5. Error Handling

Common:

- `401` -> session expired message
- `403` -> admin required message

Backfill-specific:

- `invalid_date_range`
- `invalid_overwrite_mode`

Crawler-specific:

- `invalid_date_range`
- invalid payload/field errors

UI shows user-friendly message and preserves backend error code for debugging context.

## 6. API Mapping

## 6.1 Historical Backfill API

`POST /api/admin/batch/backfill/jobs`

Payload:

- `code`
- `start_date`
- `end_date`
- `overwrite_mode`

## 6.2 Market Crawler API

`POST /api/admin/batch/crawler/jobs`

Single-date payload:

- `dataset_code`
- `target_date`
- `trigger_type`

Range payload:

- `dataset_code`
- `start_date`
- `end_date`
- `trigger_type`

## 7. Testing Strategy (Minimum)

1. `BackfillPanel` tests:
   - date mapping correctness (`single` => same day)
   - success rendering and job row output
   - `401/403/invalid_date_range` handling
2. `CrawlerPanel` tests:
   - payload shape for single vs range
   - default `trigger_type=manual`
   - success/failure states
3. `UnifiedJobsTable` tests:
   - rows from both sources merged correctly
   - source and target fields rendered correctly
   - latest-first ordering
4. Page integration tests:
   - panel isolation (one fails, other still works)
   - admin-gated error messaging

## 8. Non-Goals

- Polling existing job history from backend in this change
- Refactoring both APIs into one backend contract
- Adding direct file download flow

## 9. Rollout Notes

- Route stays unchanged (`/historical-data-loader`)
- Existing users can continue using the page
- New layout clarifies semantic differences and reduces parameter misuse
