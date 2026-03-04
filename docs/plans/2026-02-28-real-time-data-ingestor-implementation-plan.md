# Real-Time Data Ingestor (Shioaji -> Redis Streams) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a production-ready MVP ingestor that logs in to Shioaji, subscribes to near-month futures tick/bidask, writes lightweight envelopes to Redis Streams with MAXLEN retention, and exposes ordering/gap signals.

**Architecture:** Build a transport-only ingestion module: Shioaji adapter (login/subscribe/callback) -> bounded asyncio queue -> single Redis writer task. Keep ingestor stateless and avoid business logic (no aggregation, no K-line correction, no backfill in MVP). Ordering guarantee is per stream key within one ingestor process.

**Tech Stack:** Python, FastAPI, asyncio, redis-py, Shioaji SDK, pytest

---

### Task 1: Add secure Shioaji/Redis ingestor configuration

**Files:**
- Modify: `apps/backend/app/config.py`
- Test: `apps/backend/tests/test_market_ingestion_config.py`

**Step 1: Write the failing test**

```python
from app import config


def test_ingestor_and_shioaji_defaults() -> None:
    assert config.INGESTOR_ENABLED is False
    assert config.INGESTOR_ENV in {"dev", "prod"}
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; python -m pytest tests/test_market_ingestion_config.py -v`  
Expected: FAIL with missing attributes.

**Step 3: Write minimal implementation**

Add config keys:
- `INGESTOR_ENABLED`
- `INGESTOR_ENV`
- `INGESTOR_CODE`
- `INGESTOR_QUEUE_MAXSIZE`
- `INGESTOR_STREAM_MAXLEN`
- `SHIOAJI_API_KEY`
- `SHIOAJI_SECRET_KEY`
- `SHIOAJI_SIMULATION`
- `REDIS_URL`

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; python -m pytest tests/test_market_ingestion_config.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/config.py apps/backend/tests/test_market_ingestion_config.py
git commit -m "feat: add shioaji and ingestor runtime configuration"
```

### Task 2: Implement Shioaji client login/logout wrapper

**Files:**
- Create: `apps/backend/app/market_ingestion/shioaji_client.py`
- Test: `apps/backend/tests/test_market_ingestion_shioaji_client.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.shioaji_client import ShioajiClient


def test_login_calls_shioaji_api_login() -> None:
    api = FakeAPI()
    client = ShioajiClient(api=api, api_key="k", secret_key="s", simulation=True)
    client.login()
    assert api.login_called is True
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; python -m pytest tests/test_market_ingestion_shioaji_client.py -v`  
Expected: FAIL with import error.

**Step 3: Write minimal implementation**

Implement wrapper methods:
- `login()` -> `api.login(api_key=..., secret_key=...)`
- `logout()` -> `api.logout()`
- constructor supports `simulation=True/False`.

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; python -m pytest tests/test_market_ingestion_shioaji_client.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/shioaji_client.py apps/backend/tests/test_market_ingestion_shioaji_client.py
git commit -m "feat: add shioaji client login wrapper"
```

### Task 3: Resolve near-month futures contract and subscribe tick/bidask

**Files:**
- Create: `apps/backend/app/market_ingestion/shioaji_subscription.py`
- Test: `apps/backend/tests/test_market_ingestion_shioaji_subscription.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.shioaji_subscription import subscribe_topics


def test_subscribe_tick_and_bidask_for_target_contract() -> None:
    api = FakeAPI()
    contract = object()
    quote_types = ["tick", "bidask"]
    subscribe_topics(api, contract, quote_types)
    assert ("tick", contract) in api.subscriptions
    assert ("bidask", contract) in api.subscriptions
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; python -m pytest tests/test_market_ingestion_shioaji_subscription.py -v`  
Expected: FAIL with import error.

**Step 3: Write minimal implementation**

Implement:
- `resolve_contract(api, code)` for near-month contract lookup.
- `subscribe_topics(api, contract, quote_types)` for subscriptions matching configured quote types.

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; python -m pytest tests/test_market_ingestion_shioaji_subscription.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/shioaji_subscription.py apps/backend/tests/test_market_ingestion_shioaji_subscription.py
git commit -m "feat: add near-month contract resolution and subscriptions"
```

### Task 4: Add callback -> envelope -> queue path with non-blocking backpressure

**Files:**
- Create: `apps/backend/app/market_ingestion/contracts.py`
- Create: `apps/backend/app/market_ingestion/pipeline.py`
- Test: `apps/backend/tests/test_market_ingestion_pipeline.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.pipeline import IngestionPipeline


def test_enqueue_drops_newest_when_queue_full() -> None:
    pipeline = IngestionPipeline(queue_maxsize=1, metrics=FakeMetrics())
    assert pipeline.enqueue("dev:stream:tick:MTX", {"event_ts": "2026-02-28T00:00:00+00:00"}) is True
    assert pipeline.enqueue("dev:stream:tick:MTX", {"event_ts": "2026-02-28T00:00:01+00:00"}) is False
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; python -m pytest tests/test_market_ingestion_pipeline.py -v`  
Expected: FAIL with import error.

**Step 3: Write minimal implementation**

Implement:
- lightweight envelope fields: `source`, `code`, `quote_type`, `event_ts`, `recv_ts`, `payload`
- bounded queue with `put_nowait`
- on overflow increment `events_dropped_total` and do not block callback.

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; python -m pytest tests/test_market_ingestion_pipeline.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/contracts.py apps/backend/app/market_ingestion/pipeline.py apps/backend/tests/test_market_ingestion_pipeline.py
git commit -m "feat: add non-blocking callback queue ingestion path"
```

