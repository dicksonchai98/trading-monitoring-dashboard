# Futures Realtime Ingestion (TXFR1, tick/bidask/quote) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a FastAPI backend ingestion pipeline that subscribes to Shioaji futures realtime data (`TXFR1`) for `tick`, `bidask`, and `quote`, normalizes each payload into internal events, and publishes them to dedicated Redis Streams.

**Architecture:** Add a `market_ingestion` module with clear adapter/normalizer/publisher boundaries. Keep external API coupling inside adapter+normalizers, publish only internal event schema to Redis streams, and isolate per-message failures. Use TDD for contract mapping, publish behavior, and reconnect logic.

**Tech Stack:** Python, FastAPI, pytest, Redis (redis-py), Shioaji SDK, structured logging.

---

### Task 1: Create ingestion module skeleton and contracts

**Files:**
- Create: `apps/backend/app/market_ingestion/__init__.py`
- Create: `apps/backend/app/market_ingestion/contracts.py`
- Test: `apps/backend/tests/test_market_ingestion_contracts.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.contracts import TickEvent


def test_tick_event_requires_core_fields() -> None:
    event = TickEvent(
        symbol="TXFR1",
        ts_event="2026-02-27T09:00:00+08:00",
        price=20123.0,
        volume=3,
        cum_volume=100,
    )
    assert event.symbol == "TXFR1"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_contracts.py::test_tick_event_requires_core_fields -v`
Expected: FAIL with import/module not found.

**Step 3: Write minimal implementation**

```python
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class TickEvent:
    symbol: str
    ts_event: str
    price: float
    volume: int
    cum_volume: int
    source: str = "shioaji"
    market_type: str = "futures"
    session: str | None = None
    ingest_seq: int | None = None
    raw_payload: dict[str, Any] | None = None
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_contracts.py::test_tick_event_requires_core_fields -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/__init__.py apps/backend/app/market_ingestion/contracts.py apps/backend/tests/test_market_ingestion_contracts.py
git commit -m "feat: add market ingestion event contracts"
```

### Task 2: Implement normalizers for tick/bidask/quote with strict-required validation

**Files:**
- Create: `apps/backend/app/market_ingestion/normalizers.py`
- Modify: `apps/backend/app/market_ingestion/contracts.py`
- Test: `apps/backend/tests/test_market_ingestion_normalizers.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.normalizers import normalize_tick


def test_normalize_tick_maps_required_and_optional_fields() -> None:
    raw = {
        "symbol": "TXFR1",
        "datetime": "2026-02-27 09:01:00.123",
        "close": 20125.0,
        "volume": 2,
        "total_volume": 120,
    }
    event = normalize_tick(raw, ingest_seq=1)
    assert event.price == 20125.0
    assert event.cum_volume == 120
    assert event.ingest_seq == 1
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_normalizers.py::test_normalize_tick_maps_required_and_optional_fields -v`
Expected: FAIL with missing normalizer function.

**Step 3: Write minimal implementation**

```python
def normalize_tick(raw: dict, ingest_seq: int) -> TickEvent:
    symbol = raw["symbol"]
    ts_event = to_iso8601(raw["datetime"])
    price = float(raw["close"])
    volume = int(raw["volume"])
    cum_volume = int(raw["total_volume"])
    return TickEvent(
        symbol=symbol,
        ts_event=ts_event,
        price=price,
        volume=volume,
        cum_volume=cum_volume,
        session="day",
        ingest_seq=ingest_seq,
        raw_payload=raw,
    )
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_normalizers.py -v`
Expected: PASS, including invalid-required-field tests returning `None` or raising controlled validation errors.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/contracts.py apps/backend/app/market_ingestion/normalizers.py apps/backend/tests/test_market_ingestion_normalizers.py
git commit -m "feat: add futures quote normalizers with required-field validation"
```

### Task 3: Add Redis stream publisher with per-event stream routing

**Files:**
- Create: `apps/backend/app/market_ingestion/publisher.py`
- Test: `apps/backend/tests/test_market_ingestion_publisher.py`
- Modify: `apps/backend/requirements.txt`

**Step 1: Write the failing test**

```python
from app.market_ingestion.publisher import stream_name_for_quote_type


