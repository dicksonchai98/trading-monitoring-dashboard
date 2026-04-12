# Historical Loader Dual-Job Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the historical loader into independent Backfill and Crawler job forms on one page, plus a unified job result list.

**Architecture:** Keep one route (`/historical-data-loader`) and decompose the page into three focused components: `BackfillPanel`, `CrawlerPanel`, and `UnifiedJobsTable`. Each panel owns its own form/mutation/error state and emits normalized job records to the page-level unified list.

**Tech Stack:** React 19, TypeScript, TanStack React Query, existing `postJson/getJson` API client, Vitest + Testing Library.

---

### Task 1: Add crawler admin API client module

**Files:**
- Create: `apps/frontend/src/features/dashboard/api/crawler-jobs.ts`
- Modify: `apps/frontend/src/features/dashboard/api/historical-backfill.ts` (if shared types are extracted)
- Test: `apps/frontend/src/features/dashboard/api/crawler-jobs.test.ts`

**Step 1: Write the failing test**

```ts
import { triggerCrawlerJob } from "@/features/dashboard/api/crawler-jobs";

it("posts single-date crawler payload", async () => {
  // mock fetch -> 202
  await triggerCrawlerJob("token", { dataset_code: "txf_oi", target_date: "2026-04-08", trigger_type: "manual" });
  // assert request path/body/auth header
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/dashboard/api/crawler-jobs.test.ts`  
Expected: FAIL because module/function does not exist yet.

**Step 3: Write minimal implementation**

```ts
export function triggerCrawlerJob(token: string, payload: CrawlerSingleDateRequest | CrawlerRangeRequest) {
  return postJson<CrawlerJobResponse, typeof payload>("/admin/batch/crawler/jobs", payload, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/features/dashboard/api/crawler-jobs.test.ts`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/api/crawler-jobs.ts apps/frontend/src/features/dashboard/api/crawler-jobs.test.ts
git commit -m "feat(frontend): add crawler admin job api client"
```

### Task 2: Define shared loader job record types

**Files:**
- Create: `apps/frontend/src/features/dashboard/types/loader-jobs.ts`
- Modify: `apps/frontend/src/features/dashboard/pages/HistoricalDataLoaderPage.tsx`
- Test: covered by panel/page tests below

**Step 1: Write the failing test**

Add assertions in `HistoricalDataLoaderPage.test.tsx` expecting unified list row fields (`source`, `job_id`, `status`) once both panels emit.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/dashboard/pages/HistoricalDataLoaderPage.test.tsx`  
Expected: FAIL because unified schema/rows are missing.

**Step 3: Write minimal implementation**

```ts
export interface UnifiedLoaderJobRecord {
  source: "backfill" | "crawler";
  jobId: number;
  workerType: string;
  jobType: string;
  status: string;
  target: string;
  window: string;
  createdAt: string;
}
```

**Step 4: Run test to verify it passes (or progresses)**

