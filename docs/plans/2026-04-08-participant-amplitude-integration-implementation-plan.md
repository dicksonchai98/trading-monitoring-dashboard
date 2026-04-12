# Participant Amplitude Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect Participant Overview to backend daily amplitude data and realtime intraday amplitude, showing closed-day summary metrics and a 19+1 daily K-candle amplitude chart.

**Architecture:** Extend the existing `/v1/kbar/1m/daily-amplitude` endpoint to return daily OHLC + amplitude for closed days, then build a frontend data hook that merges 19 closed-day candles with 1 today realtime candle from SSE. Compute summary metrics from closed days only to keep calculation stable and auditable.

**Tech Stack:** FastAPI, SQLAlchemy, PostgreSQL, React, TypeScript, Recharts, Vitest, Pytest

---

### Task 1: Extend Daily Amplitude Backend Contract

**Files:**
- Modify: `apps/backend/app/services/serving_store.py`
- Modify: `apps/backend/app/routes/serving.py`
- Test: `apps/backend/tests/test_serving_quote_api.py`

**Step 1: Write/extend failing API tests**

```python
def test_kbar_daily_amplitude_returns_daily_rows(...):
    # expects open/high/low/close/day_amplitude in each item
```

**Step 2: Run tests to verify failure**

Run: `set PYTHONPATH=.&& pytest tests/test_serving_quote_api.py -v`  
Expected: FAIL on missing fields in response

**Step 3: Implement minimal backend query + response mapping**

```python
select trade_date, min(open), max(high), min(low), ...
# map to open/high/low/close/day_amplitude
```

**Step 4: Run tests to verify pass**

Run: `set PYTHONPATH=.&& pytest tests/test_serving_quote_api.py -v`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/app/services/serving_store.py apps/backend/app/routes/serving.py apps/backend/tests/test_serving_quote_api.py
git commit -m "feat: extend daily amplitude api with daily ohlc"
```

### Task 2: Add Frontend Daily Amplitude API Types and Client

**Files:**
- Modify: `apps/frontend/src/features/dashboard/api/types.ts`
- Modify: `apps/frontend/src/features/dashboard/api/market-overview.ts`
- Test: `apps/frontend/src/features/dashboard/api/market-overview.test.ts`

**Step 1: Write failing API client test**

```ts
it("requests /v1/kbar/1m/daily-amplitude with code and n", async () => {
  // expect normalized daily ohlc rows
})
```

**Step 2: Run test to verify failure**

Run: `npm run test -- src/features/dashboard/api/market-overview.test.ts`  
Expected: FAIL on missing client function

**Step 3: Implement client function + types**

```ts
export async function getDailyAmplitudeHistory(token: string, code: string, n = 19) {}
```

**Step 4: Run test to verify pass**

Run: `npm run test -- src/features/dashboard/api/market-overview.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/api/types.ts apps/frontend/src/features/dashboard/api/market-overview.ts apps/frontend/src/features/dashboard/api/market-overview.test.ts
git commit -m "feat: add frontend daily amplitude history api client"
```

### Task 3: Build Participant Amplitude Data Hook

**Files:**
- Create: `apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.ts`
- Test: `apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.test.tsx`

**Step 1: Write failing hook tests**

```ts
it("computes summary metrics from closed days only", ...)
it("merges 19 closed candles with one realtime today candle", ...)
```

**Step 2: Run tests to verify failure**

Run: `npm run test -- src/features/dashboard/hooks/use-participant-amplitude.test.tsx`  
Expected: FAIL

**Step 3: Implement hook logic**

```ts
// fetch 19 closed rows
// compute 5/10 avg, yesterday, 5/10 max from closed rows only
// append realtime today candle from SSE when available
```

**Step 4: Run tests to verify pass**

Run: `npm run test -- src/features/dashboard/hooks/use-participant-amplitude.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.ts apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.test.tsx
git commit -m "feat: add participant amplitude hook with 19+1 merge"
```

### Task 4: Integrate Amplitude Summary UI

**Files:**
- Modify: `apps/frontend/src/features/dashboard/components/RealtimeDashboardOverview.tsx`
- Test: `apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`

**Step 1: Write failing component test**

```ts
it("renders 5d/10d avg, yesterday, 5d max, 10d max from hook", ...)
```

**Step 2: Run test to verify failure**

Run: `npm run test -- src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`  
Expected: FAIL on missing dynamic values

**Step 3: Replace static summary numbers with hook data**

```tsx
<span>{summary.avg5.toFixed(1)}</span>
```

**Step 4: Run test to verify pass**

Run: `npm run test -- src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/components/RealtimeDashboardOverview.tsx apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx
git commit -m "feat: wire amplitude summary to daily amplitude metrics"
```

### Task 5: Integrate Participant Signals 19+1 Candle Chart

**Files:**
- Modify: `apps/frontend/src/features/dashboard/components/RealtimeDashboardOverview.tsx`
- Test: `apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`

**Step 1: Write failing chart test**

```ts
it("renders 20 candles when realtime today is available", ...)
it("renders 19 candles when realtime today is missing", ...)
```

**Step 2: Run tests to verify failure**

Run: `npm run test -- src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`  
Expected: FAIL

**Step 3: Implement chart data binding**

```tsx
<ComposedChart data={participantSeries}>
```

**Step 4: Run tests to verify pass**

Run: `npm run test -- src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/components/RealtimeDashboardOverview.tsx apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx
git commit -m "feat: wire participant signals chart to 19+1 daily candles"
```

### Task 6: Full Verification

**Files:**
- Modify (if needed): `apps/frontend/src/features/realtime/schemas/serving-event.schema.ts`
- Modify (if needed): `apps/frontend/src/features/realtime/store/realtime.store.ts`

**Step 1: Run backend serving tests**

Run: `set PYTHONPATH=.&& pytest tests/test_serving_quote_api.py tests/test_serving_market_summary_api.py -v`  
Expected: PASS

**Step 2: Run frontend targeted tests**

Run: `npm run test -- src/features/dashboard/api/market-overview.test.ts src/features/dashboard/hooks/use-participant-amplitude.test.tsx src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`  
Expected: PASS

**Step 3: Run frontend typecheck**

Run: `npm run typecheck`  
Expected: PASS (or no new errors introduced in touched files)

**Step 4: Commit final integration fixes**

```bash
git add apps/frontend/src/features apps/backend/app apps/backend/tests
git commit -m "feat: integrate participant overview with daily amplitude history and realtime today"
```
