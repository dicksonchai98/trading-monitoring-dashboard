# Historical Data Load Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement an Admin-only async historical data load ETL that writes cleaned 1-minute data into PostgreSQL with task tracking and validation.

**Architecture:** Add new SQLAlchemy models and Alembic migration for task tracking and historical data. Introduce a history load service that uses a sinotrade client to fetch per-day data, transforms it, and upserts into Postgres. Expose admin endpoints to create tasks and query status; background work runs in-process and records events to the task tables.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, PostgreSQL, Pytest

---

### Task 1: Add ORM models and migration

**Files:**
- Create: `apps/backend/app/models/history_load.py`
- Modify: `apps/backend/app/models/__init__.py`
- Create: `apps/backend/alembic/versions/20260226_01_add_history_load_tables.py`
- Modify: `apps/backend/tests/test_models_schema.py`
- Modify: `apps/backend/tests/test_migration_metadata.py`

**Step 1: Write failing tests**

```python
from app.models.history_load import HistoryLoadTaskModel, HistoryLoadTaskEventModel, MarketHistory1mModel

def test_history_load_table_names() -> None:
    assert HistoryLoadTaskModel.__tablename__ == "history_load_tasks"
    assert HistoryLoadTaskEventModel.__tablename__ == "history_load_task_events"
    assert MarketHistory1mModel.__tablename__ == "txf_tick_data"
```

**Step 2: Run tests to verify failure**

Run: `pytest apps/backend/tests/test_models_schema.py -v`
Expected: FAIL (ImportError or missing attributes)

**Step 3: Implement models and migration**

```python
class HistoryLoadTaskModel(Base):
    __tablename__ = "history_load_tasks"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    market_type: Mapped[str] = mapped_column(String(16), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    granularity: Mapped[str] = mapped_column(String(8), nullable=False, default="1m")
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="sinotrade")
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
```

```python
class MarketHistory1mModel(Base):
    __tablename__ = "txf_tick_data"
    symbol: Mapped[str] = mapped_column(String(32), primary_key=True)
    market_type: Mapped[str] = mapped_column(String(16), primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    open: Mapped[float | None] = mapped_column(Float, nullable=True)
    high: Mapped[float | None] = mapped_column(Float, nullable=True)
    low: Mapped[float | None] = mapped_column(Float, nullable=True)
    close: Mapped[float | None] = mapped_column(Float, nullable=True)
    volume: Mapped[float | None] = mapped_column(Float, nullable=True)
    # symbol: instrument code, e.g. TXF
    # market_type: market category, e.g. futures
    # ts: timezone-aware timestamp for the 1-minute bar
```

**Step 4: Run tests to verify pass**

Run: `pytest apps/backend/tests/test_models_schema.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/models/history_load.py apps/backend/app/models/__init__.py \
  apps/backend/alembic/versions/20260226_01_add_history_load_tables.py \
  apps/backend/tests/test_models_schema.py apps/backend/tests/test_migration_metadata.py

git commit -m "feat: add history load models and migration"
```

### Task 2: Repository layer for history load tasks and market history

**Files:**
- Create: `apps/backend/app/repositories/history_load_repository.py`
- Modify: `apps/backend/app/repositories/__init__.py`
- Create: `apps/backend/tests/test_history_load_repository.py`

**Step 1: Write failing tests**

```python
def test_create_task_and_update_status() -> None:
    repo = HistoryLoadRepository(session_factory=SessionLocal)
    task = repo.create_task(symbol="TXF", market_type="futures", start_date=date(2024, 1, 1), end_date=date(2024, 1, 2))
    repo.update_task_status(task_id=task.id, status="running", progress=50)
    fetched = repo.get_task(task.id)
    assert fetched.status == "running"
    assert fetched.progress == 50
```

**Step 2: Run tests to verify failure**

Run: `pytest apps/backend/tests/test_history_load_repository.py -v`
Expected: FAIL (module not found)

**Step 3: Implement repository**

```python
class HistoryLoadRepository:
    def create_task(...):
        ...
    def add_event(...):
        ...
    def update_task_status(...):
        ...
    def get_task(...):
        ...
    def list_tasks(...):
        ...
    def upsert_market_history_1m(...):
        ...
```

**Step 4: Run tests to verify pass**

