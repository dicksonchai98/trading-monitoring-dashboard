# Dashboard Half Gauge Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the dashboard gauge cards so they render as half-circle pie charts with correctly aligned needles.

**Architecture:** Keep the dashboard card composition unchanged and update only the gauge chart geometry. Share one geometry definition between the Recharts `Pie` and the custom needle path so the needle center and angle always match the half-circle gauge.

**Tech Stack:** React, TypeScript, Recharts, Vitest, Testing Library

---

### Task 1: Fix half-gauge geometry

**Files:**
- Modify: `apps/frontend/src/features/dashboard/components/DashboardMetricPanels.tsx`
- Test: `apps/frontend/src/features/dashboard/pages/RealtimeDashboardPage.test.tsx`

**Step 1: Write the failing test**

Add one assertion that the five gauge charts still render after the geometry change.

**Step 2: Run test to verify it fails**

Run: `npm.cmd test -- RealtimeDashboardPage.test.tsx`
Expected: FAIL after tightening the test before the geometry fix is applied.

**Step 3: Write minimal implementation**

Update the gauge pie to use half-circle angles and unify the needle geometry with the pie center/radii.

**Step 4: Run test to verify it passes**

Run: `npm.cmd test -- RealtimeDashboardPage.test.tsx`
Expected: PASS

**Step 5: Run related tests**

Run: `npm.cmd test -- RealtimeDashboardPage.test.tsx panel-card.test.tsx`
Expected: PASS
