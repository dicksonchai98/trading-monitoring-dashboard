# Quote Main Chip and Long/Short Force Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire quote worker metrics into `Volume Ladder`, `Bid / Ask Pressure`, and `LIVE METRICS` (`主力籌碼`, `多空力道`) while preserving existing chart styles and leaving index cards untouched.

**Architecture:** Extend existing SSE contract with `quote_latest`, store latest quote payload by code in realtime Zustand store, expose selector hook, and bind specific dashboard cards to these fields with sticky last-valid fallback.

**Tech Stack:** React 19, TypeScript, Zod, Zustand, Recharts, Vitest, Testing Library.

---

### Task 1: Extend Realtime SSE Contract for `quote_latest`

**Files:**
- Modify: `apps/frontend/src/features/realtime/schemas/serving-event.schema.ts`
- Modify: `apps/frontend/src/features/realtime/types/realtime.types.ts`
- Modify: `apps/frontend/src/features/realtime/store/realtime.store.ts`
- Modify: `apps/frontend/src/features/realtime/services/realtime-manager.ts`
- Test: `apps/frontend/src/features/realtime/services/realtime-manager.test.ts`

**Step 1: Add failing test for quote event ingestion**

```ts
it("accepts quote_latest and stores latest quote by code", () => {
  applyServingSseEvent("quote_latest", {
    code: "TXFD6",
    event_ts: 1775800800000,
    main_chip: 123,
    long_short_force: -45,
    main_chip_strength: 0.62,
    long_short_force_strength: 0.41,
  });

  const state = useRealtimeStore.getState();
  expect(state.quoteLatestByCode.TXFD6?.main_chip).toBe(123);
  expect(state.quoteLatestByCode.TXFD6?.long_short_force).toBe(-45);
  expect(state.quoteLatestByCode.TXFD6?.main_chip_strength).toBe(0.62);
  expect(state.quoteLatestByCode.TXFD6?.long_short_force_strength).toBe(0.41);
});
```

**Step 2: Run test to verify failure**

Run: `npm run test -- src/features/realtime/services/realtime-manager.test.ts`  
Expected: FAIL due missing schema/event/store wiring.

**Step 3: Implement minimal contract wiring**

- Add `QuoteLatestSchema`.
- Add `QuoteLatestPayload` type and `ServingSseEventName` union member `quote_latest`.
- Add `quoteLatestByCode`, `upsertQuoteLatest`, and batch support in store.
- Parse and batch `quote_latest` in realtime manager with code fallback `TXFD6`.

**Step 4: Re-run targeted test**

Run: `npm run test -- src/features/realtime/services/realtime-manager.test.ts`  
Expected: PASS.

### Task 2: Add Quote Selector Hook and Bind Dashboard Data Sources

**Files:**
- Create: `apps/frontend/src/features/realtime/hooks/use-quote-latest.ts`
- Modify: `apps/frontend/src/features/dashboard/components/RealtimeDashboardOverview.tsx`
- Modify: `apps/frontend/src/features/dashboard/components/PanelCharts.tsx`
- Test: `apps/frontend/src/features/realtime/hooks/use-quote-latest.test.tsx`

**Step 1: Add failing hook test**

```tsx
it("returns latest quote payload by code", () => {
  useRealtimeStore.getState().upsertQuoteLatest("TXFD6", { main_chip: 11 });
  const { result } = renderHook(() => useQuoteLatest("TXFD6"));
  expect(result.current?.main_chip).toBe(11);
});
```

**Step 2: Implement hook and source wiring**

- Implement `useQuoteLatest(code)` from realtime store.
- In `RealtimeDashboardOverview`, pass quote-derived optional series inputs to `VolumeLadderChart` and `BidAskPressureChart`.
- In `PanelCharts`, consume incoming quote values as data source for secondary metric channel while preserving current chart render styles.

**Step 3: Verify style invariance**

- No changes to chart component visual props (axis config, colors, line/bar types, tooltip styles).
- Ensure only data mapping logic changes.

**Step 4: Run focused tests**

Run:
- `npm run test -- src/features/realtime/hooks/use-quote-latest.test.tsx`
- `npm run test -- src/features/dashboard/components/RealtimeDashboardPage.test.tsx`

Expected: PASS.

### Task 3: Wire LIVE METRICS Cards for `主力籌碼` / `多空力道`

**Files:**
- Modify: `apps/frontend/src/features/dashboard/components/DashboardMetricPanels.tsx`
- Test: `apps/frontend/src/features/dashboard/components/DashboardMetricPanels.test.ts`

**Step 1: Add failing card mapping tests**

```tsx
it("maps 主力籌碼 and 多空力道 to quote strength fields", () => {
  useRealtimeStore.getState().upsertQuoteLatest("TXFD6", {
    main_chip_strength: 0.66,
    long_short_force_strength: 0.38,
  });

  render(<DashboardMetricPanels />);
  expect(screen.getByTestId("live-metrics-main-chip-strength")).toHaveTextContent("66.0%");
  expect(screen.getByTestId("live-metrics-long-short-force-strength")).toHaveTextContent("38.0%");
});
```

**Step 2: Implement mapping with sticky latest fallback**

- Read quote latest via hook.
- Apply finite-number sticky logic per field.
- Render target cards with required test ids.

**Step 3: Re-run tests**

Run: `npm run test -- src/features/dashboard/components/DashboardMetricPanels.test.ts`  
Expected: PASS.

### Task 4: Style-Only Adjustment for `散戶小單` and `主力大戶`

**Files:**
- Modify: `apps/frontend/src/features/dashboard/components/DashboardMetricPanels.tsx`
- Test: `apps/frontend/src/features/dashboard/components/DashboardMetricPanels.main-force.test.tsx`

**Step 1: Align visual style to minimalist gauge language**

- Adjust card presentation only.
- Keep existing mock/static values for both cards.
- Do not add realtime hook binding for these two cards.

**Step 2: Add/adjust regression assertions**

- Verify card renders and style structure remains expected.
- Verify no quote API binding introduced for `散戶小單` and `主力大戶`.

**Step 3: Run focused style tests**

Run: `npm run test -- src/features/dashboard/components/DashboardMetricPanels.main-force.test.tsx`  
Expected: PASS.

### Task 5: Final Verification Gate

**Files:**
- No mandatory new files; patch tests only if failures reveal regressions.

**Step 1: Run targeted suite**

Run:
- `npm run test -- src/features/realtime/services/realtime-manager.test.ts`
- `npm run test -- src/features/realtime/hooks/use-quote-latest.test.tsx`
- `npm run test -- src/features/dashboard/components/DashboardMetricPanels.test.ts`
- `npm run test -- src/features/dashboard/components/DashboardMetricPanels.main-force.test.tsx`
- `npm run test -- src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`

Expected: all PASS.

**Step 2: Run typecheck**

Run: `npm run typecheck`  
Expected: PASS with no new TS errors.

**Step 3: Optional confidence run**

Run: `npm run test`  
Expected: PASS or only unrelated pre-existing failures.
