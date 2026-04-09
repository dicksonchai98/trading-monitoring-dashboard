# Audit Log DB Persistence Design (2026-04-09)

## Goal

Migrate admin audit logs from in-memory storage to PostgreSQL persistence while keeping existing event emitters compatible and enabling query filters/pagination for the admin audit page.

## Scope

In scope:
- Persist audit events to DB (`audit_events`) with flexible schema for future event expansion.
- Keep existing `audit_log.record(...)` call sites working.
- Upgrade `GET /api/admin/logs` to DB-backed filtered/paginated query.
- Keep and adapt `POST /api/admin/logs/seed` for DB writes.
- First-batch event sources:
  - `admin_access_denied`
  - `crawler_run_triggered`, `crawler_backfill_triggered`
  - `historical_backfill_triggered`
  - `subscription_status_changed`

Out of scope:
- SIEM integration
- Multi-tenant isolation
- Advanced audit analytics/reporting

## Current State

- `AuditLog` stores events in process memory (`audit_log.events`).
- `GET /api/admin/logs` returns in-memory events only.
- No `audit_events` DB table/migration currently exists.

## Architecture Decision

Chosen approach: **Dual-write transition (recommended)**
- Keep `AuditLog` interface and call sites unchanged.
- `AuditLog.record` writes to memory and DB repository.
- Admin logs API reads from DB only.
- Business requests remain fail-open if DB audit write fails (log + metrics).

Rationale:
- Minimal change to existing modules.
- Safer rollout with low coupling risk.
- Smooth migration path to future memory removal.

## Data Model

Table: `audit_events`

Columns:
- `id` BIGSERIAL PRIMARY KEY
- `event_type` VARCHAR(128) NOT NULL
- `path` VARCHAR(255) NOT NULL
- `actor` VARCHAR(128) NULL
- `role` VARCHAR(32) NULL
- `result` VARCHAR(16) NULL
- `metadata` JSONB NOT NULL DEFAULT `'{}'::jsonb`
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT `now()`

Indexes:
- `created_at DESC`
- `(event_type, created_at DESC)`
- `(actor, created_at DESC)` partial where actor is not null
- `(result, created_at DESC)` partial where result is not null
- GIN index on `metadata`

Extensibility rules:
- `event_type` is free-form string (no enum).
- `metadata` is JSONB to avoid schema churn for new event shapes.

## API Design

### GET `/api/admin/logs` (admin only)

Query params:
- `from` (ISO datetime, optional)
- `to` (ISO datetime, optional)
- `event_type` (optional)
- `actor` (contains, case-insensitive, optional)
- `path` (contains, case-insensitive, optional)
- `result` (`success|accepted|denied|error|unknown`, optional)
- `limit` (default 50, max 500)
- `offset` (default 0)

Response:
- `items`: audit rows sorted by `created_at DESC`
- `pagination`: `limit`, `offset`, `total`

### POST `/api/admin/logs/seed` (admin only)

- Writes seeded demo events to DB (and memory during transition).
- Supports `count` and `clear_before`.

## Event Source Mapping (Phase 1)

1. `require_admin` denied
- event: `admin_access_denied`
- result: `denied`
- metadata: `{reason: "insufficient_role"}`

2. crawler job triggers
- events: `crawler_run_triggered`, `crawler_backfill_triggered`
- result: `accepted`
- metadata: include `job_id`, `dataset_code`, and backfill date range when present

3. historical backfill trigger
- event: `historical_backfill_triggered`
- result: `accepted`
- metadata: `job_id`, `request_payload_hash`, range/overwrite info

4. billing webhook subscription changes
- event: `subscription_status_changed`
- result: `success`
- metadata: include subscription/customer/status fields when available

## Failure Handling and Observability

- Audit DB write failure does not fail business flow.
- Emit structured error logs on write failure.
- Metrics:
  - `audit_write_success_total`
  - `audit_write_failure_total`

## Testing Strategy

- Unit:
  - `AuditLog.record` dual-write behavior and fail-open path
  - result inference behavior
- Repository/API:
  - filter/pagination/sort correctness
  - admin-only access control
- Integration:
  - each phase-1 source emits persisted rows
- Migration:
  - table/index existence checks

## Rollout Plan

1. Add migration + model + repository.
2. Inject repository into `AuditLog` and enable dual-write.
3. Switch `/api/admin/logs` to DB query with filters/pagination.
4. Adapt seed endpoint to DB-backed records.
5. Update frontend contract to consume `items/pagination` (compat mode for transition if needed).
6. Observe metrics/logs; later remove in-memory read dependency.
