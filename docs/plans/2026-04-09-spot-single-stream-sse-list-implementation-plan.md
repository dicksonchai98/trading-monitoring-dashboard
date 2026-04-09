# Spot Single-Stream + SSE List Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move spot ingestion to one Redis stream key and expose fixed-length `spot_latest_list` SSE snapshots for frontend consumption.

**Architecture:** Keep spot events per-symbol but append them into one stream (`{env}:stream:spot`). Latest-state worker consumes this stream and continues writing per-symbol latest keys. Serving layer aggregates 156 latest keys into one list and pushes it via SSE immediately and every second.

**Tech Stack:** FastAPI, Redis Streams, Redis string state keys, Python worker loops, pytest.

---

### Task 1: Introduce Single Spot Stream Key

**Files:**
- Modify: `apps/backend/app/market_ingestion/runner.py`
- Test: `apps/backend/tests/test_market_ingestion_spot_runner.py`

**Step 1: Write the failing test**

Add/adjust test assertion to verify spot enqueue stream key equals `dev:stream:spot` (not `dev:stream:spot:2330`).

**Step 2: Run test to verify it fails**

Run: `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_market_ingestion_spot_runner.py::test_spot_stream_contract_and_ingest_seq_monotonic`

Expected: FAIL with old per-symbol stream key assertion mismatch.

**Step 3: Write minimal implementation**

In `_on_spot_quote`, change stream key construction to fixed spot key: `build_stream_key(INGESTOR_ENV, "spot", "")` or explicit equivalent `f"{INGESTOR_ENV}:stream:spot"` with one canonical helper path.

**Step 4: Run test to verify it passes**

Run same test command.

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/runner.py apps/backend/tests/test_market_ingestion_spot_runner.py
git commit -m "feat: write spot ticks into single stream key"
```

### Task 2: Switch Latest-State Worker to Single Spot Stream

**Files:**
- Modify: `apps/backend/app/latest_state/runner.py`
- Test: `apps/backend/tests/test_latest_state_runner.py`

**Step 1: Write the failing test**

Add test asserting worker consumes from `dev:stream:spot` and updates symbol states based on message `symbol`.

**Step 2: Run test to verify it fails**

Run: `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_latest_state_runner.py::test_latest_state_runner_updates_and_flushes_state`

Expected: FAIL before stream discovery/consume logic is updated.

**Step 3: Write minimal implementation**

Replace dynamic `scan_iter("{env}:stream:spot:*")` discovery with fixed stream list containing `{env}:stream:spot` and keep same entry parsing by `symbol`.

**Step 4: Run test to verify it passes**

Run targeted latest-state tests.

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/latest_state/runner.py apps/backend/tests/test_latest_state_runner.py
git commit -m "feat: consume spot latest-state from single stream"
```

### Task 3: Add Serving Spot List Aggregation

**Files:**
- Modify: `apps/backend/app/services/serving_store.py`
- Create/Modify: `apps/backend/tests/test_serving_store_spot_latest.py`

**Step 1: Write the failing test**

Add tests for:
- loading symbol registry order
- aggregating fixed-size list with null placeholders
- timestamp normalization.

**Step 2: Run test to verify it fails**

Run: `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_serving_store_spot_latest.py`

Expected: FAIL due missing aggregation function.

**Step 3: Write minimal implementation**

Add function `fetch_spot_latest_list()` that:
- loads 156 symbols from configured file
- reads `state:spot:{symbol}:latest`
- returns deterministic ordered items list with null defaults.

**Step 4: Run test to verify it passes**

Run same targeted test command.

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/services/serving_store.py apps/backend/tests/test_serving_store_spot_latest.py
git commit -m "feat: add serving spot latest list aggregation"
```

### Task 4: Add SSE `spot_latest_list` Event

**Files:**
- Modify: `apps/backend/app/routes/serving.py`
- Modify: `apps/backend/tests/test_serving_market_summary_api.py`

**Step 1: Write the failing test**

Add SSE test that expects:
- first emitted event includes `event: spot_latest_list`
- payload contains fixed list.

**Step 2: Run test to verify it fails**

Run: `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_serving_market_summary_api.py::test_sse_includes_spot_latest_list_event`

Expected: FAIL with missing event.

**Step 3: Write minimal implementation**

In `stream_sse`:
- fetch spot list snapshot
- emit immediately on connect
- emit every loop tick (1s poll cadence).

**Step 4: Run test to verify it passes**

Run targeted serving test.

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/routes/serving.py apps/backend/tests/test_serving_market_summary_api.py
git commit -m "feat: emit spot latest list over serving sse"
```

### Task 5: Remove Per-Symbol Spot Stream Assumptions from Tests/Docs

**Files:**
- Modify: `apps/backend/tests/test_spot_ingestion_latest_state_flow.py`
- Modify: `docs/plans/2026-04-09-spot-single-stream-sse-list-design.md` (if any drift)

**Step 1: Write/adjust failing test**

Update end-to-end test assertions to validate `dev:stream:spot` usage and downstream state update.

**Step 2: Run test to verify it fails then passes after updates**

Run: `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_spot_ingestion_latest_state_flow.py`

Expected: PASS after update.

**Step 3: Commit**

```bash
git add apps/backend/tests/test_spot_ingestion_latest_state_flow.py docs/plans/2026-04-09-spot-single-stream-sse-list-design.md
git commit -m "test: align spot end-to-end flow with single stream architecture"
```

### Task 6: Full Verification Pass

**Files:**
- No code changes expected

**Step 1: Run focused backend suite**

Run:
- `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_market_ingestion_spot_runner.py`
- `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_latest_state_runner.py`
- `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_serving_store_spot_latest.py`
- `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_serving_market_summary_api.py`

Expected: PASS for all.

**Step 2: Run smoke integration set**

Run: `PYTHONPATH=apps/backend pytest -q apps/backend/tests/test_spot_ingestion_latest_state_flow.py`

Expected: PASS.

**Step 3: Commit verification note**

```bash
git add -A
git commit -m "chore: verify spot single-stream and sse list rollout"
```