Run: `npm run test -- src/features/dashboard/pages/HistoricalDataLoaderPage.test.tsx`  
Expected: still failing for UI, but type contract available for next tasks.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/types/loader-jobs.ts apps/frontend/src/features/dashboard/pages/HistoricalDataLoaderPage.tsx
git commit -m "refactor(frontend): add shared loader unified job record type"
```

### Task 3: Extract BackfillPanel component

**Files:**
- Create: `apps/frontend/src/features/dashboard/components/BackfillPanel.tsx`
- Modify: `apps/frontend/src/features/dashboard/pages/HistoricalDataLoaderPage.tsx`
- Test: `apps/frontend/src/features/dashboard/components/BackfillPanel.test.tsx`

**Step 1: Write the failing test**

```ts
it("maps single date to start_date and end_date and triggers backfill", async () => {
  // render BackfillPanel with onJobsCreated mock
  // submit single date
  // assert API called with start_date === end_date
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/dashboard/components/BackfillPanel.test.tsx`  
Expected: FAIL due missing component.

**Step 3: Write minimal implementation**

- Move current backfill form logic from page into component.
- Keep `Load Items` as multi-select codes (`TXFR1/TXFD1/TXF`).
- Emit normalized records via `onJobsCreated(records)`.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/features/dashboard/components/BackfillPanel.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/components/BackfillPanel.tsx apps/frontend/src/features/dashboard/components/BackfillPanel.test.tsx apps/frontend/src/features/dashboard/pages/HistoricalDataLoaderPage.tsx
git commit -m "refactor(frontend): extract historical backfill panel"
```

### Task 4: Implement CrawlerPanel component

**Files:**
- Create: `apps/frontend/src/features/dashboard/components/CrawlerPanel.tsx`
- Modify: `apps/frontend/src/features/dashboard/pages/HistoricalDataLoaderPage.tsx`
- Test: `apps/frontend/src/features/dashboard/components/CrawlerPanel.test.tsx`

**Step 1: Write the failing test**

```ts
it("uses target_date for single mode and start/end for range mode", async () => {
  // single submit assert target_date present
  // switch range submit assert start_date/end_date present
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/dashboard/components/CrawlerPanel.test.tsx`  
Expected: FAIL due missing component/api wiring.

**Step 3: Write minimal implementation**

- Build form fields for crawler semantics only.
- Default `trigger_type` to `manual`.
- Emit normalized records through `onJobsCreated`.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/features/dashboard/components/CrawlerPanel.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/components/CrawlerPanel.tsx apps/frontend/src/features/dashboard/components/CrawlerPanel.test.tsx apps/frontend/src/features/dashboard/pages/HistoricalDataLoaderPage.tsx
git commit -m "feat(frontend): add crawler panel to historical loader page"
```

### Task 5: Add UnifiedJobsTable component

**Files:**
- Create: `apps/frontend/src/features/dashboard/components/UnifiedJobsTable.tsx`
- Modify: `apps/frontend/src/features/dashboard/pages/HistoricalDataLoaderPage.tsx`
- Test: `apps/frontend/src/features/dashboard/components/UnifiedJobsTable.test.tsx`

**Step 1: Write the failing test**

```ts
it("renders merged rows from backfill and crawler sorted by createdAt desc", () => {
  // pass sample records and assert top row is latest
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/dashboard/components/UnifiedJobsTable.test.tsx`  
Expected: FAIL due missing table component.

**Step 3: Write minimal implementation**

- Render unified records with columns:
  - `Source`
  - `Job ID`
  - `Worker`
  - `Job Type`
  - `Status`
  - `Target`
  - `Window`
  - `Created At`
- Sort newest-first before rendering.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/features/dashboard/components/UnifiedJobsTable.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/components/UnifiedJobsTable.tsx apps/frontend/src/features/dashboard/components/UnifiedJobsTable.test.tsx apps/frontend/src/features/dashboard/pages/HistoricalDataLoaderPage.tsx
git commit -m "feat(frontend): add unified loader jobs table"
```

### Task 6: Compose page with both panels and unified table

**Files:**
- Modify: `apps/frontend/src/features/dashboard/pages/HistoricalDataLoaderPage.tsx`
- Modify: `apps/frontend/src/features/dashboard/pages/HistoricalDataLoaderPage.test.tsx`

**Step 1: Write the failing integration test**

- Assert both panel headings/controls exist.
- Trigger mock success from each panel.
- Assert unified table contains both sources.

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/dashboard/pages/HistoricalDataLoaderPage.test.tsx`  
Expected: FAIL until composition is complete.

**Step 3: Write minimal implementation**

- Parent owns `unifiedJobs` state.
- Backfill/Crawler panel callbacks append normalized records.
- Keep existing route and page shell.

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/features/dashboard/pages/HistoricalDataLoaderPage.test.tsx`  
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/pages/HistoricalDataLoaderPage.tsx apps/frontend/src/features/dashboard/pages/HistoricalDataLoaderPage.test.tsx
git commit -m "feat(frontend): compose dual loader panels with unified jobs feed"
```

### Task 7: Regression and final verification

**Files:**
- Verify only (no required file changes)

**Step 1: Run targeted dashboard tests**

Run:

```bash
npm run test -- src/features/dashboard/pages/HistoricalDataLoaderPage.test.tsx src/features/dashboard/pages/HistoricalDataAnalysisPage.test.tsx src/features/dashboard/pages/HistoricalAmplitudeDistributionPage.test.tsx
```

Expected: PASS (existing recharts size warnings are acceptable if no assertion fails).

**Step 2: Run frontend typecheck**

Run: `npm run typecheck`  
Expected: No new errors introduced by this change (document pre-existing unrelated failures if any).

**Step 3: Final commit**

```bash
git add apps/frontend/src/features/dashboard
git commit -m "feat(frontend): split historical loader into backfill and crawler workflows"
```
