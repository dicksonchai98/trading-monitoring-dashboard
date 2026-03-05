# Aggregator Dynamic Code Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure the aggregator derives `code` from each stream entry and routes Redis state keys and Postgres writes by that code.

**Architecture:** Update stream entry parsing to extract `code`, maintain per-code state machines, and use per-entry `code` for Redis state keys and `kbars_1m` persistence. Keep stream consumption via existing configured stream keys.

**Tech Stack:** FastAPI (Python), Redis Streams, SQLAlchemy, Alembic, pytest

---

### Task 1: Add per-code state containers and code parsing

**Files:**
- Modify: `apps/backend/app/stream_processing/runner.py`
- Test: `apps/backend/tests/test_stream_processing_integration.py`

**Step 1: Write the failing test**

```python
def test_stream_processing_routes_by_entry_code() -> None:
    redis = FakeRedis()
    runner = build_runner(redis)
    tick_stream = "dev:stream:tick:MTX"
    redis.xadd(
        tick_stream,
        build_event_fields("tick", "2026-03-05T09:30:10+08:00", {"price": 100, "volume": 1}, code="TXFC6"),
    )
    assert runner.consume_tick_once() == 1
    trade_date = datetime.fromisoformat("2026-03-04").date()
    current_key = build_state_key("dev", "TXFC6", trade_date, "k:current")
    assert current_key in redis.hashes
```

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_stream_processing_integration.py::test_stream_processing_routes_by_entry_code -v`  
Expected: FAIL (still writes state with default code)

**Step 3: Write minimal implementation**

```python
# runner.py
def _extract_code(self, data: dict[str, Any]) -> str | None:
    code = data.get("code")
    if isinstance(code, str) and code.strip():
        return code
    return None

def _get_tick_state(self, code: str) -> TickStateMachine:
    return self._tick_states.setdefault(code, TickStateMachine())
```

Update tick/bidask handlers to:
- call `_extract_code` from entry data
- use `code` for state machine and Redis key building
- drop entry + increment `late_tick_drops` if missing code

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_stream_processing_integration.py::test_stream_processing_routes_by_entry_code -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/stream_processing/runner.py apps/backend/tests/test_stream_processing_integration.py
git commit -m "feat: route aggregator state by entry code"
```

---

### Task 2: Update bidask path and carry-forward sampling by code

**Files:**
- Modify: `apps/backend/app/stream_processing/runner.py`
- Test: `apps/backend/tests/test_stream_processing_integration.py`

**Step 1: Write the failing test**

```python
def test_metrics_written_for_entry_code() -> None:
    redis = FakeRedis()
    runner = build_runner(redis)
    bidask_stream = "dev:stream:bidask:MTX"
    redis.xadd(
        bidask_stream,
        build_event_fields("bidask", "2026-03-05T09:31:02+08:00", {"bid": 100, "ask": 102}, code="TXFC6"),
    )
    assert runner.consume_bidask_once() == 1
    trade_date = datetime.fromisoformat("2026-03-04").date()
    metrics_key = build_state_key("dev", "TXFC6", trade_date, "metrics:latest")
    assert metrics_key in redis.strings
```

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_stream_processing_integration.py::test_metrics_written_for_entry_code -v`  
Expected: FAIL (writes with default code)

**Step 3: Write minimal implementation**

```python
# runner.py
def _get_bidask_state(self, code: str) -> BidAskStateMachine:
    return self._bidask_states.setdefault(code, BidAskStateMachine(MetricsRegistry()))

def _write_latest_metrics(self, metrics: dict[str, Any], event_ts: datetime, code: str) -> None:
    trade_date = trade_date_for(event_ts)
    key = build_state_key(self._env, code, trade_date, "metrics:latest")
    ...
```

Update sampling calls to pass `code` and maintain per-code `BidAskStateMachine`.

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_stream_processing_integration.py::test_metrics_written_for_entry_code -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/stream_processing/runner.py apps/backend/tests/test_stream_processing_integration.py
git commit -m "feat: route bidask metrics by entry code"
```

---

### Task 3: Persist kbars with entry code and update tests

