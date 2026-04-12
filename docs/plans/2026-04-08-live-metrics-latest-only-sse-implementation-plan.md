# Live Metrics Latest-Only SSE Wiring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire `LIVE METRICS` to four realtime fields (`day_amplitude`, `estimated_turnover`, `spread`, `main_force_big_order_strength`) and show latest-only values with sticky last-valid fallback.

**Architecture:** Keep one existing SSE connection (`/v1/stream/sse`) and consume three event families (`kbar_current`, `metric_latest`, `market_summary_latest`) through realtime schemas/store/hooks. `DashboardMetricPanels` reads latest values only and applies per-field sticky fallback in UI state.

**Tech Stack:** React 19, TypeScript (strict), Zustand, Zod, Vitest, Testing Library.

---

### Task 1: Complete Realtime SSE Contract for Required Fields

**Files:**
- Modify: `apps/frontend/src/features/realtime/schemas/serving-event.schema.ts`
- Modify: `apps/frontend/src/features/realtime/types/realtime.types.ts`
- Modify: `apps/frontend/src/features/realtime/services/realtime-manager.ts`
- Test: `apps/frontend/src/features/realtime/services/realtime-manager.test.ts`

**Step 1: Write the failing test**

```ts
it("accepts and stores day_amplitude/main_force_big_order_strength/spread/estimated_turnover", () => {
  applyServingSseEvent("kbar_current", { code: "TXFD6", trade_date: "2026-04-08", minute_ts: 1775600400000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10, day_amplitude: 1.5 });
  applyServingSseEvent("metric_latest", { main_force_big_order_strength: 0.72, ts: 1775600405000 });
  applyServingSseEvent("market_summary_latest", { spread: 12.5, estimated_turnover: 2940000000, minute_ts: 1775600460000 });

  const state = useRealtimeStore.getState();
  expect(state.kbarCurrentByCode.TXFD6?.day_amplitude).toBe(1.5);
  expect(state.metricLatestByCode.TXFD6?.main_force_big_order_strength).toBe(0.72);
  expect(state.marketSummaryLatestByCode.TXFD6?.spread).toBe(12.5);
  expect(state.marketSummaryLatestByCode.TXFD6?.estimated_turnover).toBe(2940000000);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/realtime/services/realtime-manager.test.ts`  
Expected: FAIL due missing schema fields or missing event mapping.

**Step 3: Write minimal implementation**

```ts
// KbarCurrentSchema add
 day_amplitude: z.number().nullable().optional(),

// MetricLatestSchema add
 main_force_big_order_strength: z.number().nullable().optional(),

// MarketSummaryLatestSchema add
 spread: z.number().nullable().optional(),
 estimated_turnover: z.number().nullable().optional(),
```

