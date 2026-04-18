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

Implemented helpers (status)
- timeline-helpers.ts implemented with findInsertIndex and upsertPoint and unit tests (passed focused tests).

Files created/modified during implementation
- apps/frontend/src/features/dashboard/lib/timeline-helpers.ts (core helpers)
- apps/frontend/src/features/dashboard/lib/timeline-helpers.test.ts (unit tests)
- apps/frontend/src/features/dashboard/hooks/use-market-overview-timeline.ts (migrated)
- apps/frontend/src/features/dashboard/hooks/use-quote-timeline.ts (migrated)
- apps/frontend/src/features/dashboard/hooks/use-otc-index-series.ts (migrated)
- apps/frontend/src/features/dashboard/hooks/use-estimated-volume-timeline.ts (migrated)
- apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.ts (migrated)
- apps/frontend/src/features/dashboard/hooks/use-kbar-timeline.ts (migrated)
- apps/frontend/src/features/dashboard/hooks/use-metric-timeline.ts (migrated)
- apps/frontend/src/features/dashboard/lib/trend-index-mapper.ts (new helper)
- apps/frontend/src/features/dashboard/components/TrendIndexCard.tsx (updated to use helper)

Implementation plan (tasks)
1. Add apps/frontend/src/features/dashboard/lib/timeline-helpers.ts with implementations + unit tests (helpers.test.ts).
2. Migrate use-market-overview-timeline to use helpers (baseline build once; incremental upsert on map diffs).
3. Migrate use-quote-timeline to use helpers (or at minimum use helper's merge guard and upsert).
4. Migrate use-kbar-timeline and use-metric-timeline (they already use latest hooks) to rely on helpers where applicable.
5. Extract TrendIndexCard mapping/filter to use helpers (mapSeriesItemsToChartPoints) or consume aggregated series hook.
6. Migrate other timeline-like hooks (estimated-volume, otc-index, participant-amplitude) as time permits.

Testing & Validation (status)
- Unit tests for helpers: focused tests for timeline-helpers passed.
- Hook tests: focused tests for migrated hooks ran where available; many hooks do not have dedicated tests and should be added incrementally.
- Full repo typecheck shows unrelated UI typing issues; these pre-existed and should be addressed separately before a full `pnpm test`/CI run will pass.

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
- Test suite passes (blocked currently by unrelated UI typing errors).

Rollback plan
- Each hook migration is a small PR; if regression found, revert that PR. Keep realtime store and SSE manager untouched.

Next steps (current)
- Finish migrating remaining timeline-like hooks (none discovered in a quick scan beyond those migrated).
- Add focused unit tests for each migrated hook to assert append/replace/no-op behavior.
- Run manual SSE dev feed validation and measure CPU/GC before/after.
- Address full-repo TypeScript/UI typing errors separately; defer to a targeted follow-up.
- Update docs and PR descriptions; create PRs per migration.

Notes
- Keep helpers small, well-documented, and thoroughly tested.
- Provide a light downsampling function but leave aggressive sampling for later.

