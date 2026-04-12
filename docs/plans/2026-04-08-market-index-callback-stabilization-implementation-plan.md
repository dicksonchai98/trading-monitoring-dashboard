# Market Index Callback Stabilization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make index market quotes reliably enter ingestion callbacks and always write to `{env}:stream:market:TSE001`.

**Architecture:** Keep current ingestion runtime and queue->writer pipeline unchanged, but split spot/index callback paths explicitly. Market subscription uses stock quote v1 callback path, and market code is canonicalized to `TSE001` before enqueue.

**Tech Stack:** Python 3.10, FastAPI backend module layout, Shioaji SDK (`>=1.2.0`), pytest.

---

### Task 1: Lock Subscription Contract to Market Quote v1

**Files:**
- Modify: `apps/backend/tests/test_market_ingestion_shioaji_subscription.py`
- Modify: `apps/backend/app/market_ingestion/shioaji_subscription.py`
- Test: `apps/backend/tests/test_market_ingestion_shioaji_subscription.py`

**Step 1: Write the failing test**

```python
def test_subscribe_market_topic_subscribes_quote_v1() -> None:
    idx_contract = object()
    api = FakeAPI(FakeFutures({}), indices={"TSE001": idx_contract})
    subscribe_market_topic(api, idx_contract)
    assert any(
        kind == "quote" and target is idx_contract and version is not None
        for kind, target, version in api.quote.subscriptions
    )
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_market_ingestion_shioaji_subscription.py::test_subscribe_market_topic_subscribes_quote_v1 -q`  
Expected: FAIL because current code subscribes `tick`.

**Step 3: Write minimal implementation**

```python
def _quote_type(value: str) -> Any:
    import shioaji as sj
    if value == "tick":
        return sj.constant.QuoteType.Tick
    if value == "quote":
        return sj.constant.QuoteType.Quote
    return sj.constant.QuoteType.BidAsk

def subscribe_market_topic(api: Any, contract: Any) -> None:
    api.quote.subscribe(contract, quote_type=_quote_type("quote"), version=_quote_version_v1())
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_market_ingestion_shioaji_subscription.py -q`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/shioaji_subscription.py apps/backend/tests/test_market_ingestion_shioaji_subscription.py
git commit -m "fix: subscribe market index via quote v1"
```

### Task 2: Register Market Callback on Quote STK v1 Path

**Files:**
- Modify: `apps/backend/tests/test_market_ingestion_shioaji_client.py`
- Modify: `apps/backend/app/market_ingestion/shioaji_client.py`
- Test: `apps/backend/tests/test_market_ingestion_shioaji_client.py`

**Step 1: Write the failing test**

```python
def test_set_on_market_callback_registers_quote_stk_handler() -> None:
    class FakeQuoteWithMarket(FakeQuote):
        def __init__(self) -> None:
            super().__init__()
            self.on_quote_stk_callback = None
        def set_on_quote_stk_v1_callback(self, callback) -> None:
            self.on_quote_stk_callback = callback

    class FakeApiWithMarket(FakeAPI):
        def __init__(self) -> None:
            super().__init__()
            self.quote = FakeQuoteWithMarket()

    api = FakeApiWithMarket()
    client = ShioajiClient(api=api, api_key="k", secret_key=_fake_secret(), simulation=True)

    def _callback(*_args):
        return None

    assert client.set_on_market_callback(_callback) is True
    assert api.quote.on_quote_stk_callback is _callback
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_market_ingestion_shioaji_client.py::test_set_on_market_callback_registers_quote_stk_handler -q`  
Expected: FAIL if callback selection does not explicitly prioritize quote stk path.

**Step 3: Write minimal implementation**

```python
def set_on_market_callback(self, callback: Callable[..., Any]) -> bool:
    handler = getattr(self._api.quote, "set_on_quote_stk_v1_callback", None)
    if callable(handler):
        handler(callback)
        return True
    return False
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_market_ingestion_shioaji_client.py -q`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/shioaji_client.py apps/backend/tests/test_market_ingestion_shioaji_client.py
git commit -m "fix: bind market ingestion callback to quote stk v1"
```

### Task 3: Canonicalize Market Code to TSE001 Before Enqueue

**Files:**
- Modify: `apps/backend/tests/test_market_ingestion_runner.py`
- Modify: `apps/backend/app/market_ingestion/runner.py`
- Test: `apps/backend/tests/test_market_ingestion_runner.py`

**Step 1: Write the failing test**

