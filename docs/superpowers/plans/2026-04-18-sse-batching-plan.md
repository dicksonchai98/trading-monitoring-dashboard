# SSE Batching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix batch overwrite bug, add client time-window batching (100ms), and throttle UI updates to 10Hz to stabilize charts.

**Architecture:** Merge parsed SSE frames into a pendingBatch in realtime-manager, flush the pendingBatch on a 100ms timer to apply to the zustand store using fine-grained upserts. UI components subscribe to throttled selectors (10Hz) and maintain small ring-buffers for chart series.

**Tech Stack:** TypeScript, React, Zustand, Recharts, Vite

---

### Task 1: Add batch map structures and tests

**Files:**
- Modify: `apps/frontend/src/features/realtime/services/realtime-manager.ts` (collectServingSseEvent & create batch types)
- Modify: `apps/frontend/src/features/realtime/services/realtime-manager.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// add tests in realtime-manager.test.ts to assert collectServingSseEvent merges multiple frames of same event type
import { collectServingSseEvent } from './realtime-manager';

test('collectServingSseEvent collects multiple metric_latest into metricLatestMap', () => {
  const batch = {} as any;
  collectServingSseEvent('metric_latest', { code: 'A', ts: 1 }, batch);
  collectServingSseEvent('metric_latest', { code: 'B', ts: 2 }, batch);
  expect(Object.keys(batch.metricLatestMap || {})).toEqual(['A','B']);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test apps/frontend -- -t collectServingSseEvent`
Expected: FAIL

- [ ] **Step 3: Implement changes**

Edit `collectServingSseEvent` to append into maps:

```ts
// inside collectServingSseEvent
if (eventName === 'metric_latest') {
  const parsed = MetricLatestSchema.safeParse(data);
  if (!parsed.success) return;
  batch.metricLatestMap = batch.metricLatestMap || {};
  const code = typeof parsed.data.code === 'string' && parsed.data.code ? parsed.data.code : DEFAULT_STREAM_CODE;
  batch.metricLatestMap[code] = parsed.data;
  return;
}
```

- [ ] **Step 4: Run tests to ensure pass**

Run: `pnpm test apps/frontend -- -t collectServingSseEvent`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/realtime/services/realtime-manager.ts apps/frontend/src/features/realtime/services/realtime-manager.test.ts
git commit -m "fix(realtime): collectServingSseEvent -> use maps to avoid overwrite in batch"
```

### Task 2: Implement pendingBatch + time-window flush

**Files:**
- Modify: `apps/frontend/src/features/realtime/services/realtime-manager.ts`
- Modify: `apps/frontend/src/features/realtime/services/realtime-manager.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// test that frames merged across multiple reads are flushed in one apply
test('manager flushes pending batch after window', async () => {
  const mgr = new RealtimeManager();
  jest.useFakeTimers();
  mgr['pendingBatch'] = null;
  // simulate parse loop adding to pending
  mgr['mergePending']({ metricLatestMap: { A: { code: 'A', ts: 1 } } });
  mgr['mergePending']({ metricLatestMap: { B: { code: 'B', ts: 2 } } });
  jest.advanceTimersByTime(100);
  // expect applyServingSseBatch called once with both A and B
});
```

- [ ] **Step 2: Implement pendingBatch**

Implementation sketch in realtime-manager.ts:
- add private pendingBatch: ServingSseBatch | null = null;
- add private applyTimer: ReturnType<typeof setTimeout> | null = null;
- add private mergePending(src: ServingSseBatch) { /* shallow merge maps, concat arrays */ }
- in stream read loop, instead of applyServingSseBatch(batch) call this.mergePending(batch) and schedule timer if not set.
- implement flushPendingBatch() which calls applyServingSseBatch(this.pendingBatch) and clears the timer.

- [ ] **Step 3: Run tests**

Run: `pnpm test apps/frontend -- -t pendingBatch`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/realtime/services/realtime-manager.ts
git commit -m "feat(realtime): add pendingBatch + 100ms flush to reduce frequent store writes"
```

### Task 3: Change applyServingSseBatch to fine-grained upserts

**Files:**
- Modify: `apps/frontend/src/features/realtime/services/realtime-manager.ts` (applyServingSseBatch)
- Modify: `apps/frontend/src/features/realtime/store/realtime.store.ts` (ensure upsert helpers)
- Test: `apps/frontend/src/features/realtime/services/realtime-manager.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// ensure applyServingSseBatch calls upsertMetricLatest for each entry
jest.spyOn(useRealtimeStore.getState(), 'upsertMetricLatest');
const batch = { metricLatestMap: { A: { code:'A' }, B: { code:'B' } } };
applyServingSseBatch(batch);
expect(useRealtimeStore.getState().upsertMetricLatest).toHaveBeenCalledTimes(2);
```

- [ ] **Step 2: Implement**

