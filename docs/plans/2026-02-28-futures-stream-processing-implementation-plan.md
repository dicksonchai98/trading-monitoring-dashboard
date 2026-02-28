# Futures Stream Processing Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the redesigned realtime ingestion pipeline with per-quote-type ordering, fan-out streams, gap detection via `ingest_seq`, and HTTP backfill from Redis Streams.

**Architecture:** Add a market ingestion module that normalizes Shioaji events into contracts, assigns `ingest_seq`, publishes to master Redis streams, and fans out to per-consumer streams. Add a backfill HTTP endpoint for gap recovery. Add minimal 1-minute K-line aggregation with correction events for late ticks (<= 2 minutes).

**Tech Stack:** FastAPI, Pydantic, Redis Streams (redis-py), pytest

---

### Task 1: Add ingestion configuration and stream naming helpers

**Files:**
- Modify: `apps/backend/app/config.py`
- Create: `apps/backend/app/market_ingestion/streaming.py`
- Test: `apps/backend/tests/test_market_ingestion_streaming.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.streaming import stream_name, fanout_stream_name

def test_stream_name_for_quote_type() -> None:
    assert stream_name("tick") == "stream:futures:txfr1:tick"

def test_fanout_stream_name() -> None:
    assert fanout_stream_name("tick", "indicator") == "stream:futures:txfr1:tick:cg:indicator"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_streaming.py -v`  
Expected: FAIL with import error.

**Step 3: Write minimal implementation**

```python
# apps/backend/app/market_ingestion/streaming.py
from __future__ import annotations

from app.config import INGESTION_SYMBOL

def stream_name(quote_type: str) -> str:
    return f"stream:futures:{INGESTION_SYMBOL.lower()}:{quote_type}"

def fanout_stream_name(quote_type: str, consumer: str) -> str:
    return f"{stream_name(quote_type)}:cg:{consumer}"
```

```python
# apps/backend/app/config.py
INGESTION_SYMBOL = os.getenv("INGESTION_SYMBOL", "TXFR1")
FANOUT_CONSUMERS = [c for c in os.getenv("FANOUT_CONSUMERS", "indicator").split(",") if c]
BACKFILL_API_KEY = os.getenv("BACKFILL_API_KEY", "dev-backfill-key")
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_streaming.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/config.py apps/backend/app/market_ingestion/streaming.py apps/backend/tests/test_market_ingestion_streaming.py
git commit -m "feat: add ingestion stream naming helpers"
```

---

### Task 2: Add ingestion contracts with `ingest_seq`

**Files:**
- Create: `apps/backend/app/market_ingestion/contracts.py`
- Test: `apps/backend/tests/test_market_ingestion_contracts.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.contracts import TickEvent

def test_tick_event_requires_core_fields() -> None:
    TickEvent(symbol="TXFR1", ts_event="2026-02-28T08:45:00+08:00", price=20000.0, volume=1, cum_volume=10, ingest_seq=1)
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_contracts.py -v`  
Expected: FAIL with import error.

**Step 3: Write minimal implementation**

```python
# apps/backend/app/market_ingestion/contracts.py
from __future__ import annotations

from pydantic import BaseModel, Field

class BaseEvent(BaseModel):
    symbol: str
    ts_event: str
    ingest_seq: int = Field(gt=0)
    ts_ingest: str | None = None
    event_id: str | None = None
    raw_payload: dict | None = None

class TickEvent(BaseEvent):
    price: float = Field(gt=0)
    volume: int = Field(ge=0)
    cum_volume: int = Field(ge=0)

class BidAskEvent(BaseEvent):
    bid_price: float = Field(gt=0)
    ask_price: float = Field(gt=0)
    bid_volume: int | None = Field(default=None, ge=0)
    ask_volume: int | None = Field(default=None, ge=0)

class QuoteEvent(BaseEvent):
    last_price: float = Field(gt=0)
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_contracts.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/contracts.py apps/backend/tests/test_market_ingestion_contracts.py
git commit -m "feat: add ingestion event contracts"
```

---

### Task 3: Add `ingest_seq` generator per quote type

**Files:**
- Create: `apps/backend/app/market_ingestion/sequence.py`
- Test: `apps/backend/tests/test_market_ingestion_sequence.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.sequence import SequenceTracker

def test_sequence_tracker_increments_per_quote_type() -> None:
    tracker = SequenceTracker()
    assert tracker.next("tick") == 1
    assert tracker.next("tick") == 2
    assert tracker.next("bidask") == 1
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_sequence.py -v`  
Expected: FAIL with import error.

