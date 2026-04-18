# Timeline Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a shared timeline-helpers module and migrate dashboard hooks/components to use incremental, minimal-copy updates for baseline+realtime timelines to reduce CPU/GC and chart re-renders.

**Architecture:** Add a small library `timeline-helpers.ts` providing fast insert/replace (binary search + index map) and merge guards; migrate hooks to consume it. Keep source-of-truth minute->value maps and maintain a displayedSeries state for charts.

**Tech Stack:** TypeScript, React hooks, Jest/react-testing-library tests, Recharts

---

### Task 1: Create timeline-helpers.ts (core helpers)

**Files:**
- Create: `apps/frontend/src/features/dashboard/lib/timeline-helpers.ts`
- Test: `apps/frontend/src/features/dashboard/lib/timeline-helpers.test.ts`

- [ ] **Step 1: Write failing tests for findInsertIndex & upsertPoint**

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

- [ ] **Step 2: Run test to see failures**

Run:
```
pnpm test apps/frontend/src/features/dashboard/lib/timeline-helpers.test.ts -v
```
Expected: FAIL because implementation missing

- [ ] **Step 3: Implement timeline-helpers.ts**

```ts
// apps/frontend/src/features/dashboard/lib/timeline-helpers.ts
export function findInsertIndex<T extends { minuteTs: number }>(series: T[], minuteTs: number): number {
  let lo = 0;
  let hi = series.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].minuteTs < minuteTs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function upsertPoint<T extends { minuteTs: number }>(
  series: T[],
  indexMap: Map<number, number>,
  point: T,
): { nextSeries: T[]; nextIndexMap: Map<number, number>; didChange: boolean } {
  const minuteTs = point.minuteTs;
  const existingIndex = indexMap.get(minuteTs);
  if (typeof existingIndex === 'number') {
    const existing = series[existingIndex];
    // shallow compare fields (assume same shape)
    if (JSON.stringify(existing) === JSON.stringify(point)) {
      return { nextSeries: series, nextIndexMap: new Map(indexMap), didChange: false };
    }
    const next = series.slice();
    next[existingIndex] = point;
    const nextMap = new Map(indexMap);
    return { nextSeries: next, nextIndexMap: nextMap, didChange: true };
  }

  // append or insert
  const insertAt = findInsertIndex(series, minuteTs);
  const nextSeries = [...series.slice(0, insertAt), point, ...series.slice(insertAt)];
  const nextIndexMap = new Map<number, number>();
  for (let i = 0; i < nextSeries.length; i++) nextIndexMap.set(nextSeries[i].minuteTs, i);
  return { nextSeries, nextIndexMap, didChange: true };
}
```

- [ ] **Step 4: Run tests and ensure they pass**

Run:
```
pnpm test apps/frontend/src/features/dashboard/lib/timeline-helpers.test.ts -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/dashboard/lib/timeline-helpers.ts apps/frontend/src/features/dashboard/lib/timeline-helpers.test.ts
git commit -m "feat: add timeline helpers (findInsertIndex, upsertPoint)\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 2: Migrate use-market-overview-timeline to use helpers

**Files:**
- Modify: `apps/frontend/src/features/dashboard/hooks/use-market-overview-timeline.ts`
- Test: `apps/frontend/src/features/dashboard/hooks/use-market-overview-timeline.test.ts` (update expectations)

- [ ] **Step 1: Write failing test changes**
  - Update tests to assert that series is correctly appended/replaced (reuse existing test harness but add a case where only one minute changes and expect series array identity change limited)

- [ ] **Step 2: Replace mapping logic with helper usage**

Replace the current full rebuild useMemo with logic:
1. On baseline load, build full series via existing mapper.
2. Maintain indexMap in ref and series state.
3. On map diffs, compute changed minute keys (as before), call upsertPoint for each changed minute.

- [ ] **Step 3: Run tests**
Run: `pnpm test apps/frontend/src/features/dashboard/hooks/use-market-overview-timeline.test.ts -v`

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/src/features/dashboard/hooks/use-market-overview-timeline.ts
git commit -m "refactor: incremental updates for market overview timeline using timeline-helpers\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 3: Migrate use-quote-timeline (and quick guard)

**Files:**
- Modify: `apps/frontend/src/features/dashboard/hooks/use-quote-timeline.ts`
- Test: `apps/frontend/src/features/dashboard/hooks/use-quote-timeline.test.ts`

- [ ] **Step 1: Add unit test for no-op when latest equals baseline**
- [ ] **Step 2: Use merge guard + upsertPoint when realtime present**
- [ ] **Step 3: Run tests and commit**

### Task 4: Migrate other hooks (kbar/metric/estimated/otc/participant)

**Files:**
- Modify as needed: `use-kbar-timeline.ts`, `use-metric-timeline.ts`, `use-estimated-volume-timeline.ts`, `use-otc-index-series.ts`, `use-participant-amplitude.ts`
- Tests: update corresponding tests

- [ ] **Steps:** for each hook: write failing test (if required), refactor to use helpers, run tests, commit. Prefer grouping by similarity.

### Task 5: Extract TrendIndexCard mapping

**Files:**
- Modify: `apps/frontend/src/features/dashboard/components/TrendIndexCard.tsx`
- Create helper mapping or let TrendIndexCard consume the new aggregated series from a hook.

- [ ] **Steps:** extract mapping/filter into helper, update component, run typecheck/test, commit.

### Task 6: Performance validation & docs

- [ ] **Step 1:** Run full test suite: `pnpm test` and `pnpm -w -r -v` as needed
- [ ] **Step 2:** Manual dev validation with SSE dev feed; measure CPU/GC before/after.
- [ ] **Step 3:** Update docs: `docs/2026-04-18-timeline-helpers-refactor-design.md` to note changes and guide future migrations.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-18-timeline-helpers-implementation-plan.md`.

Execution options:
1. Subagent-Driven (recommended) — dispatch subagents per task for implementation and review.
2. Inline Execution — run tasks sequentially in this session.

Which approach to use? (reply with "subagent" or "inline")
