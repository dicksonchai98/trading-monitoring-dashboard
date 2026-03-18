# Batch Job Admin Queue Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor batch job creation and execution so historical backfill and market crawler create admin-only jobs under `/api/admin`, enqueue work through Redis lists, execute via dedicated `BRPOP` workers, and persist all lifecycle state in `batch_jobs`.

**Architecture:** Domain-specific admin routes keep request validation and dedupe logic, then call a shared batch admin service that creates one `batch_jobs` row and enqueues it to a worker-specific Redis list. Dedicated backfill and crawler workers consume queue items, reload jobs from `batch_jobs`, and execute them through a refactored shared `JobRunner` that owns lifecycle transitions, retry, logging, metrics, and progress updates.

**Tech Stack:** Python, FastAPI, SQLAlchemy, Redis, pytest, Alembic

---

### Task 1: Extend `batch_jobs` schema for shared admin creation

**Files:**
- Modify: `apps/backend/app/models/batch_job.py`
- Modify: `apps/backend/tests/test_models_schema.py`
- Modify: `apps/backend/tests/test_migration_metadata.py`
- Create: `apps/backend/alembic/versions/20260315_01_extend_batch_jobs_for_admin_queue.py`

**Step 1: Write the failing test**

```python
def test_batch_job_model_includes_worker_type_and_dedupe_key() -> None:
    columns = BatchJobModel.__table__.columns.keys()
    assert "worker_type" in columns
    assert "dedupe_key" in columns
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_models_schema.py::test_batch_job_model_includes_worker_type_and_dedupe_key -v`
Expected: FAIL because the model does not define the new columns yet.

**Step 3: Write minimal implementation**

```python
class BatchJobModel(Base):
    __tablename__ = "batch_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    worker_type: Mapped[str] = mapped_column(String(64), nullable=False)
    job_type: Mapped[str] = mapped_column(String(64), nullable=False)
    dedupe_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
```

- Add an Alembic migration that adds `worker_type` and `dedupe_key`.
- Add indexes for `worker_type`, and for `worker_type + job_type + status` if useful for active dedupe lookups.
- Update migration metadata tests to assert the new migration file exists.

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_models_schema.py tests/test_migration_metadata.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/models/batch_job.py \
        apps/backend/tests/test_models_schema.py \
        apps/backend/tests/test_migration_metadata.py \
        apps/backend/alembic/versions/20260315_01_extend_batch_jobs_for_admin_queue.py
git commit -m "feat: extend batch jobs schema for admin queue flow"
```

---

### Task 2: Add shared batch job repository support for admin creation and dedupe lookup

**Files:**
- Modify: `apps/backend/app/modules/batch_shared/repositories/job_repository.py`
- Create: `apps/backend/tests/test_batch_shared_job_repository.py`

**Step 1: Write the failing test**

```python
def test_create_job_persists_worker_type_and_metadata(session):
    repo = JobRepository()
    job = repo.create_job(
        worker_type="market_crawler",
        job_type="crawler-single-date",
        dedupe_key="crawler:2026-03-15",
        metadata={"dataset_code": "foo", "target_date": "2026-03-15"},
    )
    assert job.worker_type == "market_crawler"
    assert job.dedupe_key == "crawler:2026-03-15"


def test_find_active_by_dedupe_key_returns_existing_job(session):
    repo = JobRepository()
    created = repo.create_job(
        worker_type="historical_backfill",
        job_type="historical-backfill",
        dedupe_key="TXF:2026-03-01:2026-03-10:force",
        metadata={},
    )
    found = repo.find_active_job(
        worker_type="historical_backfill",
        job_type="historical-backfill",
        dedupe_key="TXF:2026-03-01:2026-03-10:force",
    )
    assert found is not None
    assert found.id == created.id
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_batch_shared_job_repository.py -v`
Expected: FAIL because the repository API does not support these operations yet.

**Step 3: Write minimal implementation**

```python
ACTIVE_JOB_STATUSES = {
    JobStatus.CREATED.value,
    JobStatus.RUNNING.value,
    JobStatus.RETRYING.value,
    JobStatus.PARTIALLY_COMPLETED.value,
}