Ensure `applyServingSseEvent("market_summary_latest", ...)` upserts `marketSummaryLatestByCode` with fallback code `TXFD6` when missing.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/features/realtime/services/realtime-manager.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/realtime/schemas/serving-event.schema.ts apps/frontend/src/features/realtime/types/realtime.types.ts apps/frontend/src/features/realtime/services/realtime-manager.ts apps/frontend/src/features/realtime/services/realtime-manager.test.ts
git commit -m "feat(frontend): extend SSE contract for live metrics fields"
```

### Task 2: Expose Market Summary Latest Hook for Dashboard Use

**Files:**
- Create: `apps/frontend/src/features/realtime/hooks/use-market-summary-latest.ts`
- Test: `apps/frontend/src/features/realtime/hooks/use-market-summary-latest.test.tsx`

**Step 1: Write the failing test**

```tsx
it("returns latest market summary payload by code", () => {
  useRealtimeStore.getState().upsertMarketSummaryLatest("TXFD6", { spread: 10, estimated_turnover: 2000 });
  const { result } = renderHook(() => useMarketSummaryLatest("TXFD6"));
  expect(result.current?.spread).toBe(10);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/realtime/hooks/use-market-summary-latest.test.tsx`  
Expected: FAIL with missing hook file/export.

**Step 3: Write minimal implementation**

```ts
export function useMarketSummaryLatest(code: string): MarketSummaryLatestPayload | null {
  return useRealtimeStore((state) => state.marketSummaryLatestByCode[code] ?? null);
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/features/realtime/hooks/use-market-summary-latest.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/realtime/hooks/use-market-summary-latest.ts apps/frontend/src/features/realtime/hooks/use-market-summary-latest.test.tsx
git commit -m "feat(frontend): add market summary latest selector hook"
```

### Task 3: Wire LIVE METRICS Cards to Latest Values with Sticky Fallback

**Files:**
- Modify: `apps/frontend/src/features/dashboard/components/DashboardMetricPanels.tsx`
- Test: `apps/frontend/src/features/dashboard/components/DashboardMetricPanels.live-metrics.test.tsx`

**Step 1: Write the failing test**

```tsx
it("renders latest-only values and keeps last valid on missing updates", () => {
  useRealtimeStore.getState().upsertKbarCurrent({ code: "TXFD6", trade_date: "2026-04-08", minute_ts: 1, open: 1, high: 2, low: 0, close: 1.5, volume: 1, day_amplitude: 2 });
  useRealtimeStore.getState().upsertMetricLatest("TXFD6", { main_force_big_order_strength: 0.6, ts: 2 });
  useRealtimeStore.getState().upsertMarketSummaryLatest("TXFD6", { spread: 11.5, estimated_turnover: 123456789, minute_ts: 3 });

  render(<DashboardMetricPanels />);
  expect(screen.getByTestId("live-metrics-day-amplitude")).toHaveTextContent("2.00");
  expect(screen.getByTestId("live-metrics-spread")).toHaveTextContent("11.50");
  expect(screen.getByTestId("live-metrics-estimated-turnover")).toHaveTextContent("123,456,789");
  expect(screen.getByTestId("live-metrics-main-force-strength")).toHaveTextContent("60.0%");

  useRealtimeStore.getState().upsertMarketSummaryLatest("TXFD6", { spread: null, estimated_turnover: null, minute_ts: 4 });
  expect(screen.getByTestId("live-metrics-spread")).toHaveTextContent("11.50");
  expect(screen.getByTestId("live-metrics-estimated-turnover")).toHaveTextContent("123,456,789");
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/dashboard/components/DashboardMetricPanels.live-metrics.test.tsx`  
Expected: FAIL because cards are still static and missing test ids.

**Step 3: Write minimal implementation**

```tsx
// inside DashboardMetricPanels
const kbar = useKbarCurrent("TXFD6");
const metric = useMetricLatest("TXFD6");
const marketSummary = useMarketSummaryLatest("TXFD6");

// maintain last valid values per field in local state/ref
// render values into four mini cards with dedicated data-testid
```

Render-only requirement:
- no history arrays for these cards
- initial unknown => `--`
- later null => keep previous valid

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/features/dashboard/components/DashboardMetricPanels.live-metrics.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/components/DashboardMetricPanels.tsx apps/frontend/src/features/dashboard/components/DashboardMetricPanels.live-metrics.test.tsx
git commit -m "feat(frontend): wire live metrics latest-only realtime cards"
```

### Task 4: Regression Safety and Final Verification

**Files:**
- Modify (if needed): `apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`
- Test: `apps/frontend/src/features/realtime/services/realtime-manager.test.ts`
- Test: `apps/frontend/src/features/dashboard/components/DashboardMetricPanels.test.ts`
- Test: `apps/frontend/src/features/dashboard/components/DashboardMetricPanels.live-metrics.test.tsx`

**Step 1: Add/adjust regression assertions**

```tsx
expect(screen.getByText("LIVE METRICS")).toBeInTheDocument();
expect(screen.getByTestId("live-metrics-day-amplitude")).toBeInTheDocument();
```

**Step 2: Run focused suite**

Run:
- `npm run test -- src/features/realtime/services/realtime-manager.test.ts`
- `npm run test -- src/features/dashboard/components/DashboardMetricPanels.test.ts`
- `npm run test -- src/features/dashboard/components/DashboardMetricPanels.live-metrics.test.tsx`
- `npm run test -- src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`

Expected: all PASS.

**Step 3: Run frontend typecheck**

Run: `npm run typecheck`  
Expected: PASS with no new TS errors.

**Step 4: Optional full frontend tests for confidence**

Run: `npm run test`  
Expected: PASS (or only unrelated pre-existing failures).

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx apps/frontend/src/features/dashboard/components/DashboardMetricPanels.test.ts apps/frontend/src/features/dashboard/components/DashboardMetricPanels.live-metrics.test.tsx
git commit -m "test(frontend): add live metrics latest-only regression coverage"
```
