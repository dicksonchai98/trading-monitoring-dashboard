# Batch Shared Runtime Full Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fully migrate historical backfill and market crawler workers to `batch_shared`, removing legacy runtimes and per-service retry/lifecycle handling.

**Architecture:** Workers use `build_worker_runtime()` and `JobRunner` for lifecycle, retry, progress, logging, metrics, and persistence. Job implementations focus on domain logic and raise errors for shared retry policy.

**Tech Stack:** Python, FastAPI, SQLAlchemy, pytest

---

### Task 1: Remove backfill internal retry loop and cover with unit test

**Files:**
- Create: `apps/backend/tests/test_historical_backfill_job_retry_policy.py`
- Modify: `apps/backend/app/modules/historical_backfill/job.py`

**Step 1: Write the failing test**

```python
def test_backfill_job_raises_after_single_retryable_error(monkeypatch):
    calls = []
    class _Fetcher:
        def fetch_bars(self, *args, **kwargs):
            calls.append(1)
            raise TimeoutError("transient")
    job = HistoricalBackfillJobImplementation(
        session_factory=SessionLocal,
        fetcher=_Fetcher(),
        retry_max_attempts=3,
        retry_backoff_seconds=0,
    )
    with pytest.raises(TimeoutError):
        job.execute(params={...}, context=_context)
    assert len(calls) == 1
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_historical_backfill_job_retry_policy.py -v`  
Expected: FAIL because job retries internally and calls fetcher > 1.

**Step 3: Write minimal implementation**

```python
# In execute(), remove the inner while/attempt loop and related backoff logic.
# Let errors bubble so RetryPolicy in JobRunner handles retries.
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_historical_backfill_job_retry_policy.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/tests/test_historical_backfill_job_retry_policy.py \
        apps/backend/app/modules/historical_backfill/job.py
git commit -m "refactor: remove backfill internal retry loop"
```

---

### Task 2: Remove legacy backfill runtime and update tests

**Files:**
- Delete: `apps/backend/app/modules/historical_backfill/worker.py`
- Modify: `apps/backend/tests/test_historical_backfill_worker_runtime.py`

**Step 1: Write the failing test**

```python
# In test_historical_backfill_worker_runtime.py
def test_legacy_runtime_removed():
    with pytest.raises(ImportError):
        import app.modules.historical_backfill.worker  # noqa: F401
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_historical_backfill_worker_runtime.py::test_legacy_runtime_removed -v`  
Expected: FAIL because module still exists.

**Step 3: Write minimal implementation**

- Delete legacy runtime module `apps/backend/app/modules/historical_backfill/worker.py`.
- Remove other tests in `test_historical_backfill_worker_runtime.py` that depend on the legacy runtime.

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_historical_backfill_worker_runtime.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/tests/test_historical_backfill_worker_runtime.py
git rm apps/backend/app/modules/historical_backfill/worker.py
git commit -m "chore: remove legacy backfill runtime"
```

---

### Task 3: Remove crawler internal retry loop; map failures to shared retry policy

**Files:**
- Modify: `apps/backend/app/modules/batch_data/market_crawler/jobs/single_date_job.py`
- Modify: `apps/backend/tests/test_market_crawler_worker_entrypoint.py` (if needed for new constructor args)
- Create: `apps/backend/tests/test_market_crawler_shared_retry_mapping.py`

**Step 1: Write the failing test**

```python
def test_single_date_job_maps_network_failure_to_connection_error():
    class _FakeOrchestrator:
        def run(self, *args, **kwargs):
            return {"status": "FAILED", "error_category": "network_error"}
    job = SingleDateCrawlerJob(orchestrator_factory=lambda *_: _FakeOrchestrator())
    with pytest.raises(ConnectionError):
        job.execute(params={...}, context=_context)
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_market_crawler_shared_retry_mapping.py -v`  
Expected: FAIL because job handles retry internally / does not map errors.

**Step 3: Write minimal implementation**

```python
# Add optional orchestrator factory injection for tests.
# Remove while/attempt retry loop.
# If orchestrator result is FAILED:
# - "network_error" -> raise ConnectionError(...)
# - "publication_not_ready" -> raise ValueError(...)
# - other categories -> raise ValueError(...)
# Keep domain metrics for rows; drop crawler retry/failure/duration metrics.
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_market_crawler_shared_retry_mapping.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/modules/batch_data/market_crawler/jobs/single_date_job.py \
        apps/backend/tests/test_market_crawler_shared_retry_mapping.py \
        apps/backend/tests/test_market_crawler_worker_entrypoint.py
git commit -m "refactor: remove crawler internal retry loop"
```

---

### Task 4: Update integration tests to use shared runtime only

**Files:**
- Modify: `apps/backend/tests/test_market_crawler_integration.py`
- Modify: `apps/backend/tests/test_historical_backfill_job_integration.py`

**Step 1: Write the failing test**

```python
def test_job_runner_retry_handles_transient_errors():
    # Build a JobRunner and a fake job that fails once then succeeds.
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_historical_backfill_job_integration.py::test_job_runner_retry_handles_transient_errors -v`  
Expected: FAIL because the test does not exist yet.

**Step 3: Write minimal implementation**

```python
# Add a shared runtime integration test that uses JobRunner with a fake job
# to confirm retry + progress + persistence with batch_jobs table.
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_historical_backfill_job_integration.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/tests/test_market_crawler_integration.py \
        apps/backend/tests/test_historical_backfill_job_integration.py
git commit -m "test: align integration coverage with shared runtime"
```