def test_stream_name_for_quote_type() -> None:
    assert stream_name_for_quote_type("tick") == "stream:futures:txfr1:tick"
    assert stream_name_for_quote_type("bidask") == "stream:futures:txfr1:bidask"
    assert stream_name_for_quote_type("quote") == "stream:futures:txfr1:quote"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_publisher.py::test_stream_name_for_quote_type -v`
Expected: FAIL with module missing.

**Step 3: Write minimal implementation**

```python
STREAM_NAMES = {
    "tick": "stream:futures:txfr1:tick",
    "bidask": "stream:futures:txfr1:bidask",
    "quote": "stream:futures:txfr1:quote",
}


def stream_name_for_quote_type(quote_type: str) -> str:
    return STREAM_NAMES[quote_type]
```

Add publish method using `redis.xadd(stream, payload)` with retry schedule `100/300/500ms`.

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_publisher.py -v`
Expected: PASS including retry-path tests with mocked Redis client.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/publisher.py apps/backend/tests/test_market_ingestion_publisher.py apps/backend/requirements.txt
git commit -m "feat: add redis stream publisher for futures ingestion"
```

### Task 4: Implement Shioaji futures adapter with three subscriptions and reconnect backoff

**Files:**
- Create: `apps/backend/app/market_ingestion/shioaji_futures_adapter.py`
- Test: `apps/backend/tests/test_shioaji_futures_adapter.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.shioaji_futures_adapter import ShioajiFuturesAdapter


def test_subscribe_registers_tick_bidask_quote() -> None:
    api = FakeShioajiApi()
    adapter = ShioajiFuturesAdapter(api=api, symbol="TXFR1")
    adapter.subscribe_all()
    assert api.calls == [
        ("TXFR1", "tick"),
        ("TXFR1", "bidask"),
        ("TXFR1", "quote"),
    ]
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_shioaji_futures_adapter.py::test_subscribe_registers_tick_bidask_quote -v`
Expected: FAIL with missing adapter.

**Step 3: Write minimal implementation**

```python
class ShioajiFuturesAdapter:
    def __init__(self, api, symbol: str = "TXFR1") -> None:
        self.api = api
        self.symbol = symbol

    def subscribe_all(self) -> None:
        for quote_type in ("tick", "bidask", "quote"):
            self.api.subscribe(self.symbol, quote_type=quote_type)
```

Add reconnect loop with capped exponential backoff (`1,2,4,...,30` seconds).

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_shioaji_futures_adapter.py -v`
Expected: PASS for subscribe and reconnect timing behavior.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/shioaji_futures_adapter.py apps/backend/tests/test_shioaji_futures_adapter.py
git commit -m "feat: add shioaji futures adapter with reconnect backoff"
```

### Task 5: Wire ingestion service orchestration (adapter -> normalizer -> publisher)

**Files:**
- Create: `apps/backend/app/market_ingestion/service.py`
- Test: `apps/backend/tests/test_market_ingestion_service.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.service import MarketIngestionService


def test_service_processes_tick_and_publishes_to_tick_stream() -> None:
    service = MarketIngestionService(adapter=FakeAdapter(), publisher=FakePublisher())
    service.handle_message("tick", {"symbol": "TXFR1", "datetime": "2026-02-27 09:01:00.000", "close": 20100, "volume": 1, "total_volume": 10})
    assert service.publisher.last_stream == "stream:futures:txfr1:tick"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_service.py::test_service_processes_tick_and_publishes_to_tick_stream -v`
Expected: FAIL with missing orchestration.

**Step 3: Write minimal implementation**

```python
NORMALIZE_BY_TYPE = {
    "tick": normalize_tick,
    "bidask": normalize_bidask,
    "quote": normalize_quote,
}


def handle_message(self, quote_type: str, raw: dict) -> None:
    normalizer = NORMALIZE_BY_TYPE[quote_type]
    event = normalizer(raw, ingest_seq=self.next_seq())
    if event is None:
        return
    self.publisher.publish(quote_type, event)
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_service.py -v`
Expected: PASS including malformed-event isolation tests.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/service.py apps/backend/tests/test_market_ingestion_service.py
git commit -m "feat: add ingestion service orchestration pipeline"
```

