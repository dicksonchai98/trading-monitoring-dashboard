# Quote Serving and Worker Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement quote feature serving (REST + SSE extension) and align quote worker reliability semantics with existing stream-processing contracts.

**Architecture:** Extend current backend incrementally: add quote state readers and endpoints in serving layer, extend `/v1/stream/sse` with `quote_latest`, and tighten worker-side ACK/recovery contracts in the new quote worker runtime. Keep existing `kbar` and `bidask` contracts untouched.

**Tech Stack:** FastAPI, Redis, SQLAlchemy/PostgreSQL, pytest, existing stream-processing patterns.

---

### Task 1: Add Quote Feature DB Model

**Files:**
- Create: `apps/backend/app/models/quote_feature_1m.py`
- Modify: `apps/backend/app/models/__init__.py`
- Test: `apps/backend/tests/test_models_schema.py`

**Step 1: Write the failing test**

Add assertions that:
- model table name is `quote_features_1m`
- unique key is `(code, minute_ts)`
- index exists for `(code, trade_date)`

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_models_schema.py -v`
Expected: FAIL because `QuoteFeature1mModel` does not exist.

**Step 3: Write minimal implementation**

Create SQLAlchemy model with fields:
- `code`, `trade_date`, `minute_ts`
- `main_chip`, `main_chip_day_high`, `main_chip_day_low`, `main_chip_strength`
- `long_short_force`, `long_short_force_day_high`, `long_short_force_day_low`, `long_short_force_strength`
- `payload` (JSON text backup)

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_models_schema.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/models/quote_feature_1m.py apps/backend/app/models/__init__.py apps/backend/tests/test_models_schema.py
git commit -m "feat: add quote feature 1m model schema"
```

### Task 2: Add Migration for `quote_features_1m`

**Files:**
- Create: `apps/backend/alembic/versions/<timestamp>_add_quote_features_1m.py`
- Test: `apps/backend/tests/test_migration_metadata.py`

**Step 1: Write the failing test**

Add migration metadata test expecting a migration file for `quote_features_1m`.

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_migration_metadata.py -v`
Expected: FAIL because migration file is missing.

**Step 3: Write minimal implementation**

Add Alembic migration creating table + unique constraint + `(code, trade_date)` index.

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_migration_metadata.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/alembic/versions/<timestamp>_add_quote_features_1m.py apps/backend/tests/test_migration_metadata.py
git commit -m "feat: add migration for quote_features_1m"
```

### Task 3: Add Serving Store Read Functions for Quote

**Files:**
- Modify: `apps/backend/app/services/serving_store.py`
- Test: `apps/backend/tests/test_serving_store.py` (create if missing)

**Step 1: Write the failing test**

Add tests for:
- `fetch_quote_latest(code)`
- `fetch_quote_today_range(code, time_range)`
- `fetch_quote_history(session, code, time_range)`
- `fetch_quote_aggregates(session, code, time_range)`

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_serving_store.py -v`
Expected: FAIL because quote read functions do not exist.

**Step 3: Write minimal implementation**

Implement functions using:
- Redis keys: `quote_features:latest`, `quote_features:zset`
- DB table: `quote_features_1m`
- Output normalization consistent with current serving style (`ts` in epoch ms where applicable).

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_serving_store.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/services/serving_store.py apps/backend/tests/test_serving_store.py
git commit -m "feat: add quote serving store reads"
```

### Task 4: Add Quote REST Endpoints

**Files:**
- Modify: `apps/backend/app/routes/serving.py`
- Test: `apps/backend/tests/test_serving_routes.py` (create or extend)

**Step 1: Write the failing test**

Add route tests:
- `GET /v1/quote/latest`
- `GET /v1/quote/today`
- `GET /v1/quote/history`
- `GET /v1/quote/aggregates`
- plus error mapping tests (`503 redis_unavailable`, `503 db_unavailable`, `400 missing_range`).

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_serving_routes.py -v`
Expected: FAIL because quote routes are missing.

**Step 3: Write minimal implementation**

Add routes with existing dependencies:
- `require_authenticated`
- `enforce_serving_rate_limit`
- `record_serving_latency`

Reuse existing response style and exception mapping.

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_serving_routes.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/routes/serving.py apps/backend/tests/test_serving_routes.py
git commit -m "feat: add quote serving REST endpoints"
```

### Task 5: Extend Existing SSE with `quote_latest`

**Files:**
- Modify: `apps/backend/app/routes/serving.py`
- Test: `apps/backend/tests/test_serving_sse.py` (create or extend)

**Step 1: Write the failing test**