Run: `pytest apps/backend/tests/test_history_load_repository.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/repositories/history_load_repository.py \
  apps/backend/app/repositories/__init__.py apps/backend/tests/test_history_load_repository.py

git commit -m "feat: add history load repository"
```

### Task 3: Sinotrade client + ETL service

**Files:**
- Create: `apps/backend/app/services/sinotrade_history_client.py`
- Create: `apps/backend/app/services/history_load_service.py`
- Create: `apps/backend/tests/test_history_load_service.py`

**Source reference:**
- Shioaji documentation (sinotrade): https://sinotrade.github.io/
- When querying documentation, use Context7 MCP for faster lookup.

**Step 1: Write failing tests**

```python
class FakeClient:
    def fetch_1m(self, symbol, market_type, date):
        return [
            {"ts": "2024-01-01T09:01:00+08:00", "open": 1, "high": 2, "low": 1, "close": 2, "volume": 10}
        ]

def test_service_runs_and_writes_rows():
    repo = HistoryLoadRepository(session_factory=SessionLocal)
    service = HistoryLoadService(repo=repo, client=FakeClient())
    task = service.create_task(...)
    service.run_task(task.id)
    status = repo.get_task(task.id)
    assert status.status in {"succeeded", "partial_failed"}
```

**Step 2: Run tests to verify failure**

Run: `pytest apps/backend/tests/test_history_load_service.py -v`
Expected: FAIL (module not found)

**Step 3: Implement service and transform rules**

```python
class HistoryLoadService:
    def run_task(self, task_id: str) -> None:
        # iterate dates, fetch, transform, upsert, update progress
```

Transform rules:
- Parse timestamp into timezone-aware datetime
- Normalize field names
- Convert empty strings to None

**Step 4: Run tests to verify pass**

Run: `pytest apps/backend/tests/test_history_load_service.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/services/sinotrade_history_client.py \
  apps/backend/app/services/history_load_service.py apps/backend/tests/test_history_load_service.py

git commit -m "feat: add history load service and sinotrade client"
```

### Task 4: Admin API routes and schemas

**Files:**
- Modify: `apps/backend/app/routes/admin.py`
- Create: `apps/backend/tests/test_history_load_admin_routes.py`

**Step 1: Write failing tests**

```python
def test_admin_can_create_history_load_task(client, admin_token):
    resp = client.post(
        "/admin/history-load",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"symbol": "TXF", "market_type": "futures", "start_date": "2024-01-01", "end_date": "2024-01-02"},
    )
    assert resp.status_code == 200
    assert "task_id" in resp.json()
```

**Step 2: Run tests to verify failure**

Run: `pytest apps/backend/tests/test_history_load_admin_routes.py -v`
Expected: FAIL (route not found)

**Step 3: Implement routes and pydantic models**

```python
class HistoryLoadRequest(BaseModel):
    symbol: str
    market_type: str
    start_date: date
    end_date: date
    granularity: str = "1m"
    source: str = "sinotrade"
```

Add endpoints:
- `POST /admin/history-load`
- `GET /admin/history-load/{task_id}`
- `GET /admin/history-load`

**Step 4: Run tests to verify pass**

Run: `pytest apps/backend/tests/test_history_load_admin_routes.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/routes/admin.py apps/backend/tests/test_history_load_admin_routes.py

git commit -m "feat: add admin history load endpoints"
```

### Task 5: Config + docs updates

**Files:**
- Modify: `apps/backend/app/config.py`
- Modify: `apps/backend/.env.example`
- Modify: `apps/backend/README.md`

**Step 1: Write failing tests**

```python
def test_history_load_settings_defaults():
    assert HISTORY_LOAD_MAX_DAYS > 0
    assert HISTORY_LOAD_BATCH_SIZE > 0
```

**Step 2: Run tests to verify failure**

Run: `pytest apps/backend/tests/test_db_settings.py -v`
Expected: FAIL (missing settings)

**Step 3: Implement settings and document them**

```python
HISTORY_LOAD_MAX_DAYS = int(os.getenv("HISTORY_LOAD_MAX_DAYS", "180"))
HISTORY_LOAD_BATCH_SIZE = int(os.getenv("HISTORY_LOAD_BATCH_SIZE", "500"))
```

**Step 4: Run tests to verify pass**

Run: `pytest apps/backend/tests/test_db_settings.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/config.py apps/backend/.env.example apps/backend/README.md apps/backend/tests/test_db_settings.py

git commit -m "docs: add history load settings"
```
