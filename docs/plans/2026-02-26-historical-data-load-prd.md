# Historical Data Load PRD (2026-02-26)

## Overview
Build an Admin-only historical data load feature that ingests futures and spot (index-only) history from sinotrade. The process is an ETL pipeline (extract, transform, load) that writes directly to PostgreSQL and does not flow through Redis Streams or trigger indicator recomputation. The load runs asynchronously as a background task, exposes task status and progress for future UI use, and includes audit logging and data quality checks.

## Goals
1. Allow Admin to trigger a historical load by date range and symbol.
2. Support non-blocking async execution with task status and progress queries.
3. Normalize and clean data (null handling, date format normalization, type consistency).
4. Validate loads (pre/post row count checks) and report failures by date.
5. Persist clean 1-minute data in PostgreSQL with upsert semantics.

## Non-Goals
1. No recomputation of historical indicators (no Redis Stream backfill).
2. No frontend admin UI in this phase.
3. No trading calendar or holiday logic (every date in range is attempted).
4. No multi-instrument expansion beyond near-month TXF and index-only spot.

## Users and Access
- Role: Admin only
- Usage: Manual admin API calls or external schedulers invoking the API

## Scope
- Futures: near-month Taiwan index futures only
- Spot: index-only data (e.g., index minute bar price, volume)
- Granularity: 1-minute data only (daily bars can be derived later)

## Data Source
- Source: Shioaji documentation (sinotrade) at https://sinotrade.github.io/
- Source selection is explicit in request payload for traceability
  - When querying documentation, you can use Context7 MCP for faster lookup.

## ETL Flow
1. Extract: fetch data from sinotrade for each date in range and symbol.
2. Transform:
   - Normalize field names and types
   - Standardize datetime format
   - Handle null or missing values with defined rules
3. Load:
   - Batch writes into PostgreSQL
   - Use upsert on primary key (symbol, market_type, ts)
4. Validation:
   - Compare expected vs. actual row counts per date
   - Track failures and reasons
5. Reporting:
   - Task status updates
   - Success and failure date lists

## API (Admin)
- `POST /admin/history-load`
  - Request: `symbol`, `market_type` (futures|spot), `start_date`, `end_date`, `granularity` (1m), `source` (sinotrade)
  - Response: `task_id`, `status`, `created_at`
- `GET /admin/history-load/{task_id}`
  - Response: status, progress %, processed dates, success/failure lists, error summary
- `GET /admin/history-load?status=&date_range=`
  - For future UI list views (can be minimal in MVP)

## Task Status Model
- Statuses: `queued` -> `running` -> `succeeded | partial_failed | failed`
- Progress: based on number of dates processed in the requested range
- Failures: failures are recorded per date, remaining dates continue

## Data Quality and Audit
- Task-level and batch-level logs
- Record:
  - Request parameters
  - Start/end times
  - Per-date result (success/failure)
  - Error messages and validation counts

## Database Schema (High-Level)
- `history_load_tasks`
  - Task master record and status/progress
- `history_load_task_events`
  - Detailed events and errors
- `txf_tick_data` (原 `market_history_1m`)
  - Cleaned historical 1-minute data for near-month TXF
  - Primary key: `(symbol, market_type, ts)` to support upsert
  - `symbol`: instrument code, e.g. `TXF`
  - `market_type`: market category, e.g. `futures`
  - `ts`: timezone-aware timestamp for the 1-minute bar

## Security and RBAC
- Admin-only API access
- Audit log of who triggered each task
- Task and event retention: minimum 90 days, configurable

## Error Handling and Retry
- Source errors: log and continue other dates
- DB write errors: log and continue
- Retry: re-run via API for specific date ranges

## Metrics (MVP)
- Task duration
- Rows written per day
- Failure count and failure rate

## Future Considerations
- Optional indicator backfill using offline compute
- Trading calendar support
- Migration to TimescaleDB when needed