def create_job(self, worker_type: str, job_type: str, dedupe_key: str | None, metadata: dict[str, Any]) -> BatchJobModel:
    ...

def find_active_job(self, worker_type: str, job_type: str, dedupe_key: str) -> BatchJobModel | None:
    ...
```

- Keep status initialization at `CREATED`.
- Add `get_job` access patterns needed by the future worker consumer path.

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_batch_shared_job_repository.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/modules/batch_shared/repositories/job_repository.py \
        apps/backend/tests/test_batch_shared_job_repository.py
git commit -m "feat: add shared batch job admin repository operations"
```

---

### Task 3: Add Redis queue abstraction for enqueue and blocking dequeue

**Files:**
- Create: `apps/backend/app/modules/batch_shared/queue/redis_queue.py`
- Modify: `apps/backend/app/modules/batch_shared/config/settings.py`
- Create: `apps/backend/tests/test_batch_shared_queue.py`

**Step 1: Write the failing test**

```python
def test_queue_name_maps_from_worker_type() -> None:
    queue = RedisBatchQueue(client=_fake_client())
    assert queue.queue_name("historical_backfill") == "queue:batch:historical_backfill"


def test_enqueue_pushes_job_id_payload() -> None:
    client = FakeRedis()
    queue = RedisBatchQueue(client=client)
    queue.enqueue("market_crawler", job_id=42)
    assert client.lpush_calls == [("queue:batch:market_crawler", "42")]
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_batch_shared_queue.py -v`
Expected: FAIL because the queue abstraction does not exist yet.

**Step 3: Write minimal implementation**

```python
class RedisBatchQueue:
    def queue_name(self, worker_type: str) -> str:
        return f"queue:batch:{worker_type}"

    def enqueue(self, worker_type: str, job_id: int) -> None:
        self._client.lpush(self.queue_name(worker_type), str(job_id))

    def dequeue_blocking(self, worker_type: str, timeout_seconds: int = 0) -> int | None:
        result = self._client.brpop(self.queue_name(worker_type), timeout=timeout_seconds)
        return None if result is None else int(result[1])
```

- Add settings entries for Redis connection and optional blocking timeout if needed.

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_batch_shared_queue.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/modules/batch_shared/queue/redis_queue.py \
        apps/backend/app/modules/batch_shared/config/settings.py \
        apps/backend/tests/test_batch_shared_queue.py
git commit -m "feat: add redis batch queue abstraction"
```

---

### Task 4: Implement shared batch admin service for create-and-enqueue

**Files:**
- Create: `apps/backend/app/modules/batch_shared/services/admin_jobs.py`
- Create: `apps/backend/tests/test_batch_shared_admin_jobs.py`

**Step 1: Write the failing test**

```python
def test_create_and_enqueue_creates_job_and_pushes_queue_message():
    repo = FakeJobRepository()
    queue = FakeBatchQueue()
    service = BatchJobAdminService(repository=repo, queue=queue)

    job = service.create_and_enqueue(
        worker_type="market_crawler",
        job_type="crawler-single-date",
        dedupe_key="crawler:oi:2026-03-15",
        metadata={"dataset_code": "oi", "target_date": "2026-03-15"},
    )

    assert job.id == 1
    assert queue.enqueued == [("market_crawler", 1)]
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_batch_shared_admin_jobs.py -v`
Expected: FAIL because the shared admin service does not exist yet.

**Step 3: Write minimal implementation**

```python
class BatchJobAdminService:
    def create_and_enqueue(self, worker_type: str, job_type: str, dedupe_key: str | None, metadata: dict[str, Any]) -> BatchJobModel:
        job = self.repository.create_job(
            worker_type=worker_type,
            job_type=job_type,
            dedupe_key=dedupe_key,
            metadata=metadata,
        )
        self.queue.enqueue(worker_type=worker_type, job_id=job.id)
        return job
