# TXF Order Flow Realtime Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace mock data in `MARKET OVERVIEW > Order Flow` with real `TXF` today-baseline + SSE incremental updates.

**Architecture:** Keep the existing app-level SSE connection (`RealtimeBootstrap` + `realtime-manager` + `realtime.store`) and add a reusable dashboard data layer for `TXF` timeline assembly. Baseline data is fetched from serving REST endpoints (`kbar today` + `bidask today`), then patched minute-by-minute from SSE `kbar_current` and `metric_latest` updates. `Order Flow` remains the same chart type and only switches to the new data source.

**Tech Stack:** React 19, TypeScript, Zustand, Zod, Recharts, Vitest + Testing Library.

---

### Task 1: Extend Realtime Metric Contract for `main_force_big_order`

**Files:**
- Modify: `apps/frontend/src/features/realtime/schemas/serving-event.schema.ts`
- Modify: `apps/frontend/src/features/realtime/services/realtime-manager.test.ts`

**Step 1: Write the failing test**

Add a new test in `realtime-manager.test.ts`:

```ts
it("stores main_force_big_order from metric_latest payload", () => {
  applyServingSseEvent("kbar_current", {
    code: "TXF",
    trade_date: "2026-04-08",
    minute_ts: 1775600400000,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 10,
  });

  applyServingSseEvent("metric_latest", {
    main_force_big_order: 321,
    ts: 1775600405000,
  });

  const state = useRealtimeStore.getState();
  expect(state.metricLatestByCode.TXF?.main_force_big_order).toBe(321);
});
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix apps/frontend run test -- src/features/realtime/services/realtime-manager.test.ts`  
Expected: FAIL because `main_force_big_order` is stripped by schema validation.

**Step 3: Write minimal implementation**

Add optional field to `MetricLatestSchema`:

```ts
main_force_big_order: z.number().optional(),
```

**Step 4: Run test to verify it passes**

Run: `npm --prefix apps/frontend run test -- src/features/realtime/services/realtime-manager.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/realtime/schemas/serving-event.schema.ts apps/frontend/src/features/realtime/services/realtime-manager.test.ts
git commit -m "feat(frontend): accept main_force_big_order in realtime metric payload"
```

### Task 2: Add Dashboard API Client for TXF Order-Flow Baseline

**Files:**
- Create: `apps/frontend/src/features/dashboard/api/market-overview.ts`
- Create: `apps/frontend/src/features/dashboard/api/market-overview.test.ts`
- Modify: `apps/frontend/src/features/dashboard/api/types.ts` (create if absent)

**Step 1: Write the failing test**

Create tests asserting endpoint paths and auth header:

```ts
it("requests TXF kbar and bidask today baselines with bearer token", async () => {
  // mock fetch for two endpoints
  // call getOrderFlowBaseline("token", "TXF")
  // assert `/v1/kbar/1m/today?code=TXF` and `/v1/metric/bidask/today?code=TXF`
});
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix apps/frontend run test -- src/features/dashboard/api/market-overview.test.ts`  
Expected: FAIL because API module does not exist.

**Step 3: Write minimal implementation**

Implement:

```ts
export async function getOrderFlowBaseline(token: string, code = "TXF") {
  const [kbarToday, metricToday] = await Promise.all([
    getJson<KbarTodayResponse>(`/v1/kbar/1m/today?code=${encodeURIComponent(code)}`, { headers: { Authorization: `Bearer ${token}` } }),
    getJson<MetricTodayResponse>(`/v1/metric/bidask/today?code=${encodeURIComponent(code)}`, { headers: { Authorization: `Bearer ${token}` } }),
  ]);
  return { kbarToday, metricToday };
}
```

**Step 4: Run test to verify it passes**

Run: `npm --prefix apps/frontend run test -- src/features/dashboard/api/market-overview.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/api/market-overview.ts apps/frontend/src/features/dashboard/api/market-overview.test.ts apps/frontend/src/features/dashboard/api/types.ts
git commit -m "feat(frontend): add TXF order-flow baseline API client"
```

### Task 3: Build Minute Alignment Mapper (`kbar close` + `main_force_big_order`)

**Files:**
- Create: `apps/frontend/src/features/dashboard/lib/market-overview-mapper.ts`
- Create: `apps/frontend/src/features/dashboard/lib/market-overview-mapper.test.ts`

**Step 1: Write the failing test**

Create mapper tests:

```ts
it("uses kbar close as indexPrice and last bidask sample per minute as chipDelta", () => {
  // minute 09:01 has 3 bidask samples with increasing ts
  // expect chipDelta = last sample value
});

it("defaults chipDelta to 0 when minute has kbar but no bidask", () => {
  // expect chipDelta === 0
});
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix apps/frontend run test -- src/features/dashboard/lib/market-overview-mapper.test.ts`  
Expected: FAIL because mapper does not exist.

**Step 3: Write minimal implementation**

Implement pure functions:

```ts
export function minuteKeyFromEpochMs(ts: number): number {
  return Math.floor(ts / 60000) * 60000;
}

export function buildOrderFlowSeries(kbars: KbarPoint[], metrics: MetricPoint[]): OrderFlowPoint[] {
  // map kbar close by minute
  // keep latest main_force_big_order by minute (max ts in minute)
  // emit sorted points with chipDelta fallback to 0
}

export function applyRealtimePatch(series: OrderFlowPoint[], patch: RealtimePatch): OrderFlowPoint[] {
  // update or append one minute point only
}
```