```python
def test_market_quote_code_001_is_canonicalized_to_tse001_stream() -> None:
    runner = MarketIngestionRunner(
        shioaji_client=ShioajiClient(api=_FakeAPI(), api_key="k", secret_key="s", simulation=True),
        redis_client=_FakeRedis(),
        metrics=Metrics(),
        queue_maxsize=8,
        stream_maxlen=100,
        retry_attempts=2,
        retry_backoff_ms=10,
    )
    runner._market_enabled = True
    runner._market_code = "TSE001"
    runner._on_market_quote({"Code": "001", "Date": "2026/04/08", "Time": "10:00:00.000000", "Close": 10.0})
    queued = runner._futures_pipeline.queue.get_nowait()
    assert queued.stream_key == "dev:stream:market:TSE001"
    assert queued.event.code == "TSE001"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_market_ingestion_runner.py::test_market_quote_code_001_is_canonicalized_to_tse001_stream -q`  
Expected: FAIL because current path can emit `...:market:001`.

**Step 3: Write minimal implementation**

```python
def _canonical_market_code(self, code_value: Any) -> str:
    text = str(code_value or "").strip().upper()
    if text == "001":
        return "TSE001"
    if text == "TSE001":
        return "TSE001"
    return self._market_code

def _on_market_quote(self, quote: Any) -> None:
    ...
    raw_code = raw_payload.get("code", raw_payload.get("Code", code_value))
    code = self._canonical_market_code(raw_code)
    ...
```

**Step 4: Run test to verify it passes**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_market_ingestion_runner.py -q`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/runner.py apps/backend/tests/test_market_ingestion_runner.py
git commit -m "fix: canonicalize market stream code to TSE001"
```

### Task 4: Regression Validation for Spot/Futures Paths

**Files:**
- Test: `apps/backend/tests/test_market_ingestion_spot_runner.py`
- Test: `apps/backend/tests/test_market_ingestion_integration.py`
- Test: `apps/backend/tests/test_market_summary_integration.py`

**Step 1: Keep or add explicit regression assertions**

```python
assert any(stream == "dev:stream:tick:MTX" for stream, _ in redis.writes)
assert any(key.endswith(":stream:market:TSE001") for key in redis.streams)
```

**Step 2: Run targeted regression tests**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_market_ingestion_spot_runner.py tests/test_market_ingestion_integration.py tests/test_market_summary_integration.py -q`  
Expected: PASS.

**Step 3: Fix only minimal regressions if present**

```python
# Keep spot callback independent from market callback registration
self._client.set_on_tick_stk_v1_callback(on_spot_tick)
if self._market_enabled:
    self._client.set_on_market_callback(on_market_tick)
```

**Step 4: Re-run the regression tests**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_market_ingestion_spot_runner.py tests/test_market_ingestion_integration.py tests/test_market_summary_integration.py -q`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/tests/test_market_ingestion_spot_runner.py apps/backend/tests/test_market_ingestion_integration.py apps/backend/tests/test_market_summary_integration.py apps/backend/app/market_ingestion/runner.py
git commit -m "test: protect spot and futures ingestion regressions"
```

### Task 5: Update Ops Documentation to Match New Market Path

**Files:**
- Modify: `apps/backend/docs/market-ingestor-ops.md`
- Test: `apps/backend/tests/test_market_ingestion_shioaji_subscription.py` (reference validation)

**Step 1: Add documentation delta**

```md
- Market index callback:
  - `api.quote.set_on_quote_stk_v1_callback(...)` for index/market ingestion
- Market subscription:
  - `api.quote.subscribe(index_contract, quote_type=QuoteType.Quote, version=QuoteVersion.v1)`
- Canonical market stream:
  - `{env}:stream:market:TSE001`
```

**Step 2: Run a quick consistency test**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_market_ingestion_shioaji_subscription.py -q`  
Expected: PASS.

**Step 3: Commit**

```bash
git add apps/backend/docs/market-ingestor-ops.md
git commit -m "docs: align ingestor runbook with market quote callback path"
```

### Task 6: Final Verification Gate

**Files:**
- Verify only (no file edits expected)

**Step 1: Run final focused suite**

Run: `cd apps/backend && $env:PYTHONPATH='.'; pytest tests/test_market_ingestion_shioaji_client.py tests/test_market_ingestion_shioaji_subscription.py tests/test_market_ingestion_runner.py tests/test_market_ingestion_spot_runner.py tests/test_market_summary_integration.py -q`  
Expected: PASS.

**Step 2: Run style checks on touched files (if configured)**

Run: `cd apps/backend && pre-commit run --files app/market_ingestion/shioaji_client.py app/market_ingestion/shioaji_subscription.py app/market_ingestion/runner.py tests/test_market_ingestion_shioaji_client.py tests/test_market_ingestion_shioaji_subscription.py tests/test_market_ingestion_runner.py`  
Expected: PASS or only auto-fixable changes.

**Step 3: Produce rollout checklist for deployment note**

```text
INGESTOR_MARKET_ENABLED=true
INGESTOR_MARKET_CODE=TSE001
Confirm stream writes at {env}:stream:market:TSE001
Confirm market summary worker consumption
```

**Step 4: Commit any final fixes (if any)**

```bash
git add -A
git commit -m "chore: finalize market index callback stabilization"
```