### Task 6: Add ingestion metrics and startup lifecycle integration

**Files:**
- Modify: `apps/backend/app/services/metrics.py`
- Modify: `apps/backend/app/state.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_market_ingestion_startup.py`

**Step 1: Write the failing test**

```python
from fastapi.testclient import TestClient
from app.main import app


def test_metrics_expose_ingestion_counters() -> None:
    client = TestClient(app)
    payload = client.get("/metrics").json()
    assert "ingestion_events_total.tick.success" in payload["counters"]
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_startup.py::test_metrics_expose_ingestion_counters -v`
Expected: FAIL with missing counter keys.

**Step 3: Write minimal implementation**

```python
self.counters.update(
    {
        "ingestion_events_total.tick.success": 0,
        "ingestion_events_total.tick.drop": 0,
        "ingestion_events_total.bidask.success": 0,
        "ingestion_events_total.quote.success": 0,
        "redis_publish_total.tick.success": 0,
        "reconnect_total": 0,
    }
)
```

Add startup hook to initialize ingestion service process (feature-flagged by env, disabled in tests).

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_startup.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/services/metrics.py apps/backend/app/state.py apps/backend/app/main.py apps/backend/tests/test_market_ingestion_startup.py
git commit -m "feat: wire ingestion lifecycle and counters"
```

### Task 7: End-to-end integration test for three stream outputs

**Files:**
- Create: `apps/backend/tests/test_market_ingestion_integration.py`
- Modify: `apps/backend/tests/conftest.py`

**Step 1: Write the failing test**

```python
def test_ingestion_routes_each_quote_type_to_dedicated_stream(fake_redis, ingestion_service) -> None:
    ingestion_service.handle_message("tick", valid_tick_raw())
    ingestion_service.handle_message("bidask", valid_bidask_raw())
    ingestion_service.handle_message("quote", valid_quote_raw())

    assert fake_redis.was_written("stream:futures:txfr1:tick")
    assert fake_redis.was_written("stream:futures:txfr1:bidask")
    assert fake_redis.was_written("stream:futures:txfr1:quote")
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_integration.py::test_ingestion_routes_each_quote_type_to_dedicated_stream -v`
Expected: FAIL with missing fixtures/helpers.

**Step 3: Write minimal implementation**

Implement `fake_redis` fixture and helper builders for valid raw payloads in `conftest.py`.

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_integration.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/tests/test_market_ingestion_integration.py apps/backend/tests/conftest.py
git commit -m "test: add integration coverage for futures ingestion stream routing"
```

### Task 8: Documentation and operational runbook updates

**Files:**
- Modify: `apps/backend/README.md`
- Create: `apps/backend/docs/futures-ingestion-ops.md`
- Modify: `infra/.env.backend.example`

**Step 1: Write the failing documentation check**

```text
Checklist:
- README has ingestion env vars and start instructions.
- Ops doc has reconnect and publish-failure troubleshooting.
- Env template has ingestion flags.
```

**Step 2: Run check to verify it fails**

Run: manual review against checklist
Expected: Missing ingestion docs/vars.

**Step 3: Write minimal documentation updates**

Add:
- Required env vars (`INGESTION_ENABLED`, `SHIOAJI_API_KEY`, `SHIOAJI_SECRET_KEY`, `REDIS_URL`)
- Local run/test commands
- Stream names and expected message shapes
- Failure playbook and metrics interpretation

**Step 4: Run check to verify it passes**

Run: manual checklist review
Expected: All checklist items complete.

**Step 5: Commit**

```bash
git add apps/backend/README.md apps/backend/docs/futures-ingestion-ops.md infra/.env.backend.example
git commit -m "docs: add futures ingestion runbook and env guidance"
```

## Final Verification Gate

Run full backend test suite before merge:

```bash
cd apps/backend
pytest -v
```

Expected:
- All existing tests pass.
- New ingestion tests pass.
- No regression on auth/billing/realtime routes.

