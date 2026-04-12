# Audit Log DB Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Persist admin audit logs in PostgreSQL, expose DB-backed filtered/paginated admin logs API, and connect frontend audit page to the new response contract.

**Architecture:** Keep existing `audit_log.record(...)` call sites unchanged and introduce repository-backed dual-write inside `AuditLog` (memory + DB). Move `/api/admin/logs` reads to DB with filters and pagination. Preserve event extensibility via free-form `event_type` and JSONB `metadata`.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, PostgreSQL, Pytest, React, React Query, Vitest.

---

### Task 1: Add `audit_events` DB migration

**Files:**
- Create: `apps/backend/alembic/versions/20260409_01_add_audit_events.py`
- Test: `apps/backend/tests/test_migration_metadata.py`

**Step 1: Write failing metadata test**

```python
# apps/backend/tests/test_migration_metadata.py
def test_audit_events_migration_file_exists() -> None:
    path = Path("alembic/versions/20260409_01_add_audit_events.py")
    assert path.exists()
```

**Step 2: Run test to verify it fails**

Run: `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_migration_metadata.py::test_audit_events_migration_file_exists`
Expected: FAIL with missing file assertion.

**Step 3: Create migration with table + indexes**

```python
op.create_table(
    "audit_events",
    sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
    sa.Column("event_type", sa.String(length=128), nullable=False),
    sa.Column("path", sa.String(length=255), nullable=False),
    sa.Column("actor", sa.String(length=128), nullable=True),
    sa.Column("role", sa.String(length=32), nullable=True),
    sa.Column("result", sa.String(length=16), nullable=True),
    sa.Column("metadata", sa.JSON(), nullable=False, server_default=sa.text("'{}'::jsonb")),
    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
)
```

Also add indexes:
- `created_at DESC`
- `(event_type, created_at DESC)`
- partial actor/result indexes
- GIN metadata index

**Step 4: Run test to verify it passes**

Run: `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_migration_metadata.py::test_audit_events_migration_file_exists`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/alembic/versions/20260409_01_add_audit_events.py apps/backend/tests/test_migration_metadata.py
git commit -m "feat(backend): add audit_events migration"
```

### Task 2: Add ORM model and repository for audit events

**Files:**
- Create: `apps/backend/app/models/audit_event.py`
- Create: `apps/backend/app/repositories/audit_event_repository.py`
- Modify: `apps/backend/app/db/base.py`
- Test: `apps/backend/tests/test_audit_event_repository.py`

**Step 1: Write failing repository test**

```python
def test_insert_and_query_audit_events() -> None:
    repo = AuditEventRepository(session_factory=SessionLocal)
    repo.insert(...)
    items, total = repo.query(limit=10, offset=0)
    assert total >= 1
```

**Step 2: Run test to verify it fails**

Run: `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_audit_event_repository.py`
Expected: FAIL import/module missing.

**Step 3: Implement model + repository**

Repository API:
- `insert(event_type, path, actor, role, result, metadata)`
- `query(filters..., limit, offset) -> tuple[list[AuditEventRecord], int]`
- `delete_all()` for seed reset/test utility

**Step 4: Run test to verify it passes**

Run: `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_audit_event_repository.py`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/models/audit_event.py apps/backend/app/repositories/audit_event_repository.py apps/backend/app/db/base.py apps/backend/tests/test_audit_event_repository.py
git commit -m "feat(backend): add audit event repository"
```

### Task 3: Implement dual-write in `AuditLog`

**Files:**
- Modify: `apps/backend/app/services/audit.py`
- Modify: `apps/backend/app/state.py`
- Test: `apps/backend/tests/test_audit_log_service.py`

**Step 1: Write failing dual-write tests**

```python
def test_record_writes_memory_and_db(): ...
def test_record_fail_open_on_db_error(): ...
```

**Step 2: Run test to verify it fails**

Run: `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_audit_log_service.py`
Expected: FAIL on missing repository integration.

**Step 3: Implement dual-write and result inference**

- `AuditLog.__init__(repository: AuditEventRepository | None, metrics: Metrics | None)`
- `record(...)`:
  1) append in-memory event
  2) derive `result` when absent
  3) try repository insert
  4) on failure: log exception + metrics failure counter, do not raise

**Step 4: Run tests to verify pass**

