# Real-Time Data Ingestor (Ordering + Gap Signals MVP) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Redis Streams ingestor that guarantees per-stream write ordering and emits gap-detection signals, while deferring backfill and K-line correction to Phase 2.

**Architecture:** Add a dedicated `market_ingestion` module in backend with a callback-to-queue-to-writer pipeline. Keep ingestor stateless and transport-focused: normalize lightweight envelope, write with Redis `XADD MAXLEN ~`, and expose metrics/reconnect signals. Downstream services consume ordering and gap signals; they own gap decisions and correction logic.

**Tech Stack:** FastAPI, Python, redis-py, asyncio, pytest

---

### Task 1: Add ingestion configuration and stream naming primitives

**Files:**
- Modify: `apps/backend/app/config.py`
- Create: `apps/backend/app/market_ingestion/__init__.py`
- Create: `apps/backend/app/market_ingestion/stream_keys.py`
- Test: `apps/backend/tests/test_market_ingestion_stream_keys.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.stream_keys import stream_key


def test_stream_key_uses_env_quote_type_and_code() -> None:
    assert stream_key(env="prod", quote_type="tick", code="MTX") == "prod:stream:tick:MTX"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_stream_keys.py -v`  
Expected: FAIL with import/module not found.

**Step 3: Write minimal implementation**

```python
def stream_key(env: str, quote_type: str, code: str) -> str:
    return f"{env}:stream:{quote_type}:{code}"
```

Also add config defaults:

```python
INGESTOR_ENV = os.getenv("INGESTOR_ENV", "dev")
INGESTOR_CODE = os.getenv("INGESTOR_CODE", "MTX")
INGESTOR_STREAM_MAXLEN = int(os.getenv("INGESTOR_STREAM_MAXLEN", "100000"))
INGESTOR_QUEUE_MAXSIZE = int(os.getenv("INGESTOR_QUEUE_MAXSIZE", "5000"))
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_stream_keys.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/config.py apps/backend/app/market_ingestion/__init__.py apps/backend/app/market_ingestion/stream_keys.py apps/backend/tests/test_market_ingestion_stream_keys.py
git commit -m "feat: add ingestion config and stream key helper"
```

### Task 2: Add lightweight envelope contract for ingest events

**Files:**
- Create: `apps/backend/app/market_ingestion/contracts.py`
- Test: `apps/backend/tests/test_market_ingestion_contracts.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.contracts import make_envelope


def test_make_envelope_keeps_payload_and_adds_timestamps() -> None:
    raw = {"close": 20123.0, "volume": 2}
    event = make_envelope(source="shioaji", code="MTX", quote_type="tick", event_ts="2026-02-28T01:00:00Z", payload=raw)
    assert event["payload"] == raw
    assert event["source"] == "shioaji"
    assert "recv_ts" in event
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_contracts.py -v`  
Expected: FAIL with import/module not found.

**Step 3: Write minimal implementation**

```python
from datetime import datetime, timezone


def make_envelope(source: str, code: str, quote_type: str, event_ts: str, payload: dict) -> dict:
    return {
        "source": source,
        "code": code,
        "quote_type": quote_type,
        "event_ts": event_ts,
        "recv_ts": datetime.now(timezone.utc).isoformat(),
        "payload": payload,
    }
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_contracts.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/contracts.py apps/backend/tests/test_market_ingestion_contracts.py
git commit -m "feat: add ingestion envelope contract"
```

### Task 3: Implement queue writer that preserves per-stream ordering

**Files:**
- Create: `apps/backend/app/market_ingestion/writer.py`
- Test: `apps/backend/tests/test_market_ingestion_writer.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.writer import RedisWriter


def test_writer_uses_fifo_order_for_same_stream() -> None:
    redis = FakeRedis()
    writer = RedisWriter(redis_client=redis, maxlen=100000)
    writer.write("dev:stream:tick:MTX", {"seq": 1})
    writer.write("dev:stream:tick:MTX", {"seq": 2})
    assert redis.writes[0][1]["seq"] == 1
    assert redis.writes[1][1]["seq"] == 2
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_writer.py -v`  
Expected: FAIL with import/module not found.

**Step 3: Write minimal implementation**

```python
class RedisWriter:
    def __init__(self, redis_client, maxlen: int) -> None:
        self._redis = redis_client
        self._maxlen = maxlen

    def write(self, stream: str, fields: dict) -> str:
        return self._redis.xadd(stream, fields, maxlen=self._maxlen, approximate=True)
```

Add an async consumer loop in same module that pulls from `asyncio.Queue` and writes sequentially with one task.

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_writer.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/writer.py apps/backend/tests/test_market_ingestion_writer.py
git commit -m "feat: add redis writer with per-stream order semantics"
```

### Task 4: Add backpressure and gap-signal metrics

**Files:**
- Modify: `apps/backend/app/services/metrics.py`
- Create: `apps/backend/app/market_ingestion/signals.py`
- Test: `apps/backend/tests/test_market_ingestion_signals.py`

**Step 1: Write the failing test**

```python
from app.services.metrics import Metrics


