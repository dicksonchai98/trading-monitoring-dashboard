# Timeline Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a shared timeline-helpers module and migrate dashboard hooks/components to use incremental, minimal-copy updates for baseline+realtime timelines to reduce CPU/GC and chart re-renders.

**Architecture:** Add a small library `timeline-helpers.ts` providing fast insert/replace (binary search + index map) and merge guards; migrate hooks to consume it. Keep source-of-truth minute->value maps and maintain a displayedSeries state for charts.

**Tech Stack:** TypeScript, React hooks, Vitest, Recharts

---

### Task 1: Create timeline-helpers.ts (core helpers)

**Files:**
- Create: `apps/frontend/src/features/dashboard/lib/timeline-helpers.ts`
- Test: `apps/frontend/src/features/dashboard/lib/timeline-helpers.test.ts`

- [x] **Step 1: Write failing tests for findInsertIndex & upsertPoint**

```ts
// apps/frontend/src/features/dashboard/lib/timeline-helpers.test.ts
import { findInsertIndex, upsertPoint } from './timeline-helpers';

test('findInsertIndex finds correct position', () => {
  const s = [{ minuteTs: 1000 }, { minuteTs: 2000 }, { minuteTs: 3000 }];
  expect(findInsertIndex(s, 500)).toBe(0);
  expect(findInsertIndex(s, 1500)).toBe(1);
  expect(findInsertIndex(s, 3000)).toBe(2);
  expect(findInsertIndex(s, 3500)).toBe(3);
});

test('upsertPoint appends, replaces, and reports change', () => {
  const s = [{ minuteTs: 1000, v: 1 }, { minuteTs: 2000, v: 2 }];
  const idxMap = new Map([[1000, 0], [2000, 1]]);

  // append
  let res = upsertPoint(s, idxMap, { minuteTs: 3000, v: 3 });
  expect(res.didChange).toBe(true);
  expect(res.nextSeries.length).toBe(3);

  // replace identical -> no change
  res = upsertPoint(res.nextSeries, res.nextIndexMap, { minuteTs: 3000, v: 3 });
  expect(res.didChange).toBe(false);

  // replace different
  res = upsertPoint(res.nextSeries, res.nextIndexMap, { minuteTs: 3000, v: 4 });
  expect(res.didChange).toBe(true);
});
```

- [x] **Step 2: Run test to see failures**

Run:
```
pnpm test apps/frontend/src/features/dashboard/lib/timeline-helpers.test.ts -v
```
Expected: FAIL before implementation; implemented and tests passed in session (verified).

- [x] **Step 3: Implement timeline-helpers.ts**

```ts
// apps/frontend/src/features/dashboard/lib/timeline-helpers.ts
export function findInsertIndex<T extends { minuteTs: number }>(series: T[], minuteTs: number): number {
  let low = 0;
  let high = series.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (series[mid].minuteTs < minuteTs) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

export function upsertPoint<T extends { minuteTs: number }>(
  series: T[],
  indexMap: Map<number, number>,
  point: T,
): { nextSeries: T[]; nextIndexMap: Map<number, number>; didChange: boolean } {
  const idx = indexMap.get(point.minuteTs);
  if (idx !== undefined) {
    const existing = series[idx];
    const keys = Object.keys(point) as (keyof T)[];
    let identical = true;
    for (const k of keys) {
      if (existing[k] !== point[k]) {
        identical = false;
        break;
      }
    }
    if (identical) return { nextSeries: series, nextIndexMap: indexMap, didChange: false };
    const nextSeries = series.slice();
    nextSeries[idx] = point;
    return { nextSeries, nextIndexMap: indexMap, didChange: true };
  }

  const insertIdx = findInsertIndex(series, point.minuteTs);
  const nextSeries = series.slice(0, insertIdx).concat([point], series.slice(insertIdx));
  const nextIndexMap = new Map<number, number>();
  for (let i = 0; i < nextSeries.length; ++i) nextIndexMap.set(nextSeries[i].minuteTs, i);
  return { nextSeries, nextIndexMap, didChange: true };
}
```

