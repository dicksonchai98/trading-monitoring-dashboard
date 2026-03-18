# Market Crawler Module Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move `app/modules/batch_data/market_crawler` to `app/modules/market_crawler` so backend module taxonomy is domain-first (`market_crawler`, `historical_backfill`, `batch_shared`) without changing behavior, API paths, or database schema.

**Architecture:** This is a pure structure refactor. Keep the existing `market_crawler` package contents intact, move the package to a top-level domain module, then update imports in app code, workers, and tests. Verification should focus on crawler routes, crawler jobs, and shared batch runtime integration to prove the move did not change runtime behavior.

**Tech Stack:** Python, FastAPI, pytest, ripgrep, Git

---

### Task 1: Inventory all current `market_crawler` imports

**Files:**
- Modify: `docs/plans/2026-03-15-market-crawler-module-restructure-implementation-plan.md`
- Inspect: `apps/backend/app/modules/batch_data/market_crawler/**`
- Inspect: `apps/backend/app/routes/market_crawler.py`
- Inspect: `apps/backend/workers/crawler_worker.py`
- Inspect: `apps/backend/tests/test_market_crawler_*.py`

**Step 1: Collect all app/test import sites**

Run:

```bash
rg -n "batch_data\.market_crawler" apps/backend -S
```

Expected: import sites in route, worker, tests, and package-internal modules.

**Step 2: Record the package boundaries to preserve**

Keep these subpackages unchanged during the move:

```text
application/
datasets/
domain/
fetchers/
infrastructure/
jobs/
normalizers/
parsers/
registry/
repositories/
services/
validators/
```

**Step 3: Commit nothing yet**

This task is only for inventory and scoping.

### Task 2: Move the package and update package-internal imports

**Files:**
- Create: `apps/backend/app/modules/market_crawler/**`
- Delete: `apps/backend/app/modules/batch_data/market_crawler/**`
- Modify: `apps/backend/app/modules/market_crawler/__init__.py`
- Modify: `apps/backend/app/modules/market_crawler/application/orchestrator.py`
- Modify: `apps/backend/app/modules/market_crawler/jobs/single_date_job.py`
- Modify: `apps/backend/app/modules/market_crawler/jobs/range_backfill_job.py`
- Modify: `apps/backend/app/modules/market_crawler/registry/__init__.py`
- Modify: `apps/backend/app/modules/market_crawler/registry/dataset_registry.py`
- Modify: `apps/backend/app/modules/market_crawler/registry/pipeline_registry.py`
- Modify: `apps/backend/app/modules/market_crawler/repositories/__init__.py`
- Modify: `apps/backend/app/modules/market_crawler/repositories/market_open_interest_repository.py`
- Modify: `apps/backend/app/modules/market_crawler/parsers/__init__.py`
- Modify: `apps/backend/app/modules/market_crawler/parsers/taifex_csv_parser.py`
- Modify: `apps/backend/app/modules/market_crawler/fetchers/__init__.py`
- Modify: `apps/backend/app/modules/market_crawler/fetchers/http_fetcher.py`
- Modify: `apps/backend/app/modules/market_crawler/normalizers/taifex_institution_open_interest_normalizer.py`
- Modify: `apps/backend/app/modules/market_crawler/validators/taifex_institution_open_interest_validator.py`

**Step 1: Write the failing import test**

Add or update a focused test in:

```python
# apps/backend/tests/test_market_crawler_contracts.py
from app.modules.market_crawler.domain.contracts import CrawlerJobParams


def test_market_crawler_contracts_import_from_top_level_module() -> None:
    assert CrawlerJobParams is not None
```

**Step 2: Run the focused test to verify it fails before the move**

Run:

```bash
python -m pytest tests/test_market_crawler_contracts.py -q
```

Expected: `ModuleNotFoundError` for `app.modules.market_crawler` before the package is moved.

**Step 3: Move the directory**

Target structure:

```text
apps/backend/app/modules/market_crawler/
```

Use Git-aware move commands so history remains traceable.

**Step 4: Update all package-internal imports**

Example replacements:

```python
from app.modules.batch_data.market_crawler.domain.contracts import ParsedRow
```

becomes:

```python
from app.modules.market_crawler.domain.contracts import ParsedRow
```

**Step 5: Run the focused test to verify the new package imports**

Run:

```bash
python -m pytest tests/test_market_crawler_contracts.py -q
```

Expected: PASS

**Step 6: Commit**

```bash
git add apps/backend/app/modules/market_crawler apps/backend/tests/test_market_crawler_contracts.py
git commit -m "refactor: move market crawler module to top level"
```

### Task 3: Update app wiring, workers, and route imports

