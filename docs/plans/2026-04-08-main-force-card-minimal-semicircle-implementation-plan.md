# Main Force Minimal Semicircle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the `主力大戶` card to a stable semicircle `PieChart` with single-color active fill and realtime percent text below.

**Architecture:** Keep existing SSE/store wiring and only change the presentation layer of the `主力大戶` card. Use a two-slice semicircle (`active` + `rest`) in `PieChart`; map `main_force_big_order_strength` to fill ratio and retain last valid value behavior.

**Tech Stack:** React 19, TypeScript, Recharts, Zustand, Vitest, Testing Library.

---

### Task 1: Add failing tests for minimal semicircle requirements

**Files:**
- Modify: `apps/frontend/src/features/dashboard/components/DashboardMetricPanels.main-force.test.tsx`

**Step 1: Write the failing test**

```tsx
it("renders only semicircle + numeric percent for 主力大戶", () => {
  // seed realtime store with 0.631
  // render DashboardMetricPanels
  // assert card title exists
  // assert percent text is 63.1%
  // assert no threshold labels (40/70/WEAK/STRONG) exist
});

it("keeps last valid value when subsequent payload is missing", () => {
  // seed value 0.631 -> render -> assert 63.1%
  // push undefined/null field
  // assert still 63.1%
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/dashboard/components/DashboardMetricPanels.main-force.test.tsx`  
Expected: FAIL because current UI still has extra decorations/labels.

**Step 3: Commit test-first change**

```bash
git add apps/frontend/src/features/dashboard/components/DashboardMetricPanels.main-force.test.tsx
git commit -m "test(frontend): define minimal main-force semicircle expectations"
```

### Task 2: Replace complex gauge with minimal PieChart semicircle

**Files:**
- Modify: `apps/frontend/src/features/dashboard/components/DashboardMetricPanels.tsx`

**Step 1: Implement minimal semicircle view**

```tsx
// 主力大戶 only:
// - PieChart semicircle with [active, rest]
// - single active color
// - neutral rest color
// - no thresholds, no tier labels, no extra decorations
```

**Step 2: Keep realtime mapping and sticky latest behavior**

```tsx
// source: metric?.main_force_big_order_strength
// clamp [0,1] -> percent [0,100]
// display percent.toFixed(1) + "%"
// initial --, missing updates keep last valid
```

**Step 3: Enforce layout safety**

```tsx
// container should avoid overflow and fixed absolute marker overlays
// keep chart + numeric text in a simple vertical layout
```

**Step 4: Run targeted test**

Run: `npm run test -- src/features/dashboard/components/DashboardMetricPanels.main-force.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/components/DashboardMetricPanels.tsx apps/frontend/src/features/dashboard/components/DashboardMetricPanels.main-force.test.tsx
git commit -m "feat(frontend): simplify main-force card to minimal semicircle"
```

### Task 3: Realtime contract regression check

**Files:**
- Modify (if needed): `apps/frontend/src/features/realtime/services/realtime-manager.test.ts`
- Modify (if needed): `apps/frontend/src/features/realtime/schemas/serving-event.schema.ts`

**Step 1: Verify required fields remain accepted**

Check tests still validate:
- `main_force_big_order_strength` in `metric_latest`
- `day_amplitude` and market summary fields unchanged

**Step 2: Run focused realtime tests**

Run: `npm run test -- src/features/realtime/services/realtime-manager.test.ts src/features/realtime/hooks/use-market-summary-latest.test.tsx`  
Expected: PASS.

**Step 3: Commit (only if files changed)**

```bash
git add apps/frontend/src/features/realtime/services/realtime-manager.test.ts apps/frontend/src/features/realtime/schemas/serving-event.schema.ts
git commit -m "test(frontend): keep realtime contract coverage for main-force metric"
```

### Task 4: Final verification gate

**Files:**
- No new files required unless fixes are discovered.

**Step 1: Run combined targeted suite**

Run:
- `npm run test -- src/features/dashboard/components/DashboardMetricPanels.main-force.test.tsx`
- `npm run test -- src/features/realtime/services/realtime-manager.test.ts`
- `npm run test -- src/features/realtime/hooks/use-market-summary-latest.test.tsx`

Expected: all PASS.

**Step 2: Optional page-level sanity**

Run: `npm run test -- src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`  
Expected: PASS (ignore known chart size warnings if unrelated to assertions).

**Step 3: Commit verification snapshot (optional)**

```bash
git add -A
git commit -m "chore(frontend): verify minimal main-force semicircle integration"
```