def test_metrics_include_gap_signals() -> None:
    metrics = Metrics()
    required = {"events_received_total", "events_written_redis_total", "ws_reconnect_count", "queue_depth", "ingest_lag_ms", "events_dropped_total"}
    assert required.issubset(set(metrics.counters))
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_signals.py -v`  
Expected: FAIL because keys are missing.

**Step 3: Write minimal implementation**

Add counters in `Metrics.__init__`:

```python
"events_received_total": 0,
"events_written_redis_total": 0,
"ws_reconnect_count": 0,
"queue_depth": 0,
"ingest_lag_ms": 0,
"events_dropped_total": 0,
```

In `signals.py`, add helpers to update queue depth, dropped events, and lag from `event_ts`.

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_signals.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/services/metrics.py apps/backend/app/market_ingestion/signals.py apps/backend/tests/test_market_ingestion_signals.py
git commit -m "feat: add ingestion gap-signal metrics"
```

### Task 5: Implement reconnect and resubscribe orchestration

**Files:**
- Create: `apps/backend/app/market_ingestion/runner.py`
- Create: `apps/backend/tests/test_market_ingestion_runner.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.runner import reconnect_delays


def test_reconnect_delays_capped_at_30_seconds() -> None:
    assert reconnect_delays(6) == [1, 2, 4, 8, 16, 30]
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_runner.py -v`  
Expected: FAIL with import/module not found.

**Step 3: Write minimal implementation**

```python
def reconnect_delays(attempts: int) -> list[int]:
    delays: list[int] = []
    current = 1
    for _ in range(attempts):
        delays.append(min(current, 30))
        current *= 2
    return delays
```

Add runner methods:
- `connect_login_subscribe()`
- `run_forever()` with retry loop
- increment `ws_reconnect_count` on reconnect.

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_runner.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/runner.py apps/backend/tests/test_market_ingestion_runner.py
git commit -m "feat: add reconnect and resubscribe runner"
```

### Task 6: Wire app startup and provide integration coverage

**Files:**
- Modify: `apps/backend/app/state.py`
- Modify: `apps/backend/app/main.py`
- Create: `apps/backend/tests/test_market_ingestion_pipeline.py`
- Modify: `apps/backend/tests/conftest.py`

**Step 1: Write the failing test**

```python
def test_pipeline_drops_when_queue_full_and_increments_counter(app_client) -> None:
    # Fill queue, push one more event, then verify events_dropped_total increased.
    response = app_client.get("/metrics")
    assert response.status_code == 200
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_pipeline.py -v`  
Expected: FAIL because pipeline wiring/fixtures are missing.

**Step 3: Write minimal implementation**

- Initialize ingestor dependencies in `state.py`.
- Start ingestor runner in FastAPI startup when env flag `INGESTOR_ENABLED=true`.
- Keep test mode deterministic by defaulting `INGESTOR_ENABLED=false` in tests.

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_pipeline.py -v`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/state.py apps/backend/app/main.py apps/backend/tests/test_market_ingestion_pipeline.py apps/backend/tests/conftest.py
git commit -m "feat: wire ingestion pipeline lifecycle with tests"
```

### Task 7: Update docs and explicitly defer Phase 2 items

**Files:**
- Modify: `apps/backend/README.md`
- Create: `apps/backend/docs/market-ingestor-ops.md`
- Modify: `infra/README.md`

**Step 1: Write the failing docs checklist**

```text
Checklist:
1) Env vars and stream key format documented.
2) Ordering guarantee scope documented (per-stream only).
3) Gap-signal metrics documented.
4) Backfill and K-line correction marked Phase 2.
```

**Step 2: Run checklist and verify it fails**

Run: manual checklist review  
Expected: At least one checklist item missing.

**Step 3: Write minimal documentation updates**

- Add startup/env section for ingestor.
- Add troubleshooting for reconnect, queue overflow, lag.
- Add "Not in MVP" section for backfill and K-line correction.

**Step 4: Run checklist and verify it passes**

Run: manual checklist review  
Expected: All checklist items complete.

**Step 5: Commit**

```bash
git add apps/backend/README.md apps/backend/docs/market-ingestor-ops.md infra/README.md
git commit -m "docs: add ingestor mvp operations and phase-2 boundaries"
```

## Final Verification Gate

Run:

```bash
cd apps/backend
pytest -v
```

Expected:
- New market ingestor tests pass.
- Existing auth/billing/realtime tests pass without regression.

## Required Skills During Execution

- `@test-driven-development` for each code task.
- `@systematic-debugging` whenever a test fails unexpectedly.
- `@verification-before-completion` before claiming completion.