Add SSE tests asserting:
- existing events unchanged (`kbar_current`, `metric_latest`, `heartbeat`)
- new event `quote_latest` appears when quote latest changes
- no duplicate `quote_latest` without state change

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_serving_sse.py -v`
Expected: FAIL because SSE quote emission is missing.

**Step 3: Write minimal implementation**

In `/v1/stream/sse` loop:
- read quote latest per polling cycle,
- compare with `last_quote`,
- emit `quote_latest` when changed.

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_serving_sse.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/routes/serving.py apps/backend/tests/test_serving_sse.py
git commit -m "feat: add quote_latest event to serving SSE"
```

### Task 6: Implement Quote Worker Runtime Skeleton with ACK Contract

**Files:**
- Create: `apps/backend/app/quote_processing/runner.py`
- Create: `apps/backend/workers/quote_worker.py`
- Modify: `apps/backend/app/state.py`
- Modify: `apps/backend/app/config.py`
- Test: `apps/backend/tests/test_quote_worker_runtime.py`
- Test: `apps/backend/tests/test_quote_worker_entrypoint.py`

**Step 1: Write the failing test**

Add tests for:
- consumer group startup behavior,
- reclaim (`XAUTOCLAIM`) + read (`XREADGROUP`) processing,
- ACK only after successful state write and sink handoff.

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_quote_worker_runtime.py apps/backend/tests/test_quote_worker_entrypoint.py -v`
Expected: FAIL because quote worker runtime does not exist.

**Step 3: Write minimal implementation**

Build runner with:
- stream pattern `{env}:stream:quote:*`,
- group `agg:quote` (configurable),
- 1-second aggregation bucket,
- Redis writes to quote latest/zset,
- minute snapshot handoff queue.

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_quote_worker_runtime.py apps/backend/tests/test_quote_worker_entrypoint.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/quote_processing/runner.py apps/backend/workers/quote_worker.py apps/backend/app/state.py apps/backend/app/config.py apps/backend/tests/test_quote_worker_runtime.py apps/backend/tests/test_quote_worker_entrypoint.py
git commit -m "feat: add quote worker runtime and ack contract"
```

### Task 7: Add Quote DB Sink Flush and Retry/Dead-Letter

**Files:**
- Modify: `apps/backend/app/quote_processing/runner.py`
- Test: `apps/backend/tests/test_quote_worker_db_sink.py`

**Step 1: Write the failing test**

Add tests for:
- minute snapshot batch persistence success,
- retry and backoff behavior,
- dead-letter publish after max retries.

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_quote_worker_db_sink.py -v`
Expected: FAIL because sink behavior is not implemented.

**Step 3: Write minimal implementation**

Add queue batch flush logic and DB persistence to `quote_features_1m` with duplicate tolerance; dead-letter stream on terminal failure.

**Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_quote_worker_db_sink.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/quote_processing/runner.py apps/backend/tests/test_quote_worker_db_sink.py
git commit -m "feat: add quote db sink retry and dead-letter handling"
```

### Task 8: End-to-End and Contract Regression

**Files:**
- Modify: `apps/backend/tests/test_stream_processing_integration.py`
- Create: `apps/backend/tests/test_quote_serving_integration.py`
- Modify: `apps/backend/README.md`
- Modify: `apps/backend/docs/market-ingestor-ops.md`

**Step 1: Write the failing test**

Add integration coverage:
- quote stream input -> quote Redis state -> quote REST/SSE output,
- existing kbar/bidask routes/SSE events remain unchanged.

**Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_quote_serving_integration.py apps/backend/tests/test_stream_processing_integration.py -v`
Expected: FAIL before integration wiring is complete.

**Step 3: Write minimal implementation/doc updates**

Update wiring and docs:
- run commands for quote worker,
- config keys and stream names,
- serving endpoint list and event contract.

**Step 4: Run full targeted verification**

Run:
- `pytest apps/backend/tests/test_serving_store.py apps/backend/tests/test_serving_routes.py apps/backend/tests/test_serving_sse.py -v`
- `pytest apps/backend/tests/test_quote_worker_runtime.py apps/backend/tests/test_quote_worker_db_sink.py -v`
- `pytest apps/backend/tests/test_quote_serving_integration.py -v`

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/tests/test_stream_processing_integration.py apps/backend/tests/test_quote_serving_integration.py apps/backend/README.md apps/backend/docs/market-ingestor-ops.md
git commit -m "test: add quote serving integration coverage and docs"
```

---

## Final Verification Checklist

1. Quote REST endpoints return expected payload and errors.
2. `/v1/stream/sse` emits `quote_latest` and preserves existing events.
3. Quote worker ACK behavior matches contract under induced failure.
4. Quote minute snapshots persist to `quote_features_1m`.
5. Existing `kbar`/`bidask` serving behavior has no regression.