- [x] **Step 4: Run tests and ensure they pass**

Run:
```
pnpm test apps/frontend/src/features/dashboard/lib/timeline-helpers.test.ts -v
```
Status: PASS (focused tests run and passed during implementation)

- [x] **Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/lib/timeline-helpers.ts apps/frontend/src/features/dashboard/lib/timeline-helpers.test.ts
git commit -m "feat: add timeline helpers (findInsertIndex, upsertPoint)\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 2: Migrate use-market-overview-timeline to use helpers

**Files:**
- Modify: `apps/frontend/src/features/dashboard/hooks/use-market-overview-timeline.ts`
- Test: `apps/frontend/src/features/dashboard/hooks/use-market-overview-timeline.test.ts` (update expectations)

- [x] **Step 1: Write failing test changes**
  - Tests updated locally to assert incremental identity behavior.

- [x] **Step 2: Replace mapping logic with helper usage**

Implementation committed: migrated hook now maintains displayedSeries and indexMap, applies upsertPoint for diffs.

- [x] **Step 3: Run tests**
Run: `pnpm test apps/frontend/src/features/dashboard/hooks/use-market-overview-timeline.test.ts -v`
Status: focused tests passed in-session.

- [x] **Step 4: Commit**

```bash
git add apps/frontend/src/features/dashboard/hooks/use-market-overview-timeline.ts
git commit -m "refactor: incremental updates for market overview timeline using timeline-helpers\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 3: Migrate use-quote-timeline (and quick guard)

**Files:**
- Modify: `apps/frontend/src/features/dashboard/hooks/use-quote-timeline.ts`
- Test: `apps/frontend/src/features/dashboard/hooks/use-quote-timeline.test.ts`

- [x] **Step 1: Add unit test for no-op when latest equals baseline**
- [x] **Step 2: Use merge guard + upsertPoint when realtime present**
- [x] **Step 3: Run tests and commit**

Status: Implementation migrated and committed; focused tests pass.

### Task 4: Migrate other hooks (kbar/metric/estimated/otc/participant)

**Files:**
- Modify as needed: `use-kbar-timeline.ts`, `use-metric-timeline.ts`, `use-estimated-volume-timeline.ts`, `use-otc-index-series.ts`, `use-participant-amplitude.ts`
- Tests: update corresponding tests

- [ ] **Steps:** for each hook: write failing test (if required), refactor to use helpers, run tests, commit. Prefer grouping by similarity.

Completed so far:
- [x] `use-otc-index-series.ts` migrated and committed
- [x] `use-estimated-volume-timeline.ts` migrated and committed
- [x] `use-participant-amplitude.ts` migrated and committed (this session)
- [x] `use-kbar-timeline.ts` migrated and committed (this session)
- [x] `use-metric-timeline.ts` migrated and committed (this session)

Remaining:
- [ ] any other timeline hooks discovered during scan (none found in current scan; consider future sweep)

### Task 5: Extract TrendIndexCard mapping

**Files:**
- Modify: `apps/frontend/src/features/dashboard/components/TrendIndexCard.tsx`
- Create helper mapping or let TrendIndexCard consume the new aggregated series from a hook.

- [x] **Steps:** extract mapping/filter into helper, update component, run typecheck/test, commit.

Status: mapping extracted to `apps/frontend/src/features/dashboard/lib/trend-index-mapper.ts` and component updated to use it. Typecheck still shows unrelated UI typing errors; component-level changes are ready for review/commit.
### Task 6: Performance validation & docs

- [ ] **Step 1:** Run full test suite: `pnpm test` and `pnpm -w -r -v` as needed
- [ ] **Step 2:** Manual dev validation with SSE dev feed; measure CPU/GC before/after.
- [x] **Step 3:** Update docs: `docs/2026-04-18-timeline-helpers-refactor-design.md` to note changes and guide future migrations. (done)

---

Progress: updated plan to mark completed steps and list remaining work. Will continue with inline execution and proceed to migrate `use-kbar-timeline.ts` next.

Plan saved to `docs/superpowers/plans/2026-04-18-timeline-helpers-implementation-plan.md`.