**Files:**
- Modify: `apps/backend/app/stream_processing/runner.py`
- Test: `apps/backend/tests/test_stream_processing_integration.py`

**Step 1: Write the failing test**

```python
def test_kbars_persist_with_entry_code() -> None:
    redis = FakeRedis()
    runner = build_runner(redis)
    tick_stream = "dev:stream:tick:MTX"
    redis.xadd(
        tick_stream,
        build_event_fields("tick", "2026-03-05T09:30:10+08:00", {"price": 100, "volume": 1}, code="TXFC6"),
    )
    redis.xadd(
        tick_stream,
        build_event_fields("tick", "2026-03-05T09:31:05+08:00", {"price": 101, "volume": 2}, code="TXFC6"),
    )
    assert runner.consume_tick_once() == 2
    with SessionLocal() as session:
        rows = session.query(Kbar1mModel).all()
        assert rows[0].code == "TXFC6"
```

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_stream_processing_integration.py::test_kbars_persist_with_entry_code -v`  
Expected: FAIL (code still default)

**Step 3: Write minimal implementation**

```python
# runner.py
archived, dropped = tick_state.apply_tick(code, event_ts, payload)
...
def _persist_kbar(self, bar: KBar) -> None:
    record = Kbar1mModel(code=bar.code, ...)
```

Ensure `code` is set from entry for each bar and persisted.

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_stream_processing_integration.py::test_kbars_persist_with_entry_code -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/stream_processing/runner.py apps/backend/tests/test_stream_processing_integration.py
git commit -m "feat: persist kbars with entry code"
```

---

### Task 4: Update helper builders to accept code and adjust integration tests

**Files:**
- Modify: `apps/backend/tests/test_stream_processing_integration.py`

**Step 1: Write the failing test**

```python
def test_build_event_fields_accepts_code() -> None:
    fields = build_event_fields("tick", "2026-03-05T09:30:10+08:00", {"price": 100}, code="TXFC6")
    assert fields["code"] == "TXFC6"
```

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_stream_processing_integration.py::test_build_event_fields_accepts_code -v`  
Expected: FAIL (helper ignores code)

**Step 3: Write minimal implementation**

```python
def build_event_fields(quote_type: str, event_ts: str, payload: dict[str, object], code: str = "MTX") -> dict[str, str]:
    event = {..., "code": code, ...}
```

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_stream_processing_integration.py::test_build_event_fields_accepts_code -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/tests/test_stream_processing_integration.py
git commit -m "test: allow stream processing tests to set entry code"
```

---

### Task 5: Verify missing code drops and metrics

**Files:**
- Modify: `apps/backend/app/stream_processing/runner.py`
- Test: `apps/backend/tests/test_stream_processing_nonfunctional.py`

**Step 1: Write the failing test**

```python
def test_missing_code_drops_entry_and_increments_metric() -> None:
    redis = FakeRedis()
    metrics = Metrics()
    runner = build_runner(redis, metrics=metrics)
    tick_stream = "dev:stream:tick:MTX"
    fields = RedisWriter.to_redis_fields({"source": "shioaji", "code": "", "quote_type": "tick", "event_ts": "2026-03-05T09:00:00+08:00", "recv_ts": "2026-03-05T01:00:00+00:00", "payload": {"price": 100}})
    redis.xadd(tick_stream, fields)
    assert runner.consume_tick_once() == 1
    assert metrics.counters["late_tick_drops"] == 1
```

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_stream_processing_nonfunctional.py::test_missing_code_drops_entry_and_increments_metric -v`  
Expected: FAIL

**Step 3: Write minimal implementation**

```python
code = self._extract_code(data)
if code is None:
    self._metrics.inc("late_tick_drops")
    return True
```

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_stream_processing_nonfunctional.py::test_missing_code_drops_entry_and_increments_metric -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/stream_processing/runner.py apps/backend/tests/test_stream_processing_nonfunctional.py
git commit -m "feat: drop entries with missing code"
```

---

### Task 6: Full test run

**Files:**
- Test: `apps/backend/tests/...`

**Step 1: Run full backend tests**

Run: `pytest apps/backend/tests -v`  
Expected: PASS

**Step 2: Commit**

```bash
git status
```

---