```

- Keep this service intentionally generic and free of domain validation or dedupe policy.

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_batch_shared_admin_jobs.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/modules/batch_shared/services/admin_jobs.py \
        apps/backend/tests/test_batch_shared_admin_jobs.py
git commit -m "feat: add shared batch admin create and enqueue service"
```

---

### Task 5: Move historical backfill create flow onto shared `batch_jobs`

**Files:**
- Modify: `apps/backend/app/modules/historical_backfill/service.py`
- Modify: `apps/backend/app/modules/historical_backfill/schemas.py`
- Modify: `apps/backend/app/routes/historical_backfill.py`
- Create: `apps/backend/tests/test_historical_backfill_admin_route.py`

**Step 1: Write the failing test**

```python
def test_backfill_create_returns_existing_active_job(client, admin_headers, seeded_batch_job):
    payload = {
        "code": "TXF",
        "start_date": "2026-03-01",
        "end_date": "2026-03-10",
        "overwrite_mode": "force",
    }
    response = client.post("/api/admin/batch/backfill/jobs", json=payload, headers=admin_headers)
    assert response.status_code == 202
    assert response.json()["job_id"] == seeded_batch_job.id
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_historical_backfill_admin_route.py -v`
Expected: FAIL because the route path and shared lifecycle behavior are not implemented yet.

**Step 3: Write minimal implementation**

```python
def trigger(...):
    dedupe_key = build_backfill_dedupe_key(request)
    existing = repository.find_active_job(
        worker_type="historical_backfill",
        job_type="historical-backfill",
        dedupe_key=dedupe_key,
    )
    if existing is not None:
        return _to_trigger_response(existing)
    created = batch_admin_service.create_and_enqueue(
        worker_type="historical_backfill",
        job_type="historical-backfill",
        dedupe_key=dedupe_key,
        metadata=request.model_dump(mode="json"),
    )
```

- Rename the route to `/api/admin/batch/backfill/jobs`.
- Keep `require_admin`.
- Keep audit logging, but update the path to the new route.
- Adapt response schemas to reflect `batch_jobs` instead of the legacy table.

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_historical_backfill_admin_route.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/modules/historical_backfill/service.py \
        apps/backend/app/modules/historical_backfill/schemas.py \
        apps/backend/app/routes/historical_backfill.py \
        apps/backend/tests/test_historical_backfill_admin_route.py
git commit -m "refactor: move backfill admin creation to shared batch jobs"
```

---

### Task 6: Move market crawler create flow onto shared `batch_jobs`

**Files:**
- Modify: `apps/backend/app/routes/admin.py`
- Create: `apps/backend/app/modules/batch_data/market_crawler/services/admin_jobs.py`
- Create: `apps/backend/tests/test_market_crawler_admin_route.py`

**Step 1: Write the failing test**

```python
def test_crawler_single_date_create_writes_shared_batch_job(client, admin_headers):
    payload = {
        "dataset_code": "taifex_institution_open_interest_daily",
        "target_date": "2026-03-15",
        "trigger_type": "manual",
    }
    response = client.post("/api/admin/batch/crawler/jobs", json=payload, headers=admin_headers)
    assert response.status_code == 202
    body = response.json()
    assert body["worker_type"] == "market_crawler"
    assert body["job_type"] == "crawler-single-date"
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_market_crawler_admin_route.py -v`
Expected: FAIL because the new route and shared create flow do not exist yet.

**Step 3: Write minimal implementation**

```python
def create_crawler_job(...):
    if "target_date" in payload:
        job_type = "crawler-single-date"
        dedupe_key = build_single_date_dedupe_key(payload)
    else:
        job_type = "crawler-backfill"
        dedupe_key = build_range_dedupe_key(payload)
    ...