**Files:**
- Modify: `apps/backend/app/routes/market_crawler.py`
- Modify: `apps/backend/workers/crawler_worker.py`
- Modify: `apps/backend/app/main.py` if import ordering changes are needed
- Modify: `apps/backend/tests/test_market_crawler_admin_route.py`
- Modify: `apps/backend/tests/test_market_crawler_worker_entrypoint.py`

**Step 1: Write the failing route import test**

Use the existing route test module and make sure it imports from the top-level module path:

```python
from app.modules.market_crawler.services.admin_jobs import MarketCrawlerAdminJobService
```

**Step 2: Run focused route/worker tests**

Run:

```bash
python -m pytest tests/test_market_crawler_admin_route.py tests/test_market_crawler_worker_entrypoint.py -q
```

Expected: FAIL before app wiring is updated.

**Step 3: Update route and worker imports**

Example replacements:

```python
from app.modules.batch_data.market_crawler.services.admin_jobs import MarketCrawlerAdminJobService
```

becomes:

```python
from app.modules.market_crawler.services.admin_jobs import MarketCrawlerAdminJobService
```

**Step 4: Re-run the focused route/worker tests**

Run:

```bash
python -m pytest tests/test_market_crawler_admin_route.py tests/test_market_crawler_worker_entrypoint.py -q
```

Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/routes/market_crawler.py apps/backend/workers/crawler_worker.py apps/backend/tests/test_market_crawler_admin_route.py apps/backend/tests/test_market_crawler_worker_entrypoint.py
git commit -m "refactor: update market crawler wiring imports"
```

### Task 4: Update crawler tests and shared runtime integration references

**Files:**
- Modify: `apps/backend/tests/test_market_crawler_orchestrator.py`
- Modify: `apps/backend/tests/test_market_crawler_integration.py`
- Modify: `apps/backend/tests/test_market_crawler_mvp_pipeline.py`
- Modify: `apps/backend/tests/test_market_crawler_dataset_registry.py`
- Modify: `apps/backend/tests/test_market_crawler_shared_retry_mapping.py`
- Modify: `apps/backend/tests/test_market_open_interest_daily_repository.py`

**Step 1: Update all remaining test imports**

Replace every:

```python
from app.modules.batch_data.market_crawler...
```

with:

```python
from app.modules.market_crawler...
```

**Step 2: Run crawler-focused tests**

Run:

```bash
python -m pytest tests/test_market_crawler_orchestrator.py tests/test_market_crawler_integration.py tests/test_market_crawler_mvp_pipeline.py tests/test_market_crawler_dataset_registry.py tests/test_market_crawler_shared_retry_mapping.py tests/test_market_open_interest_daily_repository.py -vv -s
```

Expected: crawler-focused tests pass; in this repo, pytest may still hang after printing `PASSED`, so use stdout as the source of truth.

**Step 3: Commit**

```bash
git add apps/backend/tests/test_market_crawler_orchestrator.py apps/backend/tests/test_market_crawler_integration.py apps/backend/tests/test_market_crawler_mvp_pipeline.py apps/backend/tests/test_market_crawler_dataset_registry.py apps/backend/tests/test_market_crawler_shared_retry_mapping.py apps/backend/tests/test_market_open_interest_daily_repository.py
git commit -m "test: update crawler imports after module move"
```

### Task 5: Run end-to-end regression checks and update docs if needed

**Files:**
- Modify: `apps/backend/README.md` only if it references the old module path
- Modify: `docs/plans/2026-03-15-batch-job-admin-queue-redesign.md` only if internal file references mention the old path

**Step 1: Search for stale old-path references**

Run:

```bash
rg -n "batch_data\.market_crawler|modules/batch_data/market_crawler" apps/backend docs -S
```

Expected: no remaining code or doc references to the old path, unless intentionally kept in historical notes.

**Step 2: Run final regression commands**

Run:

```bash
python -m pytest tests/test_batch_shared_queue_worker_runtime.py tests/test_batch_jobs_admin_route.py tests/test_market_crawler_admin_route.py tests/test_market_crawler_worker_entrypoint.py tests/test_market_crawler_integration.py tests/test_historical_backfill_admin_route.py -vv -s
```

Expected: all relevant batch/crawler/backfill integration tests pass; treat printed `PASSED` as authoritative if the shell later times out.

**Step 3: Verify the app still imports**

Run:

```bash
python -c "from app.main import app; print(app.title)"
```

Expected: prints `Trading Dashboard Backend`

**Step 4: Commit**

```bash
git add apps/backend/README.md docs/plans/2026-03-15-batch-job-admin-queue-redesign.md
git commit -m "docs: align module references after market crawler move"
```