**Step 3: Write minimal implementation**

```python
# apps/backend/app/market_ingestion/sequence.py
from __future__ import annotations

class SequenceTracker:
    def __init__(self) -> None:
        self._seq: dict[str, int] = {}

    def next(self, quote_type: str) -> int:
        current = self._seq.get(quote_type, 0) + 1
        self._seq[quote_type] = current
        return current
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_sequence.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/sequence.py apps/backend/tests/test_market_ingestion_sequence.py
git commit -m "feat: add per-quote-type sequence tracker"
```

---

### Task 4: Implement normalizers with required/optional validation

**Files:**
- Create: `apps/backend/app/market_ingestion/normalizers.py`
- Test: `apps/backend/tests/test_market_ingestion_normalizers.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.normalizers import normalize_tick

def test_normalize_tick_maps_required_fields() -> None:
    raw = {"symbol": "TXFR1", "datetime": "2026-02-28 08:45:00.000", "close": 20000, "volume": 1, "total_volume": 10}
    event = normalize_tick(raw, ingest_seq=1)
    assert event.price == 20000
    assert event.cum_volume == 10
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_normalizers.py -v`  
Expected: FAIL with import error.

**Step 3: Write minimal implementation**

```python
# apps/backend/app/market_ingestion/normalizers.py
from __future__ import annotations

from app.market_ingestion.contracts import BidAskEvent, QuoteEvent, TickEvent

def normalize_tick(raw: dict, ingest_seq: int) -> TickEvent:
    return TickEvent(
        symbol=raw["symbol"],
        ts_event=raw["datetime"],
        price=raw["close"],
        volume=raw["volume"],
        cum_volume=raw["total_volume"],
        ingest_seq=ingest_seq,
        raw_payload=raw,
    )

def normalize_bidask(raw: dict, ingest_seq: int) -> BidAskEvent:
    return BidAskEvent(
        symbol=raw["symbol"],
        ts_event=raw["datetime"],
        bid_price=raw["bid_price"],
        ask_price=raw["ask_price"],
        bid_volume=raw.get("bid_volume"),
        ask_volume=raw.get("ask_volume"),
        ingest_seq=ingest_seq,
        raw_payload=raw,
    )

def normalize_quote(raw: dict, ingest_seq: int) -> QuoteEvent:
    return QuoteEvent(
        symbol=raw["symbol"],
        ts_event=raw["datetime"],
        last_price=raw["last_price"],
        ingest_seq=ingest_seq,
        raw_payload=raw,
    )
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_normalizers.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/normalizers.py apps/backend/tests/test_market_ingestion_normalizers.py
git commit -m "feat: add ingestion normalizers"
```

---

### Task 5: Add Redis stream publisher with fan-out

**Files:**
- Modify: `apps/backend/requirements.txt`
- Create: `apps/backend/app/market_ingestion/redis_publisher.py`
- Test: `apps/backend/tests/test_market_ingestion_publisher.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.redis_publisher import RedisStreamPublisher

class FakeRedis:
    def __init__(self) -> None:
        self.writes = []
    def xadd(self, stream, fields):
        self.writes.append((stream, fields))

def test_publisher_writes_master_and_fanout() -> None:
    redis = FakeRedis()
    publisher = RedisStreamPublisher(redis, fanout_consumers=["indicator"])
    publisher.publish("tick", {"symbol": "TXFR1"})
    assert ("stream:futures:txfr1:tick", {"symbol": "TXFR1"}) in redis.writes
    assert ("stream:futures:txfr1:tick:cg:indicator", {"symbol": "TXFR1"}) in redis.writes
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_publisher.py -v`  
Expected: FAIL with import error.

**Step 3: Write minimal implementation**

```python
# apps/backend/app/market_ingestion/redis_publisher.py
from __future__ import annotations

from app.market_ingestion.streaming import fanout_stream_name, stream_name

class RedisStreamPublisher:
    def __init__(self, redis_client, fanout_consumers: list[str]) -> None:
        self._redis = redis_client
        self._fanout_consumers = fanout_consumers

    def publish(self, quote_type: str, fields: dict) -> None:
        master = stream_name(quote_type)
        self._redis.xadd(master, fields)
        for consumer in self._fanout_consumers:
            self._redis.xadd(fanout_stream_name(quote_type, consumer), fields)
```