```

- Replace `/admin/crawler/run` and `/admin/crawler/backfill` as primary create endpoints with `/api/admin/batch/crawler/jobs`.
- If backwards compatibility is needed, keep old routes temporarily as wrappers that call the same service.
- Remove direct writes to `CrawlerJobRepository` from admin routes.

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_market_crawler_admin_route.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/routes/admin.py \
        apps/backend/app/modules/batch_data/market_crawler/services/admin_jobs.py \
        apps/backend/tests/test_market_crawler_admin_route.py
git commit -m "refactor: move crawler admin creation to shared batch jobs"
```

---

### Task 7: Refactor `JobRunner` to execute existing jobs instead of creating new rows

**Files:**
- Modify: `apps/backend/app/modules/batch_shared/jobs/job_runner.py`
- Modify: `apps/backend/tests/test_batch_shared_job_runner.py`
- Modify: `apps/backend/tests/test_batch_shared_runtime_integration.py`

**Step 1: Write the failing test**

```python
def test_run_existing_job_marks_lifecycle_using_existing_row(fake_repo):
    created = fake_repo.create_job(
        worker_type="market_crawler",
        job_type="crawler-single-date",
        dedupe_key=None,
        metadata={"dataset_code": "oi", "target_date": "2026-03-15"},
    )
    runner = JobRunner(repository=fake_repo, retry_policy=RetryPolicy(max_attempts=1, backoff_seconds=0), metrics=BatchMetrics())
    result = runner.run_existing_job(job_id=created.id, job_impl=FakeJob())
    assert result.rows_processed == 3
    assert fake_repo.get_job(created.id).status == JobStatus.COMPLETED.value
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_batch_shared_job_runner.py tests/test_batch_shared_runtime_integration.py -v`
Expected: FAIL because `JobRunner` still creates a new job during execution.

**Step 3: Write minimal implementation**

```python
def run_existing_job(self, job_id: int, job_impl: JobImplementation) -> JobResult:
    job = self.repository.get_job(job_id)
    params = dict(job.metadata_json or {})
    worker_type = job.worker_type
    job_type = job.job_type
    ...
```

- Remove lifecycle row creation from runtime execution.
- Make logging and metrics include `worker_type` and `job_type`.
- Add a specific failure path for unknown or missing jobs.

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_batch_shared_job_runner.py tests/test_batch_shared_runtime_integration.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/modules/batch_shared/jobs/job_runner.py \
        apps/backend/tests/test_batch_shared_job_runner.py \
        apps/backend/tests/test_batch_shared_runtime_integration.py
git commit -m "refactor: execute existing batch jobs in shared runner"
```

---

### Task 8: Add queue-driven worker runtime and update worker entrypoints

**Files:**
- Modify: `apps/backend/app/modules/batch_shared/runtime/worker.py`
- Modify: `apps/backend/workers/backfill_worker.py`
- Modify: `apps/backend/workers/crawler_worker.py`
- Modify: `apps/backend/tests/test_historical_backfill_worker_entrypoint.py`
- Modify: `apps/backend/tests/test_market_crawler_worker_entrypoint.py`
- Create: `apps/backend/tests/test_batch_shared_queue_worker_runtime.py`

**Step 1: Write the failing test**

```python
def test_queue_worker_runtime_dequeues_and_executes_matching_job():
    queue = FakeBatchQueue(job_ids=[41])
    repo = FakeJobRepository.with_job(
        id=41,
        worker_type="historical_backfill",
        job_type="historical-backfill",
        metadata={"code": "TXF", "start_date": "2026-03-01", "end_date": "2026-03-10", "overwrite_mode": "force"},
    )
    runtime = QueueWorkerRuntime(worker_type="historical_backfill", queue=queue, repository=repo, runner=fake_runner, registry={"historical-backfill": FakeJob()})
    runtime.run_once()
    assert fake_runner.executed_job_ids == [41]
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_batch_shared_queue_worker_runtime.py -v`
Expected: FAIL because the queue consumer runtime does not exist yet.

**Step 3: Write minimal implementation**

```python
class QueueWorkerRuntime:
    def run_once(self) -> None:
        job_id = self.queue.dequeue_blocking(self.worker_type, timeout_seconds=1)
        if job_id is None:
            return
        job = self.repository.get_job(job_id)
        if job is None or job.worker_type != self.worker_type:
            return
        self.runner.run_existing_job(job_id=job_id, job_impl=self.registry[job.job_type])
