Title: Timeline Helpers Refactor — design
Date: 2026-04-18
Author: Copilot

Summary
- Introduce a shared timeline-helpers module to unify baseline+realtime -> displayed series logic across dashboard hooks and TrendIndexCard. Goals: minimal allocations on realtime updates, single-source-of-truth maps, predictable immutability for React, and optional downsampling/windowing.

Problems addressed
- Multiple hooks duplicate merge/append/insert logic and often rebuild entire series from maps on each realtime patch.
- Unnecessary object/array allocations cause GC/CPU churn and extra chart re-renders.

Core API (timeline-helpers.ts)
- findInsertIndex<T extends { minuteTs:number }>(series: T[], minuteTs: number): number
- upsertPoint<T extends { minuteTs:number }>(series: T[], indexMap: Map<number, number>, point: T): { nextSeries: T[]; nextIndexMap: Map<number, number>; didChange: boolean }
- buildSeriesFromMaps(indexPriceByMinuteTs: Record<number, number>, extraMaps?: Record<string, Record<number, number>>, formatter?): OrderFlowSeriesPoint[]
- mergeLatestIntoMaps(baseMaps, latestPayload): { changed: boolean; nextMaps }
- downsampleSeries<T>(series: T[], options): T[] (optional)

Implementation plan (tasks)
1. Add apps/frontend/src/features/dashboard/lib/timeline-helpers.ts with implementations + unit tests (helpers.test.ts).
2. Migrate use-market-overview-timeline to use helpers (baseline build once; incremental upsert on map diffs).
3. Migrate use-quote-timeline to use helpers (or at minimum use helper's merge guard and upsert).
4. Migrate use-kbar-timeline and use-metric-timeline (they already use latest hooks) to rely on helpers where applicable.
5. Extract TrendIndexCard mapping/filter to use helpers (mapSeriesItemsToChartPoints) or consume aggregated series hook.
6. Migrate other timeline-like hooks (estimated-volume, otc-index, participant-amplitude) as time permits.

Testing & Validation
- Unit tests for helpers: insert/replace/append/no-op/downsample.
- Hook tests: existing tests updated to verify minimal-change behavior (no-op when same value, append/replace when changed).
- Manual smoke: run dev, start SSE dev feed, confirm charts update smoothly and CPU/GC improves.

Migration order (priority)
1. market-overview
2. quote
3. kbar/metric
4. estimated-volume
5. otc-index / participant
6. trend-index card

Acceptance criteria
- No behavioral changes in charts (values identical to baseline behavior).
- Reduced full-series rebuilds on high-frequency identical-value SSE (unit-testable via hooks tests and observable in dev). 
- Test suite passes.

Rollback plan
- Each hook migration is a small PR; if regression found, revert that PR. Keep realtime store and SSE manager untouched.

Next step (on approval)
- Implement timeline-helpers.ts and helper unit tests, then start migrating use-market-overview-timeline.

Notes
- Keep helpers small, well-documented, and thoroughly tested.
- Provide a light downsampling function but leave aggressive sampling for later.