```text
# apps/backend/requirements.txt
redis==5.0.1
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_publisher.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/requirements.txt apps/backend/app/market_ingestion/redis_publisher.py apps/backend/tests/test_market_ingestion_publisher.py
git commit -m "feat: add redis stream publisher with fan-out"
```

---

### Task 6: Add ingestion service to normalize and publish

**Files:**
- Create: `apps/backend/app/market_ingestion/service.py`
- Test: `apps/backend/tests/test_market_ingestion_service.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.service import IngestionService

class FakePublisher:
    def __init__(self) -> None:
        self.last = None
    def publish(self, quote_type, fields):
        self.last = (quote_type, fields)

def test_service_handles_tick() -> None:
    publisher = FakePublisher()
    service = IngestionService(publisher=publisher)
    service.handle_message("tick", {"symbol": "TXFR1", "datetime": "2026-02-28 08:45:00.000", "close": 20000, "volume": 1, "total_volume": 10})
    assert publisher.last[0] == "tick"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_service.py -v`  
Expected: FAIL with import error.

**Step 3: Write minimal implementation**

```python
# apps/backend/app/market_ingestion/service.py
from __future__ import annotations

from app.market_ingestion.normalizers import normalize_bidask, normalize_quote, normalize_tick
from app.market_ingestion.sequence import SequenceTracker

class IngestionService:
    def __init__(self, publisher) -> None:
        self._publisher = publisher
        self._sequence = SequenceTracker()
        self._normalizers = {
            "tick": normalize_tick,
            "bidask": normalize_bidask,
            "quote": normalize_quote,
        }

    def handle_message(self, quote_type: str, raw: dict) -> None:
        ingest_seq = self._sequence.next(quote_type)
        event = self._normalizers[quote_type](raw, ingest_seq=ingest_seq)
        self._publisher.publish(quote_type, event.model_dump())
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_service.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/service.py apps/backend/tests/test_market_ingestion_service.py
git commit -m "feat: add ingestion service"
```

---

### Task 7: Add Backfill API with internal token

**Files:**
- Create: `apps/backend/app/routes/backfill.py`
- Modify: `apps/backend/app/main.py`
- Test: `apps/backend/tests/test_backfill_api.py`

**Step 1: Write the failing test**

```python
from fastapi.testclient import TestClient
from app.main import app

def test_backfill_requires_api_key() -> None:
    client = TestClient(app)
    response = client.get("/backfill", params={"symbol": "TXFR1", "quote_type": "tick", "from_seq": 1, "to_seq": 2})
    assert response.status_code == 401
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_backfill_api.py -v`  
Expected: FAIL with 404 or import error.

**Step 3: Write minimal implementation**

```python
# apps/backend/app/routes/backfill.py
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException

from app.config import BACKFILL_API_KEY
from app.market_ingestion.streaming import stream_name

router = APIRouter()

@router.get("/backfill")
def backfill(
    symbol: str,
    quote_type: str,
    from_seq: int,
    to_seq: int,
    x_internal_token: str | None = Header(default=None),
) -> dict:
    if x_internal_token != BACKFILL_API_KEY:
        raise HTTPException(status_code=401, detail="unauthorized")
    # TODO: load from Redis Streams in Task 8
    return {"stream": stream_name(quote_type), "events": []}
```

```python
# apps/backend/app/main.py
from app.routes import admin, analytics, auth, billing, realtime, backfill
app.include_router(backfill.router)
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_backfill_api.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/routes/backfill.py apps/backend/app/main.py apps/backend/tests/test_backfill_api.py
git commit -m "feat: add backfill API with internal auth"
```

---

### Task 8: Implement Redis-backed backfill response

**Files:**
- Modify: `apps/backend/app/routes/backfill.py`
- Create: `apps/backend/app/market_ingestion/backfill.py`
- Test: `apps/backend/tests/test_market_ingestion_backfill.py`

**Step 1: Write the failing test**

```python
from app.market_ingestion.backfill import BackfillReader

class FakeRedis:
    def __init__(self, entries):
        self.entries = entries
    def xrange(self, stream, min, max):
        return self.entries

def test_backfill_reader_filters_by_ingest_seq() -> None:
    entries = [
        ("1-0", {"ingest_seq": "1"}),
        ("2-0", {"ingest_seq": "2"}),
    ]
    reader = BackfillReader(FakeRedis(entries))
    events = reader.read("stream:futures:txfr1:tick", 2, 2)
    assert len(events) == 1
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_market_ingestion_backfill.py -v`  
Expected: FAIL with import error.

**Step 3: Write minimal implementation**