```

- Update `build_backfill_worker_runtime()` and `build_crawler_worker_runtime()` to build queue consumers.
- Keep a `run_once()` method for testability and `run_forever()` for production entrypoints.

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_batch_shared_queue_worker_runtime.py tests/test_historical_backfill_worker_entrypoint.py tests/test_market_crawler_worker_entrypoint.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/modules/batch_shared/runtime/worker.py \
        apps/backend/workers/backfill_worker.py \
        apps/backend/workers/crawler_worker.py \
        apps/backend/tests/test_batch_shared_queue_worker_runtime.py \
        apps/backend/tests/test_historical_backfill_worker_entrypoint.py \
        apps/backend/tests/test_market_crawler_worker_entrypoint.py
git commit -m "feat: add queue-driven batch worker runtime"
```

---

### Task 9: Migrate shared job query endpoints to `batch_jobs`

**Files:**
- Create: `apps/backend/app/modules/batch_shared/schemas/admin_jobs.py`
- Create: `apps/backend/app/routes/batch_jobs.py`
- Modify: `apps/backend/app/main.py`
- Create: `apps/backend/tests/test_batch_jobs_admin_route.py`

**Step 1: Write the failing test**

```python
def test_list_batch_jobs_filters_by_worker_type(client, admin_headers, seeded_batch_jobs):
    response = client.get("/api/admin/batch/jobs?worker_type=market_crawler", headers=admin_headers)
    assert response.status_code == 200
    items = response.json()["items"]
    assert all(item["worker_type"] == "market_crawler" for item in items)
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_batch_jobs_admin_route.py -v`
Expected: FAIL because the shared admin query route does not exist yet.

**Step 3: Write minimal implementation**

```python
@router.get("/api/admin/batch/jobs")
def list_batch_jobs(...):
    jobs = repo.list_jobs(worker_type=worker_type, job_type=job_type, status=status, limit=limit, offset=offset)
    return {"items": [...], "pagination": {...}}
```

- Add detail route by `job_id`.
- Ensure both routes require admin authorization.
- Return shared lifecycle fields directly from `batch_jobs`.

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_batch_jobs_admin_route.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/modules/batch_shared/schemas/admin_jobs.py \
        apps/backend/app/routes/batch_jobs.py \
        apps/backend/app/main.py \
        apps/backend/tests/test_batch_jobs_admin_route.py
git commit -m "feat: add shared admin batch job query routes"
```

---

### Task 10: Stop lifecycle writes to legacy `crawler_jobs` and `historical_backfill_jobs`

**Files:**
- Modify: `apps/backend/app/modules/batch_data/market_crawler/jobs/single_date_job.py`
- Modify: `apps/backend/app/modules/batch_data/market_crawler/jobs/range_backfill_job.py`
- Modify: `apps/backend/app/modules/historical_backfill/job.py`
- Modify: `apps/backend/tests/test_historical_backfill_job_integration.py`
- Modify: `apps/backend/tests/test_market_crawler_integration.py`

**Step 1: Write the failing test**

```python
def test_crawler_job_uses_context_progress_without_legacy_job_repository(monkeypatch):
    monkeypatch.setattr("app.modules.batch_data.market_crawler.jobs.single_date_job.CrawlerJobRepository", None)
    result = SingleDateCrawlerJob(orchestrator_factory=lambda *_: FakeSuccessfulOrchestrator()).execute(params={...}, context=_context)
    assert result.rows_processed == 5
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_market_crawler_integration.py tests/test_historical_backfill_job_integration.py -v`
Expected: FAIL because the jobs still depend on legacy lifecycle repositories.

**Step 3: Write minimal implementation**

```python
# Remove lifecycle writes such as stage(), complete(), fail(), mark_running(), mark_completed().
# Use context.update_progress(...) for shared progress only.
# Keep domain data persistence and validation code unchanged.
```

- Remove direct lifecycle repository dependencies from job implementations.
- Keep any domain repository used for actual business data writes.

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_market_crawler_integration.py tests/test_historical_backfill_job_integration.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/modules/batch_data/market_crawler/jobs/single_date_job.py \
        apps/backend/app/modules/batch_data/market_crawler/jobs/range_backfill_job.py \
        apps/backend/app/modules/historical_backfill/job.py \
        apps/backend/tests/test_historical_backfill_job_integration.py \
        apps/backend/tests/test_market_crawler_integration.py
git commit -m "refactor: remove legacy lifecycle writes from batch jobs"
```

