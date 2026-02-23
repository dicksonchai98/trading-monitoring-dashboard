# Identity DB Setup Design (2026-02-23)

## Goal

Backfill missing backend database foundation for Identity & Access in `apps/backend` by introducing PostgreSQL persistence, SQLAlchemy models, Alembic migrations, and admin seed flow. Keep API behavior stable while replacing in-memory auth and refresh denylist storage.

## Scope

### In Scope

1. Database setup for identity domain in backend:
   - `DATABASE_URL` configuration
   - SQLAlchemy engine/session wiring
   - Alembic migration baseline
2. Core identity models:
   - `users`
   - `refresh_token_denylist`
3. Seed process for pre-provisioned admin account (script-based, idempotent).
4. Service-layer persistence replacement:
   - `AuthService` user storage from in-memory -> repository/DB
   - Refresh denylist from in-memory -> repository/DB
5. Test coverage updates for DB-backed identity behavior.

### Out of Scope

1. `audit_events` table and persistent audit storage (deferred).
2. Market/subscription domain database tables.
3. Redis integration changes.
4. API contract redesign (status codes and route matrix remain as-is).

## Architecture

1. Keep FastAPI modular monolith and current route groups unchanged.
2. Add backend DB module boundary under `app/db/`:
   - config access
   - async engine/session
   - DI helper for session provisioning
3. Add identity ORM models under `app/models/`.
4. Add persistence adapters/repositories consumed by existing services.
5. Keep token issuance/verification flow intact; only storage backend changes.

## Data Model

### Table: users

1. `id`: UUID, primary key
2. `username`: VARCHAR(64), unique, not null
3. `password_hash`: VARCHAR(255), not null
4. `role`: VARCHAR(16), not null (`admin` | `user`)
5. `is_active`: BOOLEAN, not null, default `true`
6. `created_at`: TIMESTAMPTZ, not null, default `now()`
7. `updated_at`: TIMESTAMPTZ, not null, default `now()`

### Table: refresh_token_denylist

1. `id`: UUID, primary key
2. `jti`: UUID, unique, not null
3. `expires_at`: TIMESTAMPTZ, not null
4. `created_at`: TIMESTAMPTZ, not null, default `now()`
5. Index: `expires_at` for cleanup queries

## Migration Strategy

1. Use Alembic as authoritative schema migration mechanism.
2. Create initial identity migration that creates only:
   - `users`
   - `refresh_token_denylist`
3. Do not insert admin seed data in migration.
4. Preserve forward/backward migration path via Alembic revision chain.

## Seed Strategy

1. Add idempotent `seed_admin` script.
2. Script reads:
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
3. Script behavior:
   - create admin if absent
   - no-op if admin already exists
4. Password is stored as hash (no plaintext persistence).

## Service and Flow Changes

1. `AuthService`
   - user lookup/create via repository on `users` table
   - default role remains `user` on register
2. Refresh rotation
   - denylist check by `jti` from DB
   - on successful refresh, insert old `jti` with `expires_at`
   - periodic or on-call cleanup query deletes expired rows
3. Audit service
   - remains in-memory for this change

## Error Semantics

Behavior remains aligned to current identity spec:

1. unauthenticated -> `401`
2. token invalid/expired/tampered -> `401`
3. refresh denylist hit -> `401`
4. insufficient role -> `403`

No route-level contract changes in this design.

## Testing Strategy

1. Preserve existing acceptance tests for:
   - register/login
   - refresh rotation replay rejection
   - public/protected/admin route behavior
   - protected SSE auth rejection
2. Add DB-focused tests:
   - username uniqueness constraint
   - denylist insert/check/expired cleanup
   - admin seed idempotency
3. Use isolated test database configuration (not shared dev DB).

## Risks and Mitigations

1. Risk: seed step omitted in environment setup.
   - Mitigation: document seed command and include in deployment checklist.
2. Risk: behavior regressions during in-memory -> DB transition.
   - Mitigation: keep existing API acceptance suite as regression gate.
3. Risk: migration drift across environments.
   - Mitigation: Alembic-only schema changes; no ad hoc `create_all` in runtime.

## Deliverables

1. DB config + session wiring
2. SQLAlchemy models for `users` and `refresh_token_denylist`
3. Alembic baseline migration
4. Admin seed script
5. DB-backed repository/service integration
6. Updated tests and docs
