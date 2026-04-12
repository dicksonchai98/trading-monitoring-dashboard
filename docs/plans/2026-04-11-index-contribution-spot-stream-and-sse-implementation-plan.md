# Index Contribution Spot Stream + SSE Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `index_contribution_worker` consume `dev:stream:spot` events reliably for the 150-symbol feed and expose contribution ranking/sector updates via existing `/v1/stream/sse`.

**Architecture:** Extend `IndexContributionRunner` with a Redis Stream consumer loop (`XAUTOCLAIM` + `XREADGROUP`) and deterministic parsing/idempotency logic. Keep worker API-independent and continue writing Redis + 1m DB snapshots. Extend serving layer to read contribution Redis keys and emit two additional SSE events when state changes.

**Tech Stack:** FastAPI, Python, Redis Streams, SQLAlchemy, pytest, frontend TypeScript + zod.

---

### Task 1: Spot Stream Event Parser and Price Fallback

**Files:**
- Modify: `apps/backend/app/index_contribution/runner.py`
- Test: `apps/backend/tests/test_index_contribution_runner.py`

**Step 1: Write the failing test**

```python
def test_parse_spot_entry_uses_raw_quote_close_when_last_price_zero() -> None:
    runner = _build_runner()
    entry_id = "1775802833106-0"
    fields = {
        "symbol": "6505",
        "event_ts": "2026-04-10T14:30:00",
        "last_price": "0",
        "payload": json.dumps({"raw_quote": {"close": "52"}}),
    }

    parsed = runner._parse_spot_entry(entry_id, fields)  # noqa: SLF001

    assert parsed is not None
    assert parsed["symbol"] == "6505"
    assert parsed["last_price"] == 52.0
```

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_index_contribution_runner.py::test_parse_spot_entry_uses_raw_quote_close_when_last_price_zero -v`
Expected: FAIL with missing parser behavior.

**Step 3: Write minimal implementation**

```python
def _parse_spot_entry(self, entry_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    symbol = str(fields.get("symbol", "")).strip()
    event_ts_raw = str(fields.get("event_ts", "")).strip()
    last_price = _to_float(fields.get("last_price"))
    payload = _json_or_none(fields.get("payload"))
    if (last_price is None or last_price <= 0) and isinstance(payload, dict):
        last_price = _to_float(((payload.get("raw_quote") or {}).get("close")))
    if not symbol or not event_ts_raw or last_price is None or last_price <= 0:
        return None
    return {"entry_id": entry_id, "symbol": symbol, "last_price": last_price, "event_ts": _parse_ts(event_ts_raw)}
```

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_index_contribution_runner.py::test_parse_spot_entry_uses_raw_quote_close_when_last_price_zero -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/index_contribution/runner.py apps/backend/tests/test_index_contribution_runner.py
git commit -m "feat: add spot event parser with close-price fallback"
```

### Task 2: Stream Discovery, Group Init, and Consume Loop

**Files:**
- Modify: `apps/backend/app/index_contribution/runner.py`
- Modify: `apps/backend/app/config.py`
- Modify: `apps/backend/app/state.py`
- Test: `apps/backend/tests/test_index_contribution_runner.py`

**Step 1: Write the failing test**

```python
def test_runner_reads_dev_stream_spot_and_acks_processed_entry() -> None:
    redis = _FakeRedisWithStream(key="dev:stream:spot", entries=[...])
    runner = _build_runner_with_stream(redis)

    processed = runner.consume_once()

    assert processed == 1
    assert redis.acked == [("dev:stream:spot", "index-contrib:spot", "1775802833106-0")]
```

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_index_contribution_runner.py::test_runner_reads_dev_stream_spot_and_acks_processed_entry -v`
Expected: FAIL with missing consume loop.

**Step 3: Write minimal implementation**

```python
def _spot_stream_key(self) -> str:
    return self._spot_stream_key_config


def consume_once(self) -> int:
    processed = 0
    for entry_id, fields in self._claim_pending(self._spot_stream_key()):
        if self._handle_spot_entry(entry_id, fields):
            self._redis.xack(self._spot_stream_key(), self._group, entry_id)
            processed += 1
    for entry_id, fields in self._read_new(self._spot_stream_key()):
        if self._handle_spot_entry(entry_id, fields):
            self._redis.xack(self._spot_stream_key(), self._group, entry_id)
            processed += 1
    return processed
```

Also add config:
```python
INDEX_CONTRIBUTION_STREAM_KEY = os.getenv("INDEX_CONTRIBUTION_STREAM_KEY", "dev:stream:spot")
```

Pass it from `state.build_index_contribution_runner()`.

**Step 4: Run focused tests**

Run: `pytest apps/backend/tests/test_index_contribution_runner.py -v`
Expected: PASS for new consume tests + existing runner tests.

**Step 5: Commit**

```bash
git add apps/backend/app/index_contribution/runner.py apps/backend/app/config.py apps/backend/app/state.py apps/backend/tests/test_index_contribution_runner.py
git commit -m "feat: add index contribution spot stream consume loop"
```

### Task 3: Idempotency, Stale Protection, and Ingest Sequence Guard

**Files:**
- Modify: `apps/backend/app/index_contribution/runner.py`
- Modify: `apps/backend/app/index_contribution/engine.py`
- Test: `apps/backend/tests/test_index_contribution_runner.py`
- Test: `apps/backend/tests/test_index_contribution_engine.py`

**Step 1: Write failing tests**

```python
def test_drop_duplicate_entry_id() -> None: ...

def test_drop_lower_or_equal_ingest_seq_for_same_symbol() -> None: ...

def test_drop_stale_updated_at() -> None: ...
```

**Step 2: Run tests to verify failure**

Run: `pytest apps/backend/tests/test_index_contribution_runner.py apps/backend/tests/test_index_contribution_engine.py -v`
Expected: FAIL on sequence/stale guard behavior.

**Step 3: Implement minimal guards**

```python
if event_id and event_id in self._processed_event_ids:
    return False

if ingest_seq is not None and ingest_seq <= self._last_ingest_seq.get(symbol, -1):
    return False
```

Update sequence map on accepted events only.

**Step 4: Re-run tests**

Run: `pytest apps/backend/tests/test_index_contribution_runner.py apps/backend/tests/test_index_contribution_engine.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/index_contribution/runner.py apps/backend/app/index_contribution/engine.py apps/backend/tests/test_index_contribution_runner.py apps/backend/tests/test_index_contribution_engine.py
git commit -m "feat: enforce idempotency stale and ingest sequence guards"
```

### Task 4: Contribution SSE Data Access Helpers

**Files:**
- Modify: `apps/backend/app/services/serving_store.py`
- Test: `apps/backend/tests/test_serving_store.py` (create if missing)

**Step 1: Write failing tests**

```python
def test_fetch_index_contrib_ranking_latest_from_zsets() -> None: ...

def test_fetch_index_contrib_sector_latest_from_json() -> None: ...
```

**Step 2: Run tests to verify failure**

Run: `pytest apps/backend/tests/test_serving_store.py -v`
Expected: FAIL with missing helper functions.

**Step 3: Implement minimal helpers**

```python
def fetch_index_contrib_ranking_latest(index_code: str, trade_date: date, limit: int = 20) -> dict[str, Any]: ...

def fetch_index_contrib_sector_latest(index_code: str, trade_date: date) -> dict[str, float]: ...
```

Use existing Redis client from `get_serving_redis_client()`.

**Step 4: Re-run tests**

Run: `pytest apps/backend/tests/test_serving_store.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/services/serving_store.py apps/backend/tests/test_serving_store.py
git commit -m "feat: add serving store readers for contribution ranking and sector"
```

### Task 5: Extend `/v1/stream/sse` with Contribution Events

**Files:**
- Modify: `apps/backend/app/routes/serving.py`
- Test: `apps/backend/tests/test_serving_sse.py` (create if missing)

**Step 1: Write failing SSE tests**

```python
async def test_stream_sse_emits_index_contrib_ranking_on_change() -> None: ...

async def test_stream_sse_emits_index_contrib_sector_on_change() -> None: ...
```

**Step 2: Run tests to verify failure**

Run: `pytest apps/backend/tests/test_serving_sse.py -v`
Expected: FAIL with missing event emission.

**Step 3: Implement minimal SSE extension**

```python
if ranking_payload and ranking_payload != last_ranking:
    last_ranking = ranking_payload
    yield _sse_message("index_contrib_ranking", ranking_payload)

if sector_payload and sector_payload != last_sector:
    last_sector = sector_payload
    yield _sse_message("index_contrib_sector", sector_payload)
```

Keep existing `kbar_current`, `metric_latest`, `heartbeat` behavior unchanged.

**Step 4: Re-run tests**

Run: `pytest apps/backend/tests/test_serving_sse.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/routes/serving.py apps/backend/tests/test_serving_sse.py
git commit -m "feat: emit contribution ranking and sector events on serving sse"
```

### Task 6: Frontend Event Schema and Manager Handling

**Files:**
- Modify: `apps/frontend/src/features/realtime/schemas/serving-event.schema.ts`
- Modify: `apps/frontend/src/features/realtime/types/realtime.types.ts`
- Modify: `apps/frontend/src/features/realtime/store/realtime.store.ts`
- Modify: `apps/frontend/src/features/realtime/services/realtime-manager.ts`
- Test: `apps/frontend/src/features/realtime/services/realtime-manager.test.ts`

**Step 1: Write failing frontend tests**

```ts
it("writes index contribution ranking and sector events into store", () => {
  applyServingSseEvent("index_contrib_ranking", { ... });
  applyServingSseEvent("index_contrib_sector", { ... });
  expect(useRealtimeStore.getState().indexContribRanking).toBeDefined();
  expect(useRealtimeStore.getState().indexContribSector).toBeDefined();
});
```

**Step 2: Run tests to verify failure**

Run: `npm run test -- apps/frontend/src/features/realtime/services/realtime-manager.test.ts`
Expected: FAIL with unknown event/schema/store fields.

**Step 3: Implement minimal frontend support**

Add zod schemas and event union:
```ts
export type ServingSseEventName =
  | "kbar_current"
  | "metric_latest"
  | "heartbeat"
  | "index_contrib_ranking"
  | "index_contrib_sector";
```

Handle in manager and store upsert methods.

**Step 4: Re-run tests**

Run: `npm run test -- apps/frontend/src/features/realtime/services/realtime-manager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/frontend/src/features/realtime/schemas/serving-event.schema.ts apps/frontend/src/features/realtime/types/realtime.types.ts apps/frontend/src/features/realtime/store/realtime.store.ts apps/frontend/src/features/realtime/services/realtime-manager.ts apps/frontend/src/features/realtime/services/realtime-manager.test.ts
git commit -m "feat: support contribution sse events in frontend realtime manager"
```

### Task 7: End-to-End Verification and Documentation Sync

**Files:**
- Modify: `index-contribution-worker-summary.md`
- Modify: `apps/backend/README.md`
- Optional: `docs/plans/2026-04-11-index-contribution-spot-stream-and-sse-design.md` (final notes)

**Step 1: Add failing contract assertions (if missing)**

```python
def test_compose_defines_index_contribution_worker_service() -> None: ...
```

(Reuse existing contract tests where possible; add only gaps.)

**Step 2: Run full verification set**

Run:
- `pytest apps/backend/tests/test_index_contribution_runner.py apps/backend/tests/test_serving_sse.py apps/backend/tests/test_compose_index_contribution_worker_contract.py -v`
- `npm run test -- apps/frontend/src/features/realtime/services/realtime-manager.test.ts`

Expected: PASS

**Step 3: Update docs with final endpoint/event contract**

Document:
- input stream key config
- price fallback rule
- new SSE event names and payload fields

**Step 4: Commit docs and test updates**

```bash
git add index-contribution-worker-summary.md apps/backend/README.md docs/plans/2026-04-11-index-contribution-spot-stream-and-sse-design.md
git commit -m "docs: document spot stream consumption and contribution sse contract"
```

---

## Command Checklist

- Backend focused tests:
  - `pytest apps/backend/tests/test_index_contribution_runner.py -v`
  - `pytest apps/backend/tests/test_index_contribution_engine.py -v`
  - `pytest apps/backend/tests/test_serving_sse.py -v`
- Frontend focused tests:
  - `npm run test -- apps/frontend/src/features/realtime/services/realtime-manager.test.ts`
- Optional integration smoke:
  - start workers + API, then verify `/v1/stream/sse` emits both new events with real Redis state.
