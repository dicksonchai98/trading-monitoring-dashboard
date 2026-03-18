# Dashboard Metric Panel Removal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the five `piechart with needle` metric panels from the realtime dashboard and keep the remaining metric cards and dashboard sections working.

**Architecture:** Keep the existing dashboard composition intact and change only the metric panel mapping so `value` panels still render while `piechart with needle` entries are omitted. Update the dashboard page test first to assert the needle panels are gone, then make the minimal rendering change to satisfy that behavior.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library

---

### Task 1: Remove needle metric panels from the dashboard

**Files:**
- Modify: `apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`
- Modify: `apps/frontend/src/features/dashboard/components/DashboardMetricPanels.tsx`

**Step 1: Write the failing test**

Change the dashboard page test so it expects:
- 3 `dashboard-metric-panel` cards
- 0 `metric-needle-chart`
- 0 `metric-needle-value`
- 0 `metric-needle-track`
- 0 `metric-needle-active`
- 3 `metric-value-card`
- 8 total `panel-chart` instances

**Step 2: Run test to verify it fails**

Run: `npm test -- RealtimeDashboardPage.test.tsx`
Expected: FAIL because the page still renders the five needle panels.

**Step 3: Write minimal implementation**

Update the dashboard metric panel mapping to skip `piechart with needle` items entirely and render only `value` cards.

**Step 4: Run test to verify it passes**

Run: `npm test -- RealtimeDashboardPage.test.tsx`
Expected: PASS

**Step 5: Run related tests**

Run: `npm test -- panel-card.test.tsx RealtimeDashboardPage.test.tsx`
Expected: PASS