```ts
export function applyServingSseBatch(batch: ServingSseBatch): void {
  const store = useRealtimeStore.getState();
  for (const [code, payload] of Object.entries(batch.metricLatestMap || {})) {
    store.upsertMetricLatest(code, payload);
  }
  for (const [code, payload] of Object.entries(batch.marketSummaryMap || {})) {
    store.upsertMarketSummaryLatest(code, payload as any);
  }
  // ... other maps
  if (batch.spotLatestList && batch.spotLatestList.length > 0) {
    // keep only last
    store.setSpotLatestList(batch.spotLatestList[batch.spotLatestList.length - 1]);
  }
  if (typeof batch.heartbeatTs === 'number') {
    store.setHeartbeat(batch.heartbeatTs);
  }
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm test apps/frontend -- -t applyServingSseBatch`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/realtime/services/realtime-manager.ts apps/frontend/src/features/realtime/store/realtime.store.ts
git commit -m "refactor(realtime): applyServingSseBatch -> fine-grained upserts"
```

### Task 4: Add useThrottledSubscription hook

**Files:**
- Create: `apps/frontend/src/hooks/use-throttled-subscription.ts`
- Modify: `apps/frontend/src/features/dashboard/components/RealtimeSseChartsSection.tsx` (use the new hook)
- Test: `apps/frontend/src/features/realtime/hooks/use-throttled-subscription.test.tsx`

- [ ] **Step 1: Write test**

```tsx
import { renderHook, act } from '@testing-library/react';
import { useThrottledSubscription } from '@/hooks/use-throttled-subscription';

test('throttles updates to 100ms', async () => {
  const store = useRealtimeStore.getState();
  const selector = (s) => s.kbarCurrentByCode['TXFE6'];
  const { result } = renderHook(() => useThrottledSubscription(selector, 100));
  act(() => {
    store.upsertKbarCurrent({ code: 'TXFE6', minute_ts: 1, close: 100 });
    store.upsertKbarCurrent({ code: 'TXFE6', minute_ts: 2, close: 101 });
  });
  // assert that the hook only updates once within 100ms window
});
```

- [ ] **Step 2: Implement hook**

```ts
import { useEffect, useRef, useState } from 'react';
export function useThrottledSubscription<T>(selector: (s:any)=>T, ms=100): T {
  const latestRef = useRef<T | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = useRealtimeStore.subscribe((s) => {
      latestRef.current = selector(s);
    });
    const id = setInterval(() => { setTick(t => t + 1); }, ms);
    return () => { unsub(); clearInterval(id); };
  }, [selector, ms]);
  return latestRef.current as T;
}
```

- [ ] **Step 3: Integrate in charts**

Replace useKbarCurrent with useThrottledSubscription((s)=>s.kbarCurrentByCode['TXFE6'], 100)

- [ ] **Step 4: Run tests and commit**

Run: `pnpm test apps/frontend -- -t use-throttled-subscription`

```bash
git add apps/frontend/src/hooks/use-throttled-subscription.ts apps/frontend/src/features/dashboard/components/RealtimeSseChartsSection.tsx
git commit -m "feat(realtime): add useThrottledSubscription to limit UI updates to 10Hz"
```

### Task 5: Replace series append with ring-buffer (in-place)

**Files:**
- Modify: `apps/frontend/src/features/dashboard/components/RealtimeSseChartsSection.tsx` (appendPoint)
- Test: `apps/frontend/src/features/dashboard/components/RealtimeSseChartsSection.test.tsx`

- [ ] **Step 1: Write failing test**

```ts
import { appendPoint } from './RealtimeSseChartsSection';

test('appendPoint uses cap and replaces last with same ts', () => {
  const list = [{ts:1, value:10}];
  const next = {ts:1, value:12};
  expect(appendPoint(list, next, 2)).toEqual([{ts:1, value:12}]);
});
```

- [ ] **Step 2: Implement ring buffer logic**

Replace earlier appendPoint with in-place capped ring buffer or efficient shallow copy.

- [ ] **Step 3: Run tests & commit**

Run: `pnpm test apps/frontend -- -t RealtimeSseChartsSection`

```bash
git add apps/frontend/src/features/dashboard/components/RealtimeSseChartsSection.tsx
git commit -m "perf(realtime): use in-place capped buffer for series append to reduce allocations"
```

### Task 6: Integration and manual profiling

**Files:**
- No file changes; run profiling.

- [ ] **Step 1: Start dev server**

Run: `pnpm --filter @frontend dev` (or `pnpm dev` per repo) and open Chrome DevTools

- [ ] **Step 2: Enable mock high-frequency stream**

Set `VITE_ENABLE_SPOT_GAP_K_MOCK=true` and load dashboard.

- [ ] **Step 3: Record performance**

Record 60s profile; measure main-thread time, GC, FPS, and check console for errors.

- [ ] **Step 4: Iterate**

If CPU still high, proceed with Worker plan (Task 7)

- [ ] **Commit results / notes**

### Task 7 (optional): Move parsing to Web Worker

[Detailed steps omitted here for brevity — will be added when chosen]

---

Spec self-review:
- Spec coverage: Tasks 1–5 implement design points A–D. Worker path deferred to Task 7.
- Placeholder scan: Ensure Task 7 expanded before implementation.

Plan saved to `docs/superpowers/plans/2026-04-18-sse-batching-plan.md`.

Execution options: Subagent-Driven or Inline Execution. Which? (choose one)