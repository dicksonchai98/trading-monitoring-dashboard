# Identity DB Setup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace in-memory identity persistence with PostgreSQL-backed storage using SQLAlchemy + Alembic for `users` and `refresh_token_denylist`, plus idempotent admin seeding.

**Architecture:** Keep current FastAPI route/API contracts unchanged and swap only storage implementation behind services. Introduce a small DB boundary (`app/db` + repositories), add migration/versioning via Alembic, and preserve current acceptance behavior with DB-backed tests. Defer `audit_events` persistence to a separate change.

**Tech Stack:** FastAPI, SQLAlchemy 2.x (async), Alembic, PostgreSQL, pytest, httpx

---

### Task 1: Add Backend DB Dependencies

**Files:**
- Modify: `apps/backend/requirements.txt`
- Test: `apps/backend/tests/test_identity_access_acceptance.py`

**Step 1: Write the failing test**

```python
def test_database_env_required_for_db_bootstrap(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    from app.db.settings import get_database_url
    with pytest.raises(RuntimeError):
        get_database_url()
```

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_identity_access_acceptance.py::test_database_env_required_for_db_bootstrap -v`
Expected: FAIL with `ModuleNotFoundError` for `app.db.settings` or missing dependency.

**Step 3: Write minimal implementation**

```text
Add dependencies:
- sqlalchemy>=2.0
- alembic>=1.13
- asyncpg>=0.29
- passlib[bcrypt]>=1.7
```

**Step 4: Run test to verify it still fails for the right reason**

Run: `pytest apps/backend/tests/test_identity_access_acceptance.py::test_database_env_required_for_db_bootstrap -v`
Expected: FAIL with missing `app.db.settings` (dependency issue resolved).

**Step 5: Commit**

```bash
git add apps/backend/requirements.txt
git commit -m "chore(backend): add database and migration dependencies"
```

### Task 2: Add DB Settings and Session Boundary

**Files:**
- Create: `apps/backend/app/db/__init__.py`
- Create: `apps/backend/app/db/settings.py`
- Create: `apps/backend/app/db/base.py`
- Create: `apps/backend/app/db/session.py`
- Create: `apps/backend/app/db/deps.py`
- Modify: `apps/backend/app/config.py`
- Test: `apps/backend/tests/test_db_settings.py`

**Step 1: Write the failing test**

```python
import pytest