**Step 4: Run test to verify it passes**

Run: `npm --prefix apps/frontend run test -- src/features/dashboard/lib/market-overview-mapper.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/lib/market-overview-mapper.ts apps/frontend/src/features/dashboard/lib/market-overview-mapper.test.ts
git commit -m "feat(frontend): add order-flow minute alignment mapper"
```

### Task 4: Add Reusable Hook for TXF Today Timeline

**Files:**
- Create: `apps/frontend/src/features/dashboard/hooks/use-market-overview-timeline.ts`
- Create: `apps/frontend/src/features/dashboard/hooks/use-market-overview-timeline.test.tsx`
- Modify: `apps/frontend/src/features/realtime/hooks/use-kbar-current.ts` (if selector helper export needed)
- Modify: `apps/frontend/src/features/realtime/hooks/use-metric-latest.ts` (if selector helper export needed)

**Step 1: Write the failing test**

Create hook tests with mocked baseline API:

```tsx
it("builds baseline series from today's TXF kbar + bidask responses", async () => {
  // mock getOrderFlowBaseline
  // render a harness component using hook
  // expect resulting series length and minute values
});

it("patches current minute when realtime store receives kbar_current/metric_latest", async () => {
  // seed baseline
  // push realtime events into useRealtimeStore
  // expect series last point updated, not full reset
});
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix apps/frontend run test -- src/features/dashboard/hooks/use-market-overview-timeline.test.tsx`  
Expected: FAIL because hook does not exist.

**Step 3: Write minimal implementation**

Implement hook with fixed code `TXF`:

```ts
export function useMarketOverviewTimeline() {
  // token/role guard
  // fetch baseline once via getOrderFlowBaseline(token, "TXF")
  // keep local series state
  // watch realtime store slices for TXF and applyRealtimePatch
  // return { series, loading, error }
}
```

**Step 4: Run test to verify it passes**

Run: `npm --prefix apps/frontend run test -- src/features/dashboard/hooks/use-market-overview-timeline.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/hooks/use-market-overview-timeline.ts apps/frontend/src/features/dashboard/hooks/use-market-overview-timeline.test.tsx apps/frontend/src/features/realtime/hooks/use-kbar-current.ts apps/frontend/src/features/realtime/hooks/use-metric-latest.ts
git commit -m "feat(frontend): add reusable TXF market-overview timeline hook"
```

### Task 5: Wire Order Flow Card to the New Data Layer

**Files:**
- Modify: `apps/frontend/src/features/dashboard/components/PanelCharts.tsx`
- Create: `apps/frontend/src/features/dashboard/components/OrderFlowCard.tsx`
- Create: `apps/frontend/src/features/dashboard/components/OrderFlowCard.test.tsx`
- Modify: `apps/frontend/src/features/dashboard/components/RealtimeDashboardOverview.tsx`

**Step 1: Write the failing test**

Create card-level tests:

```tsx
it("shows loading state before baseline is ready", () => {
  // mock hook loading=true
  // expect loading copy
});

it("renders OrderFlowChart with hook series once data is ready", () => {
  // mock hook with known points
  // expect chart container present and no mock text
});
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix apps/frontend run test -- src/features/dashboard/components/OrderFlowCard.test.tsx`  
Expected: FAIL because component does not exist.

**Step 3: Write minimal implementation**

Implementation shape:

```tsx
// OrderFlowCard.tsx
const { series, loading, error } = useMarketOverviewTimeline();
if (loading) return <EmptyState text="Loading TXF order-flow..." />;
if (error) return <EmptyState text="Failed to load order-flow data." />;
return <OrderFlowChart data={series} />;
```

Also update `OrderFlowChart` to accept `data` prop and remove mock generator from this card path.

**Step 4: Run test to verify it passes**

Run: `npm --prefix apps/frontend run test -- src/features/dashboard/components/OrderFlowCard.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/components/PanelCharts.tsx apps/frontend/src/features/dashboard/components/OrderFlowCard.tsx apps/frontend/src/features/dashboard/components/OrderFlowCard.test.tsx apps/frontend/src/features/dashboard/components/RealtimeDashboardOverview.tsx
git commit -m "feat(frontend): wire Order Flow card to TXF realtime timeline"
```

### Task 6: Regression and Safety Checks

**Files:**
- Modify (if assertion updates required): `apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`
- Modify (if needed): `apps/frontend/src/features/realtime/services/realtime-manager.test.ts`

**Step 1: Write or adjust failing regression assertions**

Add/adjust assertions to ensure dashboard sections still render with new card composition.

**Step 2: Run focused tests**

Run:

```bash
npm --prefix apps/frontend run test -- src/features/realtime/services/realtime-manager.test.ts
npm --prefix apps/frontend run test -- src/features/dashboard/components/OrderFlowCard.test.tsx
npm --prefix apps/frontend run test -- src/features/dashboard/pages/RealtimeDashboardPage.test.tsx
```

Expected: PASS.

**Step 3: Run broader checks**

Run:

```bash
npm --prefix apps/frontend run typecheck
npm --prefix apps/frontend run test
```

Expected: no type errors and all tests pass.

**Step 4: Commit**

```bash
git add apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx apps/frontend/src/features/realtime/services/realtime-manager.test.ts
git commit -m "test(frontend): add regression coverage for TXF order-flow integration"
```
