# OTC Summary Worker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add OTC index realtime pipeline with dedicated OTC summary worker, Redis latest/today state, serving REST (`latest/today`), and SSE `otc_summary_latest` event, without history persistence.

**Architecture:** Reuse existing market ingestion stream path and add OTC code emission to Redis stream. Introduce a dedicated OTC summary runner/worker that consumes OTC stream via consumer group and writes minimal price-only state to Redis `latest` and `zset`. Extend serving store/routes/SSE to expose independent `/v1/otc-summary/*` reads and event emission.

**Tech Stack:** FastAPI, Python 3.12, Redis Streams, Redis key-state serving, pytest, docker compose.

---

### Task 1: Add OTC Config and State Wiring

**Files:**
- Modify: `apps/backend/app/config.py`
- Modify: `apps/backend/app/state.py`
- Test: `apps/backend/tests/test_market_ingestion_config.py`

**Step 1: Write the failing test**

```python
def test_otc_config_defaults(monkeypatch):
    monkeypatch.delenv("INGESTOR_OTC_ENABLED", raising=False)
    monkeypatch.delenv("INGESTOR_OTC_CODE", raising=False)
    monkeypatch.delenv("OTC_SUMMARY_CODE", raising=False)
    import app.config as reloaded
    assert reloaded.INGESTOR_OTC_ENABLED is False
    assert reloaded.INGESTOR_OTC_CODE == "OTC001"
    assert reloaded.OTC_SUMMARY_CODE == "OTC001"
```

**Step 2: Run test to verify it fails**

Run: `docker compose exec -T backend-api python -m pytest -q tests/test_market_ingestion_config.py::test_otc_config_defaults`  
Expected: FAIL with missing OTC config attributes.

**Step 3: Write minimal implementation**

Add OTC config keys in `app/config.py` and OTC runner singleton/wiring placeholder in `app/state.py`.

**Step 4: Run test to verify it passes**

Run: `docker compose exec -T backend-api python -m pytest -q tests/test_market_ingestion_config.py::test_otc_config_defaults`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/config.py apps/backend/app/state.py apps/backend/tests/test_market_ingestion_config.py
git commit -m "feat: add otc summary config and state wiring"
```

### Task 2: Extend Ingestion to Emit OTC Market Stream

**Files:**
- Modify: `apps/backend/app/market_ingestion/runner.py`
- Modify: `apps/backend/app/market_ingestion/contracts.py`
- Test: `apps/backend/tests/test_market_ingestion_runner.py`

**Step 1: Write the failing test**

```python
def test_market_ingestion_emits_otc_market_event():
    # arrange runner with otc enabled and fake writer
    # act: simulate otc callback payload
    # assert: xadd called on {env}:stream:market:OTC001
    ...
```

**Step 2: Run test to verify it fails**

Run: `docker compose exec -T backend-api python -m pytest -q tests/test_market_ingestion_runner.py::test_market_ingestion_emits_otc_market_event`  
Expected: FAIL because OTC path is not emitted.

**Step 3: Write minimal implementation**

Add OTC market callback/dispatch path that normalizes envelope and writes to OTC market stream key.

**Step 4: Run test to verify it passes**

Run: `docker compose exec -T backend-api python -m pytest -q tests/test_market_ingestion_runner.py::test_market_ingestion_emits_otc_market_event`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/runner.py apps/backend/app/market_ingestion/contracts.py apps/backend/tests/test_market_ingestion_runner.py
git commit -m "feat: emit otc market events from ingestion"
```

### Task 3: Implement OTC Summary Runner and Worker Entrypoint

**Files:**
- Create: `apps/backend/app/otc_summary/__init__.py`
- Create: `apps/backend/app/otc_summary/runner.py`
- Create: `apps/backend/workers/otc_summary_worker.py`
- Test: `apps/backend/tests/test_otc_summary_runner.py`
- Test: `apps/backend/tests/test_stream_processing_worker_entrypoint.py`

**Step 1: Write the failing test**

```python
def test_otc_summary_runner_writes_latest_and_today_state():
    # feed one OTC stream event
    # assert latest key and zset entry exist with minimal payload
    ...
```

**Step 2: Run test to verify it fails**

Run: `docker compose exec -T backend-api python -m pytest -q tests/test_otc_summary_runner.py::test_otc_summary_runner_writes_latest_and_today_state`  
Expected: FAIL because runner does not exist.

**Step 3: Write minimal implementation**

Implement OTC runner with:
- consumer-group read loop (`xautoclaim` + `xreadgroup`)
- minimal payload extraction (`code`, `event_ts`, `minute_ts`, `trade_date`, `index_value`)
- Redis writes for `latest` and `zset`
- ack on successful write

Add worker entrypoint using existing `StreamProcessingWorkerRuntime`.

**Step 4: Run test to verify it passes**

Run: `docker compose exec -T backend-api python -m pytest -q tests/test_otc_summary_runner.py tests/test_stream_processing_worker_entrypoint.py`  
Expected: PASS for OTC runner + entrypoint assertions.