Run: `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_audit_log_service.py`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/services/audit.py apps/backend/app/state.py apps/backend/tests/test_audit_log_service.py
git commit -m "feat(backend): add dual-write audit log service"
```

### Task 4: Replace `/api/admin/logs` with DB-backed filters and pagination

**Files:**
- Modify: `apps/backend/app/routes/admin.py`
- Modify: `apps/backend/app/rbac.py` (if endpoint contract path rules need updates)
- Test: `apps/backend/tests/test_admin_logs_route_db.py`
- Update: `apps/backend/tests/test_identity_access_acceptance.py`

**Step 1: Write failing API tests**

```python
def test_admin_logs_returns_items_and_pagination(): ...
def test_admin_logs_filters_by_result_and_event_type(): ...
def test_admin_logs_enforces_admin_role(): ...
```

**Step 2: Run tests to verify failure**

Run: `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_admin_logs_route_db.py`
Expected: FAIL due to old `events` response shape.

**Step 3: Implement endpoint query params and DB query**

`GET /api/admin/logs` params:
- `from`, `to`, `event_type`, `actor`, `path`, `result`, `limit`, `offset`

Response:
- `items`
- `pagination`

**Step 4: Run tests to verify pass**

Run:
- `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_admin_logs_route_db.py`
- `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_identity_access_acceptance.py::test_admin_routes_return_403_for_non_admin_user`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/routes/admin.py apps/backend/tests/test_admin_logs_route_db.py apps/backend/tests/test_identity_access_acceptance.py
git commit -m "feat(backend): add DB-backed admin audit logs API"
```

### Task 5: Update seed endpoint to persist demo logs in DB

**Files:**
- Modify: `apps/backend/app/routes/admin.py`
- Modify: `apps/backend/tests/test_admin_logs_seed_route.py`

**Step 1: Write failing seed persistence assertions**

```python
def test_seed_admin_logs_persists_to_db_and_list_api(): ...
```

**Step 2: Run test to verify failure**

Run: `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_admin_logs_seed_route.py`
Expected: FAIL if endpoint still memory-only.

**Step 3: Implement DB-backed seed behavior**

- If `clear_before=true`, clear persisted audit events.
- Insert templated events via repository/audit service.
- Return `seeded` + persisted total count.

**Step 4: Run test to verify pass**

Run: `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_admin_logs_seed_route.py`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/routes/admin.py apps/backend/tests/test_admin_logs_seed_route.py
git commit -m "feat(backend): persist seeded admin audit logs to DB"
```

### Task 6: Frontend API contract migration (`events` -> `items/pagination`)

**Files:**
- Modify: `apps/frontend/src/features/admin/api/types.ts`
- Modify: `apps/frontend/src/features/admin/api/audit.ts`
- Modify: `apps/frontend/src/features/admin/lib/audit-events.ts`
- Modify: `apps/frontend/src/features/admin/pages/AdminAuditPage.tsx`
- Test: `apps/frontend/src/features/admin/pages/AdminAuditPage.test.tsx`

**Step 1: Write failing frontend tests for new response shape**

```tsx
expect(response.items).toHaveLength(2)
expect(screen.getByText("Accepted")).toBeInTheDocument()
```

**Step 2: Run test to verify failure**

Run: `npm run test -- src/features/admin/pages/AdminAuditPage.test.tsx`
Expected: FAIL due to old contract assumptions.

**Step 3: Implement contract update with temporary backward compatibility**

- Preferred: use `items` + `pagination`
- Transitional fallback: if `events` exists, map to `items`

**Step 4: Run tests to verify pass**

Run:
- `npm run test -- src/features/admin/pages/AdminAuditPage.test.tsx src/features/admin/lib/audit-events.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/admin/api/types.ts apps/frontend/src/features/admin/api/audit.ts apps/frontend/src/features/admin/lib/audit-events.ts apps/frontend/src/features/admin/pages/AdminAuditPage.tsx apps/frontend/src/features/admin/pages/AdminAuditPage.test.tsx
git commit -m "feat(frontend): consume DB-backed admin audit logs API"
```

### Task 7: End-to-end verification and cleanup

**Files:**
- Modify (if needed): `docs/plans/2026-04-09-audit-log-db-persistence-design.md`
- Optional docs: `apps/backend/README.md`

**Step 1: Apply migration locally**

Run: `cd apps/backend && alembic -c alembic.ini upgrade head`
Expected: migration applies successfully.

**Step 2: Run backend verification suite**

Run:
- `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_admin_logs_route_db.py apps/backend/tests/test_admin_logs_seed_route.py apps/backend/tests/test_audit_log_service.py`
Expected: PASS.

**Step 3: Run frontend verification suite**

Run:
- `cd apps/frontend && npm run test -- src/features/admin/pages/AdminAuditPage.test.tsx src/features/admin/lib/audit-events.test.ts`
Expected: PASS.

**Step 4: Manual sanity check**

- Login as admin
- Call `POST /api/admin/logs/seed`
- Open `/admin/audit` and verify filters/pagination reflect DB-backed results

**Step 5: Commit documentation updates**

```bash
git add docs/plans/2026-04-09-audit-log-db-persistence-design.md apps/backend/README.md
git commit -m "docs: finalize audit DB persistence rollout notes"
```

---

## Notes for Execution

- Follow TDD strictly per task (@superpowers:test-driven-development).
- Keep commits small and task-scoped.
- Do not expand event sources beyond the four approved phase-1 groups (YAGNI).
- Preserve API authorization behavior and RBAC checks unchanged.