---

### Task 11: Remove obsolete lifecycle route and repository usage

**Files:**
- Modify: `apps/backend/app/routes/admin.py`
- Modify: `apps/backend/app/routes/historical_backfill.py`
- Modify: `apps/backend/app/state.py`
- Modify: `apps/backend/tests/test_models_schema.py`
- Optional Delete: `apps/backend/app/modules/batch_data/market_crawler/repositories/crawler_job_repository.py`
- Optional Delete: `apps/backend/app/modules/historical_backfill/repository.py`
- Optional Delete: `apps/backend/app/models/crawler_job.py`
- Optional Delete: `apps/backend/app/models/historical_backfill_job.py`

**Step 1: Write the failing test**

```python
def test_no_runtime_route_reads_legacy_lifecycle_tables():
    source = Path("app/routes/admin.py").read_text()
    assert "CrawlerJobRepository" not in source
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_models_schema.py -v`
Expected: FAIL because runtime-facing code still imports legacy lifecycle repositories or models.

**Step 3: Write minimal implementation**

```python
# Remove runtime route imports of legacy lifecycle repositories.
# Remove legacy list/detail route code once shared batch routes are in place.
# Delete old repositories and models only after no production code imports them.
```

- If table drops are too disruptive for this change, leave migrations for a separate cleanup change.
- At minimum, remove these tables from the runtime path so no new lifecycle data is written there.

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_models_schema.py tests/test_batch_jobs_admin_route.py tests/test_historical_backfill_admin_route.py tests/test_market_crawler_admin_route.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/routes/admin.py \
        apps/backend/app/routes/historical_backfill.py \
        apps/backend/app/state.py \
        apps/backend/tests/test_models_schema.py
git commit -m "chore: remove legacy lifecycle tables from runtime path"
```

---

### Task 12: Verify end-to-end admin queue flow and update docs

**Files:**
- Modify: `apps/backend/tests/test_batch_shared_runtime_integration.py`
- Modify: `apps/backend/docs/market-ingestor-ops.md`
- Modify: `docs/plans/2026-03-15-batch-job-admin-queue-redesign.md`

**Step 1: Write the failing test**

```python
def test_admin_create_then_worker_consume_updates_batch_job_lifecycle():
    # Create one batch job through the shared admin service, enqueue it,
    # run one queue consumer iteration, and assert CREATED -> RUNNING -> COMPLETED.
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_batch_shared_runtime_integration.py -v`
Expected: FAIL because the full create-and-consume integration path is not fully wired yet.

**Step 3: Write minimal implementation**

```python
# Add an integration test that uses the real shared service + fake redis queue + queue worker runtime.
# Update ops docs to describe:
# - admin routes under /api/admin
# - Redis list queue names
# - long-running worker behavior
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_batch_shared_runtime_integration.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/tests/test_batch_shared_runtime_integration.py \
        apps/backend/docs/market-ingestor-ops.md \
        docs/plans/2026-03-15-batch-job-admin-queue-redesign.md
git commit -m "test: verify end-to-end admin queue batch flow"
```

