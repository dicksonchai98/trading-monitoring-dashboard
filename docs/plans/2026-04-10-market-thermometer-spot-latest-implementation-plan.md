# Market Thermometer Spot Latest Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Market Thermometer mock stock panels with realtime spot latest cards and carry `price_chg`/`pct_chg` from Shioaji tick through backend SSE into frontend display.

**Architecture:** Extend spot data contract at ingestion and latest-state persistence, expose added fields in serving `spot_latest_list`, then update frontend schema/store consumer and Market Thermometer rendering to loop over real spot items with numeric `last_price`. UI color uses `is_new_high`/`is_new_low` flags.

**Tech Stack:** Python (FastAPI workers + serving), Redis Streams/state keys, React + TypeScript, Zustand, Zod, pytest, vitest.

---

### Task 1: Add `price_chg` / `pct_chg` extraction in spot ingestion

**Files:**
- Modify: `apps/backend/app/market_ingestion/runner.py`
- Test: `apps/backend/tests/test_market_ingestion_spot_runner.py`

**Step 1: Write the failing test**

Add a test case where spot tick raw payload includes `price_chg` and `pct_chg` and assert they are present in queued spot event payload.

**Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. pytest tests/test_market_ingestion_spot_runner.py -q`
Expected: FAIL on missing `price_chg` / `pct_chg` assertions.

**Step 3: Write minimal implementation**

In spot payload extraction path, parse and attach numeric `price_chg` and `pct_chg` (with alias fallback if needed).

**Step 4: Run test to verify it passes**

Run same command.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/market_ingestion/runner.py apps/backend/tests/test_market_ingestion_spot_runner.py
git commit -m "feat: include price_chg and pct_chg in spot ingestion payload"
```

### Task 2: Persist new fields in latest spot state

**Files:**
- Modify: `apps/backend/app/latest_state/runner.py`
- Test: `apps/backend/tests/test_latest_state_runner.py`

**Step 1: Write the failing test**

Add/extend latest-state test to assert flushed symbol state contains `price_chg` and `pct_chg` when present in stream entry payload.

**Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. pytest tests/test_latest_state_runner.py -q`
Expected: FAIL on missing keys.

**Step 3: Write minimal implementation**

When processing spot entries, copy parsed `price_chg` / `pct_chg` into `current` state map and persist on flush.

**Step 4: Run test to verify it passes**

Run same command.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/latest_state/runner.py apps/backend/tests/test_latest_state_runner.py
git commit -m "feat: persist spot change fields in latest state"
```

### Task 3: Expose new fields in serving spot list response

**Files:**
- Modify: `apps/backend/app/services/serving_store.py`
- Test: `apps/backend/tests/test_serving_store_spot_latest.py`

**Step 1: Write the failing test**

Update list/normalize tests to expect `price_chg`, `pct_chg`, `is_new_high`, `is_new_low` in `fetch_spot_latest_list()` items.

**Step 2: Run test to verify it fails**

Run: `PYTHONPATH=. pytest tests/test_serving_store_spot_latest.py -q`
Expected: FAIL for missing fields.

**Step 3: Write minimal implementation**

Include these fields in both populated item mapping and null fallback mapping.

**Step 4: Run test to verify it passes**

Run same command.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/backend/app/services/serving_store.py apps/backend/tests/test_serving_store_spot_latest.py
git commit -m "feat: add change and high-low flags to spot latest list payload"
```

### Task 4: Extend frontend realtime schema/types for spot list fields

**Files:**
- Modify: `apps/frontend/src/features/realtime/schemas/serving-event.schema.ts`
- Modify: `apps/frontend/src/features/realtime/types/realtime.types.ts`
- Test: `apps/frontend/src/features/realtime/services/realtime-manager.test.ts`

**Step 1: Write the failing test**

Add/update realtime manager test asserting `spot_latest_list` payload with `price_chg`, `pct_chg`, `is_new_high`, `is_new_low` is stored in realtime state.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/realtime/services/realtime-manager.test.ts`
Expected: FAIL schema parse or missing field assertion.

**Step 3: Write minimal implementation**

Add optional nullable fields to `SpotLatestListSchema` item object. Types infer automatically.

**Step 4: Run test to verify it passes**

Run same command.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/realtime/schemas/serving-event.schema.ts apps/frontend/src/features/realtime/types/realtime.types.ts apps/frontend/src/features/realtime/services/realtime-manager.test.ts
git commit -m "feat: extend frontend spot latest schema with change and flags"
```

### Task 5: Replace Market Thermometer mock UI with realtime spot list cards

**Files:**
- Modify: `apps/frontend/src/features/dashboard/pages/MarketThermometerPage.tsx`
- Test: `apps/frontend/src/features/dashboard/pages/MarketThermometerPage.test.tsx`

**Step 1: Write the failing test**

Create/update tests for:
- renders only entries with numeric `last_price`
- shows symbol + last price + `price_chg` + `pct_chg`
- applies red tone for `is_new_high`, green tone for `is_new_low`
- no sparkline elements remain.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/dashboard/pages/MarketThermometerPage.test.tsx`
Expected: FAIL due current mock implementation.

**Step 3: Write minimal implementation**

- Remove mock panel builders/sparkline drawing.
- Use `useSpotLatestList()` and filter by finite `last_price`.
- Render loop cards with required fields.
- Apply color class/style by high/low flags.

**Step 4: Run test to verify it passes**

Run same command.
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/pages/MarketThermometerPage.tsx apps/frontend/src/features/dashboard/pages/MarketThermometerPage.test.tsx
git commit -m "feat: wire market thermometer to realtime spot latest cards"
```

### Task 6: End-to-end verification (backend + frontend focused)

**Files:**
- No additional code expected

**Step 1: Run backend focused suite**

Run:
- `PYTHONPATH=. pytest tests/test_market_ingestion_spot_runner.py -q`
- `PYTHONPATH=. pytest tests/test_latest_state_runner.py -q`
- `PYTHONPATH=. pytest tests/test_serving_store_spot_latest.py -q`

Expected: PASS.

**Step 2: Run frontend focused suite**

Run:
- `npm run test -- src/features/realtime/services/realtime-manager.test.ts`
- `npm run test -- src/features/dashboard/pages/MarketThermometerPage.test.tsx`

Expected: PASS.

**Step 3: Run smoke regression around dashboard card hooks**

Run:
- `npm run test -- src/features/dashboard/components/DashboardMetricPanels.main-force.test.tsx`

Expected: PASS.

**Step 4: Commit verification note**

```bash
git add -A
git commit -m "chore: verify market thermometer realtime spot integration"
```
