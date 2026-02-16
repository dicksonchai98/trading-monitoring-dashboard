# Futures Dashboard MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the MVP for a futures monitoring dashboard with FastAPI + React, Redis Streams ingestion, SSE updates, JWT + RBAC, and mock subscription flow.

**Architecture:** Modular monolith backend with domain modules, Redis Streams for ingestion, Redis cache for latest snapshots, Postgres for transactional data, and SSE for frontend updates. Monorepo layout with `frontend/`, `backend/`, and `infra/`.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2 + Alembic, Pydantic, Redis-py; React + Vite + TypeScript, React Router; Postgres + Redis; Docker Compose.

---

### Task 1: Add base repo structure

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `backend/README.md`
- Create: `frontend/README.md`
- Create: `infra/README.md`

**Step 1: Write the failing test**

No test for structure; skip.

**Step 2: Run test to verify it fails**

No test.

**Step 3: Write minimal implementation**

Create folders and base docs.

```
.gitignore
backend/
frontend/
infra/
```

**Step 4: Run test to verify it passes**

No test.

**Step 5: Commit**

```bash
git add .gitignore README.md backend/README.md frontend/README.md infra/README.md
git commit -m "chore: add base repo structure"
```

### Task 2: Backend dependency scaffold

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_health.py
from fastapi.testclient import TestClient
from app.main import app


def test_health():
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_health.py -v`
Expected: FAIL (module not found or app not defined)

**Step 3: Write minimal implementation**

```python
# backend/app/main.py
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}
```

**Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_health.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/pyproject.toml backend/app backend/tests/test_health.py
git commit -m "feat: add backend scaffold and health check"
```

### Task 3: Database setup (SQLAlchemy + Alembic)

**Files:**
- Create: `backend/app/db/session.py`
- Create: `backend/app/db/base.py`
- Create: `backend/app/db/models.py`
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/0001_init.py`
- Modify: `backend/app/main.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_db_connection.py
from app.db.session import get_session


def test_db_session():
    with get_session() as session:
        result = session.execute("SELECT 1").scalar()
        assert result == 1
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_db_connection.py -v`
Expected: FAIL (db session not configured)

**Step 3: Write minimal implementation**

- Add SQLAlchemy engine + session factory
- Create base model registry
- Provide `get_session()` helper

**Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_db_connection.py -v`
Expected: PASS (assuming local Postgres configured)

**Step 5: Commit**

```bash
git add backend/app/db backend/alembic* backend/tests/test_db_connection.py backend/app/main.py
git commit -m "feat: add database setup with Alembic"
```

### Task 4: Core models (users, roles, subscriptions, audit)

**Files:**
- Modify: `backend/app/db/models.py`
- Create: `backend/app/schemas/users.py`
- Create: `backend/app/schemas/subscriptions.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_models.py
from app.db.models import User, Subscription


def test_user_model_fields():
    user = User(email="a@b.com", role="member")
    assert user.email == "a@b.com"
    assert user.role == "member"
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_models.py -v`
Expected: FAIL (models not defined)

**Step 3: Write minimal implementation**

Define models: `User`, `Subscription`, `AuditEvent` with minimal fields.

**Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_models.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/db/models.py backend/app/schemas backend/tests/test_models.py
git commit -m "feat: add core data models"
```

### Task 5: Auth + JWT + RBAC policies

**Files:**
- Create: `backend/app/auth/jwt.py`
- Create: `backend/app/auth/deps.py`
- Create: `backend/app/rbac/policy.py`
- Modify: `backend/app/main.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_rbac.py
from app.rbac.policy import can


def test_admin_can_write():
    assert can("admin", "user", "create")


def test_visitor_cannot_write():
    assert not can("visitor", "subscription", "update")
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_rbac.py -v`
Expected: FAIL

**Step 3: Write minimal implementation**

Implement JWT validation + simple `can(role, resource, action)` policy.

**Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_rbac.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/auth backend/app/rbac backend/tests/test_rbac.py backend/app/main.py
git commit -m "feat: add jwt auth and rbac policy"
```

### Task 6: Subscription intent + mock webhook flow

**Files:**
- Create: `backend/app/subscriptions/router.py`
- Create: `backend/app/subscriptions/service.py`
- Modify: `backend/app/main.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_subscription_flow.py
from fastapi.testclient import TestClient
from app.main import app


def test_subscription_intent():
    client = TestClient(app)
    resp = client.post("/subscriptions/intent", json={"plan": "basic"})
    assert resp.status_code == 201
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_subscription_flow.py -v`
Expected: FAIL (route not found)