```python
# apps/backend/app/market_ingestion/backfill.py
from __future__ import annotations

class BackfillReader:
    def __init__(self, redis_client) -> None:
        self._redis = redis_client

    def read(self, stream: str, from_seq: int, to_seq: int) -> list[dict]:
        entries = self._redis.xrange(stream, min="-", max="+")
        results = []
        for _, fields in entries:
            ingest_seq = int(fields.get("ingest_seq", 0))
            if from_seq <= ingest_seq <= to_seq:
                results.append(fields)
        return results
```

```python
# apps/backend/app/routes/backfill.py (replace TODO block)
from app.market_ingestion.backfill import BackfillReader
from app.services.redis_client import get_redis

reader = BackfillReader(get_redis())
events = reader.read(stream_name(quote_type), from_seq, to_seq)
return {"events": events}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_market_ingestion_backfill.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/backfill.py apps/backend/app/routes/backfill.py apps/backend/tests/test_market_ingestion_backfill.py
git commit -m "feat: add redis-backed backfill reader"
```

---

### Task 9: Add 1-minute K-line aggregation with correction events

**Files:**
- Create: `apps/backend/app/indicator/kline_1m.py`
- Create: `apps/backend/app/indicator/contracts.py`
- Test: `apps/backend/tests/test_indicator_kline_1m.py`

**Step 1: Write the failing test**

```python
from app.indicator.kline_1m import KLineAggregator

def test_kline_correction_for_late_tick() -> None:
    agg = KLineAggregator(late_window_seconds=120)
    agg.on_tick({"ts_event": "2026-02-28T08:45:10+08:00", "price": 100, "volume": 1})
    agg.finalize_minute("2026-02-28T08:45:00+08:00")
    correction = agg.on_tick({"ts_event": "2026-02-28T08:45:20+08:00", "price": 110, "volume": 1})
    assert correction["event_type"] == "correction"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend; pytest tests/test_indicator_kline_1m.py -v`  
Expected: FAIL with import error.

**Step 3: Write minimal implementation**

```python
# apps/backend/app/indicator/contracts.py
from __future__ import annotations

from pydantic import BaseModel

class KLineEvent(BaseModel):
    event_type: str  # "snapshot" | "correction"
    minute_ts: str
    open: float
    high: float
    low: float
    close: float
    volume: int
    revision: int
```

```python
# apps/backend/app/indicator/kline_1m.py
from __future__ import annotations

from datetime import datetime, timedelta
from app.indicator.contracts import KLineEvent

class KLineAggregator:
    def __init__(self, late_window_seconds: int) -> None:
        self._late_window = timedelta(seconds=late_window_seconds)
        self._buckets: dict[str, dict] = {}
        self._finalized: dict[str, int] = {}

    def on_tick(self, tick: dict) -> dict | None:
        minute_ts = tick["ts_event"][:16] + ":00+08:00"
        bucket = self._buckets.setdefault(minute_ts, {"open": tick["price"], "high": tick["price"], "low": tick["price"], "close": tick["price"], "volume": 0})
        bucket["high"] = max(bucket["high"], tick["price"])
        bucket["low"] = min(bucket["low"], tick["price"])
        bucket["close"] = tick["price"]
        bucket["volume"] += tick["volume"]

        if minute_ts in self._finalized:
            self._finalized[minute_ts] += 1
            return KLineEvent(
                event_type="correction",
                minute_ts=minute_ts,
                open=bucket["open"],
                high=bucket["high"],
                low=bucket["low"],
                close=bucket["close"],
                volume=bucket["volume"],
                revision=self._finalized[minute_ts],
            ).model_dump()
        return None

    def finalize_minute(self, minute_ts: str) -> dict:
        self._finalized[minute_ts] = 0
        bucket = self._buckets[minute_ts]
        return KLineEvent(
            event_type="snapshot",
            minute_ts=minute_ts,
            open=bucket["open"],
            high=bucket["high"],
            low=bucket["low"],
            close=bucket["close"],
            volume=bucket["volume"],
            revision=0,
        ).model_dump()
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend; pytest tests/test_indicator_kline_1m.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/indicator/contracts.py apps/backend/app/indicator/kline_1m.py apps/backend/tests/test_indicator_kline_1m.py
git commit -m "feat: add 1m kline aggregation with corrections"
```

---

Plan complete and saved to `docs/plans/2026-02-28-futures-stream-processing-implementation-plan.md`. Two execution options:

1. Subagent-Driven (this session)  
2. Parallel Session (separate)

Which approach?
