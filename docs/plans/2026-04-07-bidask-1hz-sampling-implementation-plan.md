# BidAsk 1Hz Sampling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert bidask processing from per-event persistence to 1Hz sampling (last event per second + carry-forward), while keeping existing API contracts and Redis key names.

**Architecture:** Keep stream ingestion event-driven, but change bidask worker output to second-driven emission. Each second emits one canonical sample per code to `metrics:latest`, `metrics:zset`, and `bidask_metrics_1s` persistence path. Use backpressure-safe consumption when queue is full.

**Tech Stack:** Python 3.12, FastAPI backend worker runtime, Redis Streams + Redis state keys, SQLAlchemy ORM, Alembic migrations, Pytest.

---

### Task 1: Lock 1Hz Behavior With Failing Unit Tests

**Files:**
- Modify: `apps/backend/tests/test_stream_processing_metrics.py`
- Modify: `apps/backend/tests/test_stream_processing_integration.py`

**Step 1: Write failing tests for second-level semantics**

Add tests covering:
- same second multiple bidask events -> only final sample is emitted
- no new event in a second -> carry-forward sample emitted
- `metrics:latest` updates only on second emission

**Step 2: Run tests to verify they fail**

Run:
```bash
cd apps/backend
pytest tests/test_stream_processing_metrics.py -v
pytest tests/test_stream_processing_integration.py -v
```

Expected: FAIL on new 1Hz assertions.

**Step 3: Commit tests-only checkpoint**

```bash
git add apps/backend/tests/test_stream_processing_metrics.py apps/backend/tests/test_stream_processing_integration.py
git commit -m "test: add failing bidask 1hz sampling expectations"
```

### Task 2: Refactor BidAsk In-Memory State To Second-Emission Model

**Files:**
- Modify: `apps/backend/app/stream_processing/runner.py`
- Test: `apps/backend/tests/test_stream_processing_metrics.py`

**Step 1: Implement minimal state changes**

In `BidAskStateMachine`:
- store current-second candidate sample
- store last emitted sample/second
- expose method to emit one sample for a target second:
  - use last event in second if present
  - else carry-forward previous emitted sample

Do not change Redis key names or field names.

**Step 2: Keep day high/low/strength logic on emitted sample**

Ensure:
- day reset still follows `trade_date_for`
- `main_force_big_order_strength` keeps clamp and `day_high == day_low => 0.5`

**Step 3: Run focused unit tests**

Run:
```bash
cd apps/backend
pytest tests/test_stream_processing_metrics.py::test_bidask_sampling_computes_per_second_volume_deltas -v
```

Expected: PASS for refactored semantics.

**Step 4: Commit**

```bash
git add apps/backend/app/stream_processing/runner.py apps/backend/tests/test_stream_processing_metrics.py
git commit -m "feat: convert bidask state machine to 1hz emit semantics"
```

### Task 3: Change Worker Loop To Emit Redis/DB Once Per Second

**Files:**
- Modify: `apps/backend/app/stream_processing/runner.py`
- Test: `apps/backend/tests/test_stream_processing_integration.py`

**Step 1: Split consume vs emit in bidask loop**

Update loop behavior:
- consume events continuously (state update only)
- run second-boundary emission routine per code
- on emission, write `metrics:latest`, `metrics:zset`, enqueue DB payload once/sec

**Step 2: Preserve backpressure safety**

If DB queue full:
- stop consuming more entries in current iteration
- avoid exception storm logs
- keep retry path intact

**Step 3: Run integration tests**

Run:
```bash
cd apps/backend
pytest tests/test_stream_processing_integration.py -v
```

Expected: PASS with one sample per second behavior.

**Step 4: Commit**

```bash
git add apps/backend/app/stream_processing/runner.py apps/backend/tests/test_stream_processing_integration.py
git commit -m "feat: emit bidask redis and db payloads at 1hz"
```

### Task 4: Align DB Schema To True 1-Second Identity

**Files:**
- Create: `apps/backend/alembic/versions/<new_revision>_bidask_event_second_identity.py`
- Modify: `apps/backend/app/models/bidask_metric_1s.py`
- Test: `apps/backend/tests/test_models_schema.py`

**Step 1: Add migration**

Migration should:
- add `event_second` (timezone-aware datetime, nullable initially)
- backfill `event_second = date_trunc('second', event_ts)` (PostgreSQL path)
- add unique constraint/index on `(code, event_second)`

Keep existing data safe and additive-first.

**Step 2: Update ORM model**

Add `event_second` column mapping and table args consistent with migration.

**Step 3: Run schema tests**

Run:
```bash
cd apps/backend
pytest tests/test_models_schema.py -v
```

Expected: PASS for new schema contract.

**Step 4: Commit**

```bash
git add apps/backend/alembic/versions/*.py apps/backend/app/models/bidask_metric_1s.py apps/backend/tests/test_models_schema.py
git commit -m "feat: add bidask event_second identity for 1hz persistence"
```

### Task 5: Implement DB Upsert On (code, event_second)

**Files:**
- Modify: `apps/backend/app/stream_processing/runner.py`
- Test: `apps/backend/tests/test_stream_processing_integration.py`

**Step 1: Write failing integration test**

Add test:
- multiple events in same second
- persistence flush creates/updates only one DB row for that second

**Step 2: Implement minimal upsert logic**

In bidask persistence path:
- compute `event_second = event_ts.replace(microsecond=0)`
- upsert by `(code, event_second)` so final sample wins

**Step 3: Run focused tests**

Run:
```bash
cd apps/backend
pytest tests/test_stream_processing_integration.py::test_stream_processing_persists_bidask_to_postgres -v
```

Expected: PASS with one-row-per-second behavior.

**Step 4: Commit**

```bash
git add apps/backend/app/stream_processing/runner.py apps/backend/tests/test_stream_processing_integration.py
git commit -m "feat: upsert bidask samples by code and event_second"
```

### Task 6: Verify Serving Contract + Runtime Stability

**Files:**
- Modify (if needed): `apps/backend/tests/test_serving_market_summary_api.py`
- Create or modify: `apps/backend/tests/test_serving_bidask_api.py` (if absent)
- Optional docs: `docs/plans/2026-04-07-bidask-1hz-sampling-design.md` (minor clarifications only)

**Step 1: Add/adjust serving tests**

Validate:
- `/v1/metric/bidask/latest` still returns unchanged shape
- `/v1/metric/bidask/today` returns second-continuous samples

**Step 2: Run full focused regression**

Run:
```bash
cd apps/backend
pytest tests/test_stream_processing_metrics.py tests/test_stream_processing_integration.py tests/test_models_schema.py -v
pytest tests/test_serving_* -v
```

Expected: PASS.

**Step 3: Run pre-commit hooks**

Run:
```bash
pre-commit run ruff --all-files
pre-commit run ruff-format --all-files
```

Expected: PASS or auto-fix then re-run PASS.

**Step 4: Commit final integration checkpoint**

```bash
git add apps/backend docs/plans
git commit -m "feat: finalize bidask 1hz sampling pipeline and contracts"
```

