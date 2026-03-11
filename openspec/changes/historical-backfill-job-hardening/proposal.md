## Why

The system currently lacks an operationally safe way to backfill missing historical 1-minute futures bars, which creates data gaps for analytics and historical views. We need a dedicated historical backfill service now to close these gaps while preserving realtime pipeline stability and RBAC controls.

## What Changes

- Add an admin-triggered historical backfill batch service that fetches 1-minute bars from Shioaji historical API and writes to `kbars_1m` with idempotent upsert.
- Define deterministic time and key semantics for backfill (`Asia/Taipei`, minute-start `minute_ts`, inclusive date range, exchange-calendar session boundary).
- Add resumable batch execution behavior with chunking, retries, checkpoint/progress tracking, and dedicated worker process isolation.
- Define overlap policy with realtime writes via `overwrite_mode` (`closed_only` default, `force` optional).
- Add admin API contracts for trigger/list/detail historical jobs and required auditing/observability fields.

## Capabilities

### New Capabilities
- `historical-backfill-service`: Admin-triggered historical bar backfill workflow including job lifecycle, chunked execution, retry/resume, conflict policy, and persistence semantics.

### Modified Capabilities
- `identity-access-prd`: Extend admin route inventory and RBAC requirements to cover historical backfill job management endpoints.

## Impact

- Backend modules: new historical backfill worker/service components, repositories, and API handlers under the backend service boundary.
- Database: usage/extension of `kbars_1m` uniqueness/index assumptions and `historical_backfill_jobs` lifecycle/progress fields.
- APIs: new admin backfill endpoints (`POST /api/admin/backfill/historical-jobs`, `GET /api/admin/backfill/historical-jobs`, `GET /api/admin/backfill/historical-jobs/{job_id}`).
- Operations: additional worker process, retry/backoff tuning, and monitoring metrics/logging for batch execution.
- Security/compliance: RBAC enforcement and audit trail requirements for admin-triggered backfill actions.