def test_get_database_url_raises_without_env(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    from app.db.settings import get_database_url
    with pytest.raises(RuntimeError):
        get_database_url()
```

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_db_settings.py::test_get_database_url_raises_without_env -v`
Expected: FAIL with `ModuleNotFoundError: app.db`.

**Step 3: Write minimal implementation**

```python
# app/db/settings.py
import os

def get_database_url() -> str:
    value = os.getenv("DATABASE_URL")
    if not value:
        raise RuntimeError("DATABASE_URL is required")
    return value
```

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_db_settings.py::test_get_database_url_raises_without_env -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/db apps/backend/app/config.py apps/backend/tests/test_db_settings.py
git commit -m "feat(backend): add db settings and async session boundary"
```

### Task 3: Define Core ORM Models

**Files:**
- Create: `apps/backend/app/models/__init__.py`
- Create: `apps/backend/app/models/user.py`
- Create: `apps/backend/app/models/refresh_denylist.py`
- Test: `apps/backend/tests/test_models_schema.py`

**Step 1: Write the failing test**

```python
from app.models.user import UserModel

def test_user_model_table_name():
    assert UserModel.__tablename__ == "users"
```

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_models_schema.py::test_user_model_table_name -v`
Expected: FAIL with `ModuleNotFoundError: app.models`.

**Step 3: Write minimal implementation**

```python
class UserModel(Base):
    __tablename__ = "users"
    id = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    username = mapped_column(String(64), unique=True, nullable=False)
```

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_models_schema.py::test_user_model_table_name -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/models apps/backend/tests/test_models_schema.py
git commit -m "feat(backend): add users and refresh denylist ORM models"
```

### Task 4: Initialize Alembic and Create Initial Migration

**Files:**
- Create: `apps/backend/alembic.ini`
- Create: `apps/backend/alembic/env.py`
- Create: `apps/backend/alembic/script.py.mako`
- Create: `apps/backend/alembic/versions/20260223_01_init_identity_tables.py`
- Modify: `apps/backend/README.md`
- Test: `apps/backend/tests/test_migration_metadata.py`

**Step 1: Write the failing test**

```python
from pathlib import Path

def test_initial_migration_file_exists():
    path = Path("apps/backend/alembic/versions/20260223_01_init_identity_tables.py")
    assert path.exists()
```

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_migration_metadata.py::test_initial_migration_file_exists -v`
Expected: FAIL because migration file does not exist.

**Step 3: Write minimal implementation**

```python
def upgrade():
    op.create_table("users", ...)
    op.create_table("refresh_token_denylist", ...)
```

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_migration_metadata.py::test_initial_migration_file_exists -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/alembic apps/backend/README.md apps/backend/tests/test_migration_metadata.py
git commit -m "feat(backend): add alembic baseline and initial identity migration"
```

### Task 5: Implement Password Hashing and User Repository

**Files:**
- Create: `apps/backend/app/security/passwords.py`
- Create: `apps/backend/app/repositories/user_repository.py`
- Modify: `apps/backend/app/services/auth_service.py`
- Test: `apps/backend/tests/test_user_repository.py`
- Test: `apps/backend/tests/test_auth_service_unit.py`

**Step 1: Write the failing test**

```python
def test_register_persists_user_with_hashed_password(...):
    access, refresh = auth_service.register("alice", "secret")
    db_user = user_repo.get_by_username("alice")
    assert db_user.password_hash != "secret"
```

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_auth_service_unit.py::test_register_persists_user_with_hashed_password -v`
Expected: FAIL because service still uses in-memory store/plain password.

**Step 3: Write minimal implementation**

```python
password_hash = hash_password(password)
await user_repository.create_user(username=username, password_hash=password_hash, role="user")
```

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_auth_service_unit.py::test_register_persists_user_with_hashed_password -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/security apps/backend/app/repositories apps/backend/app/services/auth_service.py apps/backend/tests/test_user_repository.py apps/backend/tests/test_auth_service_unit.py
git commit -m "feat(backend): persist users with hashed passwords via repository"
```

### Task 6: Implement DB-Backed Refresh Denylist Repository

**Files:**
- Create: `apps/backend/app/repositories/refresh_denylist_repository.py`
- Modify: `apps/backend/app/services/denylist.py`
- Modify: `apps/backend/app/services/auth_service.py`
- Test: `apps/backend/tests/test_refresh_denylist_repository.py`

**Step 1: Write the failing test**

```python
def test_reused_refresh_jti_is_rejected_after_rotation(...):
    first = client.post("/auth/refresh")
    assert first.status_code == 200
    replay = client.post("/auth/refresh", cookies={"refresh_token": old_token})
    assert replay.status_code == 401
```

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_identity_access_acceptance.py::test_refresh_rotation_reuse_old_token_fails_with_401 -v`
Expected: FAIL after removing in-memory denylist path.

**Step 3: Write minimal implementation**

```python
if await denylist_repository.contains(jti):
    raise TokenError("denylisted")
await denylist_repository.add(jti=old_jti, expires_at=payload_exp)
```

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_identity_access_acceptance.py::test_refresh_rotation_reuse_old_token_fails_with_401 -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/repositories/refresh_denylist_repository.py apps/backend/app/services/denylist.py apps/backend/app/services/auth_service.py apps/backend/tests/test_refresh_denylist_repository.py
git commit -m "feat(backend): move refresh denylist to postgres repository"
```

### Task 7: Wire App State to DB-Backed Services

**Files:**
- Modify: `apps/backend/app/state.py`
- Modify: `apps/backend/app/deps.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_identity_access_acceptance.py`

**Step 1: Write the failing test**

```python
def test_login_works_with_db_backed_auth_service(client):
    response = client.post("/auth/login", json={"username": "admin", "password": "admin-pass"})
    assert response.status_code == 200
```

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_identity_access_acceptance.py::test_register_and_login_return_access_and_secure_refresh_cookie -v`
Expected: FAIL due to missing service wiring.

**Step 3: Write minimal implementation**

```python
# state.py
auth_service = AuthService(user_repository=user_repository, denylist_repository=denylist_repository, metrics=metrics)
```

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_identity_access_acceptance.py::test_register_and_login_return_access_and_secure_refresh_cookie -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/state.py apps/backend/app/deps.py apps/backend/app/main.py apps/backend/tests/test_identity_access_acceptance.py
git commit -m "refactor(backend): wire identity services to db repositories"
```

### Task 8: Add Admin Seed Script

**Files:**
- Create: `apps/backend/scripts/seed_admin.py`
- Modify: `apps/backend/README.md`
- Test: `apps/backend/tests/test_seed_admin.py`

**Step 1: Write the failing test**

```python
def test_seed_admin_is_idempotent(...):
    run_seed()
    run_seed()
    assert count_users_with_username("admin") == 1
```

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_seed_admin.py::test_seed_admin_is_idempotent -v`
Expected: FAIL because script does not exist.

**Step 3: Write minimal implementation**

```python
if not repo.exists(username):
    repo.create_admin(username, hash_password(password))
```

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_seed_admin.py::test_seed_admin_is_idempotent -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/scripts/seed_admin.py apps/backend/README.md apps/backend/tests/test_seed_admin.py
git commit -m "feat(backend): add idempotent admin seed script"
```

### Task 9: End-to-End Verification and Docs Alignment

**Files:**
- Modify: `apps/backend/README.md`
- Modify: `docs/plans/2026-02-22-identity-access-plan.md`
- Test: `apps/backend/tests/test_identity_access_acceptance.py`

**Step 1: Write the failing test**

```python
def test_admin_route_returns_403_for_non_admin_user(...):
    ...
```

**Step 2: Run full backend test suite**

Run: `pytest apps/backend/tests -v`
Expected: one or more FAILs before final polish.

**Step 3: Implement final fixes**

```text
Address any failing assertions without changing API contract:
- 401/403 semantics
- secure refresh cookie flags
- refresh replay rejection
```

**Step 4: Run full backend test suite again**

Run: `pytest apps/backend/tests -v`
Expected: all PASS.

**Step 5: Commit**

```bash
git add apps/backend/README.md docs/plans/2026-02-22-identity-access-plan.md apps/backend/tests
git commit -m "test(backend): verify db-backed identity flows and update docs"
```

## Notes for Execution

1. Run migrations before API tests that depend on DB schema:
   - `alembic -c apps/backend/alembic.ini upgrade head`
2. Seed admin before login tests that expect pre-provisioned admin:
   - `python apps/backend/scripts/seed_admin.py`
3. Keep `audit_log` in-memory in this change; do not add `audit_events` migration.
4. Use DRY/YAGNI: only persist data required by current identity acceptance scenarios.