**Step 5: Commit**

```bash
git add apps/backend/app/otc_summary apps/backend/workers/otc_summary_worker.py apps/backend/tests/test_otc_summary_runner.py apps/backend/tests/test_stream_processing_worker_entrypoint.py
git commit -m "feat: add otc summary worker and redis state pipeline"
```

### Task 4: Add Serving Store OTC Read Helpers

**Files:**
- Modify: `apps/backend/app/services/serving_store.py`
- Test: `apps/backend/tests/test_serving_store_otc_summary.py`

**Step 1: Write the failing test**

```python
def test_fetch_otc_summary_latest_normalizes_epoch_ms():
    # mock redis latest payload
    # assert event_ts/minute_ts are epoch ms and index_value is present
    ...

def test_fetch_otc_summary_today_range_returns_sorted_rows():
    # mock zrangebyscore payload list
    # assert sorted normalized output
    ...
```

**Step 2: Run test to verify it fails**

Run: `docker compose exec -T backend-api python -m pytest -q tests/test_serving_store_otc_summary.py`  
Expected: FAIL because helper functions are missing.

**Step 3: Write minimal implementation**

Add:
- `normalize_otc_summary_latest`
- `fetch_otc_summary_latest`
- `fetch_otc_summary_today_range`

Reuse existing Redis and timestamp normalization conventions.

**Step 4: Run test to verify it passes**

Run: `docker compose exec -T backend-api python -m pytest -q tests/test_serving_store_otc_summary.py`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/services/serving_store.py apps/backend/tests/test_serving_store_otc_summary.py
git commit -m "feat: add otc summary serving store helpers"
```

### Task 5: Add OTC Serving Routes and SSE Event

**Files:**
- Modify: `apps/backend/app/routes/serving.py`
- Test: `apps/backend/tests/test_serving_otc_summary_api.py`
- Modify: `apps/backend/tests/test_serving_market_summary_api.py`

**Step 1: Write the failing test**

```python
def test_otc_summary_latest_route_returns_payload(monkeypatch):
    ...

def test_otc_summary_today_route_returns_list(monkeypatch):
    ...

def test_sse_includes_otc_summary_latest_event(monkeypatch):
    ...
```

**Step 2: Run test to verify it fails**

Run: `docker compose exec -T backend-api python -m pytest -q tests/test_serving_otc_summary_api.py`  
Expected: FAIL because OTC routes/event are missing.

**Step 3: Write minimal implementation**

Add:
- `GET /v1/otc-summary/latest`
- `GET /v1/otc-summary/today`
- SSE emission block for `otc_summary_latest`

Use existing auth/rate-limit/error conventions.

**Step 4: Run test to verify it passes**

Run: `docker compose exec -T backend-api python -m pytest -q tests/test_serving_otc_summary_api.py tests/test_serving_market_summary_api.py`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/routes/serving.py apps/backend/tests/test_serving_otc_summary_api.py apps/backend/tests/test_serving_market_summary_api.py
git commit -m "feat: expose otc summary serving routes and sse event"
```

### Task 6: Compose/Docs Wiring and Contract Verification

**Files:**
- Modify: `docker-compose.yml`
- Modify: `apps/backend/README.md`
- Modify: `apps/backend/tests/test_compose_stream_worker_contract.py`

**Step 1: Write the failing test**

```python
def test_compose_includes_otc_summary_worker_service():
    # assert service name and command exist in compose
    ...
```

**Step 2: Run test to verify it fails**

Run: `docker compose exec -T backend-api python -m pytest -q tests/test_compose_stream_worker_contract.py`  
Expected: FAIL because OTC worker service is not declared.

**Step 3: Write minimal implementation**

Add compose service:
- `backend-otc-summary-worker`
- command: `python -m workers.otc_summary_worker`

Update backend README runbook and env examples.

**Step 4: Run test to verify it passes**

Run: `docker compose exec -T backend-api python -m pytest -q tests/test_compose_stream_worker_contract.py`  
Expected: PASS.

**Step 5: Commit**

```bash
git add docker-compose.yml apps/backend/README.md apps/backend/tests/test_compose_stream_worker_contract.py
git commit -m "chore: wire otc summary worker in compose and docs"
```

### Task 7: Final Focused Verification

**Files:**
- No new files; verification only.

**Step 1: Run backend focused suite**

Run:
`docker compose exec -T backend-api python -m pytest -q tests/test_otc_summary_runner.py tests/test_serving_store_otc_summary.py tests/test_serving_otc_summary_api.py tests/test_compose_stream_worker_contract.py`

Expected: PASS.

**Step 2: Run smoke with containers**

Run:
`docker compose up -d backend-api backend-otc-summary-worker`

Expected:
- services stay `Up`
- `/v1/otc-summary/latest` returns 200 when OTC stream has data
- `/v1/otc-summary/today` returns list payload

**Step 3: Commit verification note**

```bash
git add -A
git commit -m "test: verify otc summary ingestion worker and serving flow"
```