**Step 3: Write minimal implementation**

Add intent endpoint + mock webhook endpoint to activate subscription.

**Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_subscription_flow.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/subscriptions backend/tests/test_subscription_flow.py backend/app/main.py
git commit -m "feat: add subscription intent and mock webhook"
```

### Task 7: Redis Streams ingestion + indicator engine

**Files:**
- Create: `backend/app/ingestion/shioaji_adapter.py`
- Create: `backend/app/streams/consumer.py`
- Create: `backend/app/indicator/compute.py`
- Create: `backend/app/realtime/cache.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_stream_compute.py
from app.indicator.compute import compute_snapshot


def test_compute_snapshot_minimal():
    tick = {"symbol": "TXF", "price": 100.0, "volume": 1}
    snap = compute_snapshot(tick)
    assert snap["symbol"] == "TXF"
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_stream_compute.py -v`
Expected: FAIL

**Step 3: Write minimal implementation**

Implement minimal compute + stream consumer + write to Redis latest snapshot.

**Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_stream_compute.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/ingestion backend/app/streams backend/app/indicator backend/app/realtime backend/tests/test_stream_compute.py
git commit -m "feat: add redis streams ingestion and snapshot compute"
```

### Task 8: SSE endpoint

**Files:**
- Create: `backend/app/realtime/router.py`
- Modify: `backend/app/main.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_sse_endpoint.py
from fastapi.testclient import TestClient
from app.main import app


def test_sse_endpoint_exists():
    client = TestClient(app)
    resp = client.get("/realtime/near-month")
    assert resp.status_code in (200, 204)
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_sse_endpoint.py -v`
Expected: FAIL

**Step 3: Write minimal implementation**

Add SSE endpoint that streams from Redis latest snapshot every 1 second.

**Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_sse_endpoint.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/realtime backend/tests/test_sse_endpoint.py backend/app/main.py
git commit -m "feat: add sse streaming endpoint"
```

### Task 9: Frontend scaffold (React + Vite)

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/routes.tsx`

**Step 1: Write the failing test**

No test for scaffold; skip.

**Step 2: Run test to verify it fails**

No test.

**Step 3: Write minimal implementation**

Create React app with routes: `/` (home), `/dashboard` (near month), `/admin`.

**Step 4: Run test to verify it passes**

No test.

**Step 5: Commit**

```bash
git add frontend
git commit -m "feat: add frontend scaffold"
```

### Task 10: Frontend SSE integration

**Files:**
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/components/NearMonthCard.tsx`

**Step 1: Write the failing test**

```tsx
// frontend/src/components/NearMonthCard.test.tsx
import { render, screen } from "@testing-library/react";
import NearMonthCard from "./NearMonthCard";

test("renders price", () => {
  render(<NearMonthCard snapshot={{ symbol: "TXF", price: 100 }} />);
  expect(screen.getByText("TXF")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- NearMonthCard -w frontend`
Expected: FAIL (no test setup)

**Step 3: Write minimal implementation**

Add SSE `EventSource` to `/realtime/near-month` and render latest snapshot.

**Step 4: Run test to verify it passes**

Run: `npm test -- NearMonthCard -w frontend`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat: render near-month snapshot from sse"
```

### Task 11: Docker Compose

**Files:**
- Create: `infra/docker-compose.yml`
- Create: `infra/.env.example`

**Step 1: Write the failing test**

No test.

**Step 2: Run test to verify it fails**

No test.

**Step 3: Write minimal implementation**

Compose services: `postgres`, `redis`, `backend`, `frontend`.

**Step 4: Run test to verify it passes**

No test.

**Step 5: Commit**

```bash
git add infra
git commit -m "chore: add docker compose for local dev"
```

### Task 12: Basic docs and runbook

**Files:**
- Modify: `README.md`
- Create: `docs/ops/runbook.md`

**Step 1: Write the failing test**

No test.

**Step 2: Run test to verify it fails**

No test.

**Step 3: Write minimal implementation**

Add instructions for running services, migration, and local dev.

**Step 4: Run test to verify it passes**

No test.

**Step 5: Commit**

```bash
git add README.md docs/ops/runbook.md
git commit -m "docs: add runbook and setup"
```