### Task 5: Implement Redis stream writer (XADD MAXLEN ~) and per-stream ordering

**Files:**
- Create: `apps/backend/app/market_ingestion/stream_keys.py`
- Create: `apps/backend/app/market_ingestion/writer.py`
- Test: `apps/backend/tests/test_market_ingestion_writer.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.writer import RedisWriter


def test_writer_xadd_uses_maxlen_approximate() -> None:
    redis = FakeRedis()
    writer = RedisWriter(redis_client=redis, maxlen=100000)
    writer.write("dev:stream:tick:MTX", {"k": "v"})
    assert redis.last_maxlen == 100000
    assert redis.last_approximate is True
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; python -m pytest tests/test_market_ingestion_writer.py -v`  
Expected: FAIL with import error.

**Step 3: Write minimal implementation**

Implement:
- key format: `{env}:stream:{quote_type}:{code}`
- single writer task consuming queue sequentially
- retry (3 attempts, short backoff) for transient Redis write errors.

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; python -m pytest tests/test_market_ingestion_writer.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/stream_keys.py apps/backend/app/market_ingestion/writer.py apps/backend/tests/test_market_ingestion_writer.py
git commit -m "feat: add redis stream writer with maxlen and retry"
```

### Task 6: Add reconnect + re-login + re-subscribe runner

**Files:**
- Create: `apps/backend/app/market_ingestion/runner.py`
- Test: `apps/backend/tests/test_market_ingestion_runner.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.runner import reconnect_delays


def test_reconnect_backoff_is_exponential_and_capped() -> None:
    assert reconnect_delays(6) == [1, 2, 4, 8, 16, 30]
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; python -m pytest tests/test_market_ingestion_runner.py -v`  
Expected: FAIL with import error.

**Step 3: Write minimal implementation**

Implement runner loop:
- on disconnect: sleep with `1 -> 2 -> 4 -> ... -> 30s`
- reconnect sequence: `login -> resolve contract -> subscribe topics`
- increment `ws_reconnect_count`.

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; python -m pytest tests/test_market_ingestion_runner.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/runner.py apps/backend/tests/test_market_ingestion_runner.py
git commit -m "feat: add reconnect and resubscribe runner"
```

### Task 7: Wire startup lifecycle and observability metrics

**Files:**
- Modify: `apps/backend/app/services/metrics.py`
- Modify: `apps/backend/app/state.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_market_ingestion_startup.py`

**Step 1: Write the failing test**

```python
from fastapi.testclient import TestClient
from app.main import app


def test_metrics_include_ingestor_gap_signals() -> None:
    client = TestClient(app)
    counters = client.get("/metrics").json()["counters"]
    assert "events_dropped_total" in counters
    assert "ingest_lag_ms" in counters
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; python -m pytest tests/test_market_ingestion_startup.py -v`  
Expected: FAIL with missing metric keys.

**Step 3: Write minimal implementation**

Add metrics:
- `events_received_total`
- `events_written_redis_total`
- `redis_write_latency_ms`
- `ws_reconnect_count`
- `queue_depth`
- `ingest_lag_ms`
- `events_dropped_total`

Wire startup:
- if `INGESTOR_ENABLED=true`, start ingestor background tasks.

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; python -m pytest tests/test_market_ingestion_startup.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/services/metrics.py apps/backend/app/state.py apps/backend/app/main.py apps/backend/tests/test_market_ingestion_startup.py
git commit -m "feat: wire ingestor lifecycle and observability metrics"
```

### Task 8: Add integration test and operations docs (MVP boundary explicit)

**Files:**
- Create: `apps/backend/tests/test_market_ingestion_integration.py`
- Modify: `apps/backend/README.md`
- Create: `apps/backend/docs/market-ingestor-ops.md`
- Modify: `infra/README.md`

**Step 1: Write the failing test**

```python
def test_ingestor_flow_callback_to_redis_write(fake_shioaji, fake_redis) -> None:
    # simulate callback event and assert one Redis stream write occurred
    ...
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; python -m pytest tests/test_market_ingestion_integration.py -v`  
Expected: FAIL with missing fixtures/flow.

**Step 3: Write minimal implementation**

Add docs and test coverage for:
- login prerequisites (`SHIOAJI_API_KEY`, `SHIOAJI_SECRET_KEY`)
- stream naming
- ordering scope (per-stream only)
- gap signal interpretation
- explicit Phase 2 defer: backfill and K-line correction.

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; python -m pytest tests/test_market_ingestion_integration.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/tests/test_market_ingestion_integration.py apps/backend/README.md apps/backend/docs/market-ingestor-ops.md infra/README.md
git commit -m "test/docs: add ingestor integration coverage and mvp runbook"
```

## Final Verification Gate

Run:

```bash
cd apps/backend
python -m pytest -v
```

Expected:
- All new ingestor tests pass.
- Existing auth/billing/realtime tests pass.
- No backfill/K-line logic introduced into ingestor module.

## External References (Design Validation)

- Shioaji login and API usage: https://sinotrade.github.io/
- Shioaji futures market data callbacks/subscriptions: https://sinotrade.github.io/tutor/market_data/streaming/futures/
