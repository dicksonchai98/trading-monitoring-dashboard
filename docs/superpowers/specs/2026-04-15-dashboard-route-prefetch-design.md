# Dashboard route prefetch design

## Problem

The `/dashboard` page currently starts several independent API requests only after the route mounts. Even though the app shell already provides a route transition skeleton, users still pay the full cost of the dashboard's concurrent baseline requests after navigation, which makes this route feel heavier than the rest of the app.

## Goal

Reduce perceived and actual dashboard entry latency by prewarming the dashboard's heaviest read queries before the route renders, while preserving the existing React Router + React Query + realtime patch architecture.

## Scope

In scope:
- `/dashboard` route only
- React Query-backed prefetch for the dashboard's first-screen baseline data
- Three trigger points: post-bootstrap/login warmup, navigation hover/focus warmup, and click-time ensure
- Updating dashboard hooks to consume prefetched cache before applying realtime patches

Out of scope:
- Extending the same mechanism to other routes in this change
- Converting the dashboard to a loader-first React Router architecture
- Reworking realtime SSE subscriptions or access-control behavior

## Current state

`apps/frontend/src/features/dashboard/components/RealtimeDashboardOverview.tsx` assembles the page from several hooks:

- `useMarketOverviewTimeline()`
- `useQuoteTimeline()`
- `useParticipantAmplitude()`
- `useEstimatedVolumeTimeline()`

Those hooks currently use local `useEffect + useState` fetch flows or depend on other hooks that do, which means:

1. dashboard baseline requests only begin after route mount
2. related hooks can request overlapping baseline data through separate paths
3. there is no single route-level prefetch entry point for `/dashboard`

## Proposed approach

Use a **dashboard-specific query contract + shell-triggered prefetch** approach.

### 1. Dashboard query contract

Introduce a dedicated dashboard data layer for first-screen baseline data. This layer should define:

- stable query keys
- query option builders
- a `prefetchDashboardRouteData(queryClient, authState)` helper

The initial contract should cover the highest-value dashboard baselines:

1. **order flow baseline**
   - wraps `getOrderFlowBaseline()`
   - shared by the market overview timeline and participant-related baseline consumers

2. **quote today**
   - wraps `getQuoteToday()`
   - used by the quote timeline

3. **estimated volume baseline**
   - wraps `getEstimatedVolumeBaseline()`
   - used by the estimated volume timeline

4. **daily amplitude history**
   - wraps `getDailyAmplitudeHistory()`
   - combined with the cached order flow baseline for participant amplitude

The goal is not to convert every dashboard hook to raw `useQuery` immediately. The goal is to create a single, reusable cache contract for the route's most expensive shared reads.

### 2. Prefetch triggers

Prefetch should happen in three layers, with increasing certainty as the user gets closer to entering the dashboard:

1. **Post-bootstrap or post-login warmup**
   - once auth is resolved and the user can access `/dashboard`, prewarm dashboard route data in the background

2. **Navigation hover/focus warmup**
   - when the dashboard nav item is hovered or focused, trigger another prefetch pass if the cache is missing or stale

3. **Click-time ensure**
   - before performing dashboard navigation through `ShellNavigationContext`, run a stronger ensure step so navigation benefits from the warm cache when the route renders

This keeps the existing shell transition UX intact while reducing the chance that dashboard requests only start after the route is already visible.

### 3. Dashboard hook integration

The affected dashboard hooks should be updated to prefer React Query cache-backed baseline data instead of issuing their own mount-time baseline requests. Realtime hooks remain responsible for incremental patching on top of the cached baseline.

Expected hook behavior after the change:

- baseline data comes from the shared dashboard query contract
- realtime updates still patch derived state locally
- if prefetch did not run or failed, the page still loads correctly by fetching on demand through the same query contract

## Data flow

The resulting `/dashboard` data flow should be:

1. shell or auth flow triggers `prefetchDashboardRouteData(...)`
2. baseline dashboard queries enter the shared React Query cache
3. dashboard hooks read from that cache on route render
4. realtime hooks apply live updates on top of the baseline data already in memory

This preserves the current architecture boundary:

- **prefetch layer**: decides when to warm data
- **query contract layer**: defines what dashboard baseline data exists and how it is cached
- **dashboard hooks/components**: consume baseline data and merge realtime updates for rendering

## Error handling

- Prefetch failures must not block navigation
- Prefetch failures must not emit new user-facing toast noise
- Existing dashboard loading and error UI remains the source of truth after route entry
- Visitor or unauthenticated sessions must not issue token-required member baseline requests

## File targets

Likely touch points:

- `apps/frontend/src/features/dashboard/api/market-overview.ts`
- new dashboard query/prefetch module(s) under `apps/frontend/src/features/dashboard/`
- `apps/frontend/src/features/dashboard/hooks/use-order-flow-baseline.ts`
- `apps/frontend/src/features/dashboard/hooks/use-quote-timeline.ts`
- `apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.ts`
- `apps/frontend/src/features/dashboard/hooks/use-estimated-volume-timeline.ts`
- `apps/frontend/src/app/navigation/ShellNavigationContext.tsx`
- dashboard navigation link renderers in the app shell/sidebar

## Testing strategy

Add or update tests to cover:

1. dashboard prefetch helper warming the expected queries
2. auth/role gating preventing invalid member-only prefetches
3. dashboard hooks consuming cached baseline data correctly
4. shell navigation triggering dashboard prefetch without regressing normal route navigation behavior

## Success criteria

The change is successful when `/dashboard` no longer relies on route mount as the first moment its heaviest baseline API requests can start, and entering the route consistently benefits from warmed React Query cache without changing existing dashboard functionality.
