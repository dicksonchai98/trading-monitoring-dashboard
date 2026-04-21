# Dashboard Market Distribution Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the backend market distribution snapshot and intraday trend series inside the realtime dashboard as one overlaid chart panel.

**Architecture:** Reuse the existing realtime SSE store as the source of truth, then render a dedicated dashboard chart component that reads the latest distribution payload and series payload directly from Zustand. The chart should overlay bucket counts with the trend index on the same panel so the dashboard stays compact and the backend-derived data remains the only computation source.

**Tech Stack:** React, Zustand, Recharts, existing `PanelCard` / `BentoGridSection` dashboard layout, existing realtime SSE schemas and store.

---

### Task 1: Add a reusable market distribution chart component

**Files:**
- Create: `apps/frontend/src/features/dashboard/components/SpotMarketDistributionCard.tsx`
- Test: `apps/frontend/src/features/dashboard/components/SpotMarketDistributionCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
render(
  <SpotMarketDistributionCard />
);

expect(screen.getByTestId("spot-market-distribution-card")).toBeInTheDocument();
expect(screen.getByTestId("spot-market-distribution-chart")).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/features/dashboard/components/SpotMarketDistributionCard.test.tsx`
Expected: FAIL because the component does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
const { spotMarketDistributionLatest, spotMarketDistributionSeries } = useRealtimeStore();
```

Render a `PanelCard` with a `ComposedChart` that:
- uses `distribution_buckets` for bar data,
- overlays `trend_index` as a line series,
- shows an empty state when both payloads are missing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/features/dashboard/components/SpotMarketDistributionCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/components/SpotMarketDistributionCard.tsx apps/frontend/src/features/dashboard/components/SpotMarketDistributionCard.test.tsx
git commit -m "feat(frontend): add market distribution chart card"
```

### Task 2: Wire the card into the realtime dashboard

**Files:**
- Modify: `apps/frontend/src/features/dashboard/components/RealtimeDashboardOverview.tsx`
- Modify: `apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
render(
  <MemoryRouter initialEntries={["/dashboard"]}>
    <RealtimeDashboardPage />
  </MemoryRouter>,
);

expect(screen.getByTestId("spot-market-distribution-card")).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`
Expected: FAIL because the dashboard does not render the new card yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { SpotMarketDistributionCard } from "@/features/dashboard/components/SpotMarketDistributionCard";
```

Insert the card into the existing realtime dashboard section near the other realtime panels.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/components/RealtimeDashboardOverview.tsx apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx
git commit -m "feat(frontend): show market distribution on dashboard"
```

### Task 3: Add translations and polish the chart labels

**Files:**
- Modify: `apps/frontend/src/lib/i18n/messages.ts`
- Modify: `apps/frontend/src/features/dashboard/components/SpotMarketDistributionCard.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
expect(screen.getByText("漲跌分布")).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/features/dashboard/components/SpotMarketDistributionCard.test.tsx`
Expected: FAIL until the new message keys are added.

- [ ] **Step 3: Write minimal implementation**

Add the new `dashboard.realtime.marketDistribution.title` / `meta` keys in both language blocks and use them in the card header.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/features/dashboard/components/SpotMarketDistributionCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/lib/i18n/messages.ts apps/frontend/src/features/dashboard/components/SpotMarketDistributionCard.tsx
git commit -m "feat(frontend): add market distribution copy"
```

### Task 4: Verify the dashboard render path

**Files:**
- Modify: `apps/frontend/src/features/dashboard/components/SpotMarketDistributionCard.test.tsx`
- Modify: `apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
expect(screen.getByText("Trend Index")).toBeInTheDocument();
expect(screen.getByTestId("panel-chart")).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/features/dashboard/components/SpotMarketDistributionCard.test.tsx src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`
Expected: FAIL if the overlay labels or render path are missing.

- [ ] **Step 3: Write minimal implementation**

Make sure the chart exposes the panel test id, renders the overlay line, and keeps the chart inside the card content area.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/features/dashboard/components/SpotMarketDistributionCard.test.tsx src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/components/SpotMarketDistributionCard.test.tsx apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx
git commit -m "test(frontend): cover market distribution dashboard"
```

