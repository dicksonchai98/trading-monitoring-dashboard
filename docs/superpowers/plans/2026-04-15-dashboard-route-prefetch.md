# Dashboard Route Prefetch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add React Router-aware prefetch for `/dashboard` so its heaviest baseline API reads can be warmed before route render and then consumed from React Query cache.

**Architecture:** Introduce a dashboard-specific query contract for first-screen baseline data, add a route-prefetch helper that respects auth gating, and trigger that helper from bootstrap plus shell navigation affordances. Keep realtime behavior unchanged by letting dashboard hooks read prefetched baselines from React Query and continue applying incremental SSE patches locally.

**Tech Stack:** React 19, TypeScript, TanStack React Query v5, React Router, Zustand, Vite, Vitest

---

## File map

- `apps/frontend/src/features/dashboard/lib/query-keys.ts` — stable query keys for prefetched dashboard baselines
- `apps/frontend/src/features/dashboard/lib/query-keys.test.ts` — unit tests for dashboard query key shapes
- `apps/frontend/src/features/dashboard/lib/dashboard-queries.ts` — React Query option builders for dashboard baseline data
- `apps/frontend/src/features/dashboard/lib/dashboard-route-prefetch.ts` — `prefetchDashboardRouteData()` auth gating and query warming orchestration
- `apps/frontend/src/features/dashboard/lib/dashboard-route-prefetch.test.ts` — prefetch helper tests, including visitor/no-token no-op behavior
- `apps/frontend/src/app/DashboardPrefetchBootstrap.tsx` — post-bootstrap/login background warmup trigger
- `apps/frontend/src/app/DashboardPrefetchBootstrap.test.tsx` — verifies resolved member sessions warm `/dashboard`, visitor sessions do not
- `apps/frontend/src/app/providers.tsx` — mount the dashboard prefetch bootstrap next to existing session/realtime bootstrap components
- `apps/frontend/src/features/dashboard/hooks/use-order-flow-baseline.ts` — switch baseline load to shared React Query cache
- `apps/frontend/src/features/dashboard/hooks/use-quote-timeline.ts` — consume cached `quote today` baseline before realtime patching
- `apps/frontend/src/features/dashboard/hooks/use-estimated-volume-timeline.ts` — consume cached estimated volume baseline before realtime patching
- `apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.ts` — consume cached daily amplitude + order-flow baseline before realtime patching
- `apps/frontend/src/features/dashboard/hooks/use-market-overview-timeline.test.tsx` — regression coverage for cached order-flow baseline
- `apps/frontend/src/features/dashboard/hooks/use-estimated-volume-timeline.test.tsx` — regression coverage for cached estimated-volume baseline
- `apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.test.tsx` — regression coverage for participant amplitude from shared cache
- `apps/frontend/src/app/navigation/ShellNavigationContext.tsx` — add optional async pre-navigation prefetch support
- `apps/frontend/src/components/nav-main.tsx` — trigger dashboard hover/focus/click prefetch from sidebar links
- `apps/frontend/src/app/layout/AppShell.tsx` — trigger dashboard breadcrumb click prefetch
- `apps/frontend/src/app/layout/AppShell.test.tsx` — verify shell navigation still works and dashboard links prefetch

## Task 1: Create the shared dashboard query contract

**Files:**
- Create: `apps/frontend/src/features/dashboard/lib/query-keys.ts`
- Create: `apps/frontend/src/features/dashboard/lib/query-keys.test.ts`
- Create: `apps/frontend/src/features/dashboard/lib/dashboard-queries.ts`
- Create: `apps/frontend/src/features/dashboard/lib/dashboard-route-prefetch.ts`
- Create: `apps/frontend/src/features/dashboard/lib/dashboard-route-prefetch.test.ts`

- [ ] **Step 1: Write the failing query key and prefetch tests**

```ts
import { QueryClient } from "@tanstack/react-query";
import {
  buildDashboardDailyAmplitudeQueryKey,
  buildDashboardEstimatedVolumeBaselineQueryKey,
  buildDashboardOrderFlowBaselineQueryKey,
  buildDashboardQuoteTodayQueryKey,
} from "@/features/dashboard/lib/query-keys";
import { prefetchDashboardRouteData } from "@/features/dashboard/lib/dashboard-route-prefetch";

it("builds stable dashboard query keys from code and history length", () => {
  expect(buildDashboardOrderFlowBaselineQueryKey("TXFD6")).toEqual([
    "dashboard-order-flow-baseline",
    { code: "TXFD6" },
  ]);
  expect(buildDashboardQuoteTodayQueryKey("TXFD6")).toEqual([
    "dashboard-quote-today",
    { code: "TXFD6" },
  ]);
  expect(buildDashboardEstimatedVolumeBaselineQueryKey("TXFD6")).toEqual([
    "dashboard-estimated-volume-baseline",
    { code: "TXFD6" },
  ]);
  expect(buildDashboardDailyAmplitudeQueryKey("TXFD6", 19)).toEqual([
    "dashboard-daily-amplitude-history",
    { code: "TXFD6", historyLength: 19 },
  ]);
});

it("prefetches all dashboard baseline queries for a resolved member session", async () => {
  const queryClient = new QueryClient();
  const prefetchQuery = vi.spyOn(queryClient, "prefetchQuery").mockResolvedValue(undefined);

  await prefetchDashboardRouteData(queryClient, {
    resolved: true,
    token: "token",
    role: "member",
    code: "TXFD6",
  });

  expect(prefetchQuery).toHaveBeenCalledTimes(4);
});

it("skips dashboard baseline prefetch for visitor sessions", async () => {
  const queryClient = new QueryClient();
  const prefetchQuery = vi.spyOn(queryClient, "prefetchQuery").mockResolvedValue(undefined);

  await prefetchDashboardRouteData(queryClient, {
    resolved: true,
    token: null,
    role: "visitor",
    code: "TXFD6",
  });

  expect(prefetchQuery).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused tests to confirm they fail**

Run:

```bash
cd apps/frontend
npm run test -- src/features/dashboard/lib/query-keys.test.ts src/features/dashboard/lib/dashboard-route-prefetch.test.ts
```

Expected: FAIL because the query key and prefetch modules do not exist yet.

- [ ] **Step 3: Add the minimal query contract and route prefetch implementation**

`apps/frontend/src/features/dashboard/lib/query-keys.ts`

```ts
export function buildDashboardOrderFlowBaselineQueryKey(code: string) {
  return ["dashboard-order-flow-baseline", { code }] as const;
}

export function buildDashboardQuoteTodayQueryKey(code: string) {
  return ["dashboard-quote-today", { code }] as const;
}

export function buildDashboardEstimatedVolumeBaselineQueryKey(code: string) {
  return ["dashboard-estimated-volume-baseline", { code }] as const;
}

export function buildDashboardDailyAmplitudeQueryKey(
  code: string,
  historyLength: number,
) {
  return ["dashboard-daily-amplitude-history", { code, historyLength }] as const;
}
```

`apps/frontend/src/features/dashboard/lib/dashboard-queries.ts`

```ts
import { queryOptions } from "@tanstack/react-query";
import {
  DEFAULT_ORDER_FLOW_CODE,
  getDailyAmplitudeHistory,
  getEstimatedVolumeBaseline,
  getOrderFlowBaseline,
  getQuoteToday,
} from "@/features/dashboard/api/market-overview";
import {
  buildDashboardDailyAmplitudeQueryKey,
  buildDashboardEstimatedVolumeBaselineQueryKey,
  buildDashboardOrderFlowBaselineQueryKey,
  buildDashboardQuoteTodayQueryKey,
} from "@/features/dashboard/lib/query-keys";

export function dashboardOrderFlowBaselineQueryOptions(token: string, code = DEFAULT_ORDER_FLOW_CODE) {
  return queryOptions({
    queryKey: buildDashboardOrderFlowBaselineQueryKey(code),
    queryFn: ({ signal }) => getOrderFlowBaseline(token, code, signal),
  });
}

export function dashboardQuoteTodayQueryOptions(token: string, code = DEFAULT_ORDER_FLOW_CODE) {
  return queryOptions({
    queryKey: buildDashboardQuoteTodayQueryKey(code),
    queryFn: ({ signal }) => getQuoteToday(token, code, signal),
  });
}

export function dashboardEstimatedVolumeBaselineQueryOptions(
  token: string,
  code = DEFAULT_ORDER_FLOW_CODE,
) {
  return queryOptions({
    queryKey: buildDashboardEstimatedVolumeBaselineQueryKey(code),
    queryFn: ({ signal }) => getEstimatedVolumeBaseline(token, code, signal),
  });
}

export function dashboardDailyAmplitudeQueryOptions(
  token: string,
  code = DEFAULT_ORDER_FLOW_CODE,
  historyLength = 19,
) {
  return queryOptions({
    queryKey: buildDashboardDailyAmplitudeQueryKey(code, historyLength),
    queryFn: ({ signal }) => getDailyAmplitudeHistory(token, code, historyLength, signal),
  });
}
```

`apps/frontend/src/features/dashboard/lib/dashboard-route-prefetch.ts`

```ts
import type { QueryClient } from "@tanstack/react-query";
import { DEFAULT_ORDER_FLOW_CODE } from "@/features/dashboard/api/market-overview";
import {
  dashboardDailyAmplitudeQueryOptions,
  dashboardEstimatedVolumeBaselineQueryOptions,
  dashboardOrderFlowBaselineQueryOptions,
  dashboardQuoteTodayQueryOptions,
} from "@/features/dashboard/lib/dashboard-queries";
import type { UserRole } from "@/lib/types/auth";

export interface DashboardPrefetchInput {
  resolved: boolean;
  token: string | null;
  role: UserRole;
  code?: string;
}

export async function prefetchDashboardRouteData(
  queryClient: QueryClient,
  input: DashboardPrefetchInput,
): Promise<void> {
  if (!input.resolved || !input.token || input.role === "visitor") {
    return;
  }

  const code = input.code ?? DEFAULT_ORDER_FLOW_CODE;

  await Promise.allSettled([
    queryClient.prefetchQuery(dashboardOrderFlowBaselineQueryOptions(input.token, code)),
    queryClient.prefetchQuery(dashboardQuoteTodayQueryOptions(input.token, code)),
    queryClient.prefetchQuery(dashboardEstimatedVolumeBaselineQueryOptions(input.token, code)),
    queryClient.prefetchQuery(dashboardDailyAmplitudeQueryOptions(input.token, code, 19)),
  ]);
}
```

- [ ] **Step 4: Run the focused query contract tests**

Run:

```bash
cd apps/frontend
npm run test -- src/features/dashboard/lib/query-keys.test.ts src/features/dashboard/lib/dashboard-route-prefetch.test.ts
```

Expected: PASS with stable key assertions and visitor/member prefetch behavior covered.

- [ ] **Step 5: Commit the query contract**

```bash
git add apps/frontend/src/features/dashboard/lib/query-keys.ts apps/frontend/src/features/dashboard/lib/query-keys.test.ts apps/frontend/src/features/dashboard/lib/dashboard-queries.ts apps/frontend/src/features/dashboard/lib/dashboard-route-prefetch.ts apps/frontend/src/features/dashboard/lib/dashboard-route-prefetch.test.ts
git commit -m "feat: add dashboard route prefetch contract"
```

## Task 2: Add post-bootstrap dashboard warmup

**Files:**
- Create: `apps/frontend/src/app/DashboardPrefetchBootstrap.tsx`
- Create: `apps/frontend/src/app/DashboardPrefetchBootstrap.test.tsx`
- Modify: `apps/frontend/src/app/providers.tsx`

- [ ] **Step 1: Write the failing bootstrap prefetch tests**

```ts
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DashboardPrefetchBootstrap } from "@/app/DashboardPrefetchBootstrap";
import { prefetchDashboardRouteData } from "@/features/dashboard/lib/dashboard-route-prefetch";
import { useAuthStore } from "@/lib/store/auth-store";

vi.mock("@/features/dashboard/lib/dashboard-route-prefetch", () => ({
  prefetchDashboardRouteData: vi.fn(),
}));

it("warms dashboard data after auth resolves for a member session", async () => {
  const queryClient = new QueryClient();
  const prefetchMock = vi.mocked(prefetchDashboardRouteData);
  useAuthStore.setState({
    token: "token",
    role: "member",
    entitlement: "active",
    resolved: true,
    checkoutSessionId: null,
  });

  render(
    <QueryClientProvider client={queryClient}>
      <DashboardPrefetchBootstrap />
    </QueryClientProvider>,
  );

  await waitFor(() =>
    expect(prefetchMock).toHaveBeenCalledWith(
      queryClient,
      expect.objectContaining({ resolved: true, token: "token", role: "member" }),
    ),
  );
});

it("does not warm dashboard data for a visitor session", async () => {
  const queryClient = new QueryClient();
  const prefetchMock = vi.mocked(prefetchDashboardRouteData);
  useAuthStore.setState({
    token: null,
    role: "visitor",
    entitlement: "none",
    resolved: true,
    checkoutSessionId: null,
  });

  render(
    <QueryClientProvider client={queryClient}>
      <DashboardPrefetchBootstrap />
    </QueryClientProvider>,
  );

  await waitFor(() => expect(prefetchMock).not.toHaveBeenCalled());
});
```

- [ ] **Step 2: Run the bootstrap test to confirm it fails**

Run:

```bash
cd apps/frontend
npm run test -- src/app/DashboardPrefetchBootstrap.test.tsx
```

Expected: FAIL because the bootstrap component does not exist and providers do not mount it.

- [ ] **Step 3: Add the bootstrap component and mount it**

`apps/frontend/src/app/DashboardPrefetchBootstrap.tsx`

```ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { prefetchDashboardRouteData } from "@/features/dashboard/lib/dashboard-route-prefetch";
import { useAuthStore } from "@/lib/store/auth-store";

export function DashboardPrefetchBootstrap(): null {
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const resolved = useAuthStore((state) => state.resolved);
  const role = useAuthStore((state) => state.role);

  useEffect(() => {
    void prefetchDashboardRouteData(queryClient, {
      resolved,
      token,
      role,
    });
  }, [queryClient, resolved, role, token]);

  return null;
}
```

`apps/frontend/src/app/providers.tsx`

```ts
import { DashboardPrefetchBootstrap } from "@/app/DashboardPrefetchBootstrap";

export function AppProviders({ children }: PropsWithChildren): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <SessionBootstrap>
          <DashboardPrefetchBootstrap />
          <RealtimeBootstrap />
          {children}
          <Toaster />
        </SessionBootstrap>
      </I18nProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 4: Run the bootstrap test again**

Run:

```bash
cd apps/frontend
npm run test -- src/app/DashboardPrefetchBootstrap.test.tsx
```

Expected: PASS with one member warmup path and one visitor no-op path.

- [ ] **Step 5: Commit the bootstrap warmup**

```bash
git add apps/frontend/src/app/DashboardPrefetchBootstrap.tsx apps/frontend/src/app/DashboardPrefetchBootstrap.test.tsx apps/frontend/src/app/providers.tsx
git commit -m "feat: warm dashboard cache after auth bootstrap"
```

## Task 3: Move dashboard baseline hooks onto the shared cache contract

**Files:**
- Modify: `apps/frontend/src/features/dashboard/hooks/use-order-flow-baseline.ts`
- Modify: `apps/frontend/src/features/dashboard/hooks/use-quote-timeline.ts`
- Modify: `apps/frontend/src/features/dashboard/hooks/use-estimated-volume-timeline.ts`
- Modify: `apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.ts`
- Modify: `apps/frontend/src/features/dashboard/hooks/use-market-overview-timeline.test.tsx`
- Modify: `apps/frontend/src/features/dashboard/hooks/use-estimated-volume-timeline.test.tsx`
- Modify: `apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.test.tsx`

- [ ] **Step 1: Extend the failing hook tests to assert React Query cache-backed loading**

Add these assertions before the existing realtime-patch checks:

```ts
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

it("reads the order-flow baseline through the shared query cache", async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useMarketOverviewTimeline(), { wrapper });

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(queryClient.getQueryData(["dashboard-order-flow-baseline", { code: "TXFD6" }])).toEqual(
    expect.objectContaining({
      kbarToday: expect.any(Array),
      metricToday: expect.any(Array),
    }),
  );
});
```

Do the same pattern for:

```ts
["dashboard-estimated-volume-baseline", { code: "TXFD6" }]
["dashboard-daily-amplitude-history", { code: "TXFD6", historyLength: 19 }]
```

- [ ] **Step 2: Run the hook tests to confirm they fail**

Run:

```bash
cd apps/frontend
npm run test -- src/features/dashboard/hooks/use-market-overview-timeline.test.tsx src/features/dashboard/hooks/use-estimated-volume-timeline.test.tsx src/features/dashboard/hooks/use-participant-amplitude.test.tsx
```

Expected: FAIL because the hooks do not require a `QueryClientProvider` and do not populate/read the new cache keys yet.

- [ ] **Step 3: Refactor the baseline hooks to use the shared query options**

`apps/frontend/src/features/dashboard/hooks/use-order-flow-baseline.ts`

```ts
import { useQuery } from "@tanstack/react-query";
import { dashboardOrderFlowBaselineQueryOptions } from "@/features/dashboard/lib/dashboard-queries";

export function useOrderFlowBaseline(
  code: string = DEFAULT_ORDER_FLOW_CODE,
): UseOrderFlowBaselineResult {
  const token = useAuthStore((state) => state.token);
  const resolved = useAuthStore((state) => state.resolved);
  const role = useAuthStore((state) => state.role);

  const query = useQuery({
    ...dashboardOrderFlowBaselineQueryOptions(token ?? "", code),
    enabled: resolved && Boolean(token) && role !== "visitor",
  });

  return {
    kbarToday: query.data?.kbarToday ?? [],
    metricToday: query.data?.metricToday ?? [],
    loading: !resolved ? true : query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    baselineReady: Boolean(query.data),
  };
}
```

`apps/frontend/src/features/dashboard/hooks/use-quote-timeline.ts`

```ts
import { useQuery } from "@tanstack/react-query";
import { dashboardQuoteTodayQueryOptions } from "@/features/dashboard/lib/dashboard-queries";

const baselineQuery = useQuery({
  ...dashboardQuoteTodayQueryOptions(token ?? "", code),
  enabled: resolved && Boolean(token) && role !== "visitor",
});
```

`apps/frontend/src/features/dashboard/hooks/use-estimated-volume-timeline.ts`

```ts
import { useQuery } from "@tanstack/react-query";
import { dashboardEstimatedVolumeBaselineQueryOptions } from "@/features/dashboard/lib/dashboard-queries";

const baselineQuery = useQuery({
  ...dashboardEstimatedVolumeBaselineQueryOptions(token ?? "", DEFAULT_ORDER_FLOW_CODE),
  enabled: resolved && Boolean(token) && role !== "visitor",
});
```

`apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.ts`

```ts
import { useQuery } from "@tanstack/react-query";
import {
  dashboardDailyAmplitudeQueryOptions,
  dashboardOrderFlowBaselineQueryOptions,
} from "@/features/dashboard/lib/dashboard-queries";

const dailyAmplitudeQuery = useQuery({
  ...dashboardDailyAmplitudeQueryOptions(token ?? "", code, 19),
  enabled: resolved && Boolean(token) && role !== "visitor",
});

const baselineQuery = useQuery({
  ...dashboardOrderFlowBaselineQueryOptions(token ?? "", code),
  enabled: resolved && Boolean(token) && role !== "visitor",
});
```

Keep the existing realtime patch functions and derived-state mapping logic; only replace the baseline request source.

- [ ] **Step 4: Re-run the hook tests**

Run:

```bash
cd apps/frontend
npm run test -- src/features/dashboard/hooks/use-market-overview-timeline.test.tsx src/features/dashboard/hooks/use-estimated-volume-timeline.test.tsx src/features/dashboard/hooks/use-participant-amplitude.test.tsx
```

Expected: PASS with the new cache assertions green and existing realtime regression coverage still green.

- [ ] **Step 5: Commit the hook refactor**

```bash
git add apps/frontend/src/features/dashboard/hooks/use-order-flow-baseline.ts apps/frontend/src/features/dashboard/hooks/use-quote-timeline.ts apps/frontend/src/features/dashboard/hooks/use-estimated-volume-timeline.ts apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.ts apps/frontend/src/features/dashboard/hooks/use-market-overview-timeline.test.tsx apps/frontend/src/features/dashboard/hooks/use-estimated-volume-timeline.test.tsx apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.test.tsx
git commit -m "refactor: move dashboard baselines into react query cache"
```

## Task 4: Wire hover, focus, and click prefetch into shell navigation

**Files:**
- Modify: `apps/frontend/src/app/navigation/ShellNavigationContext.tsx`
- Modify: `apps/frontend/src/components/nav-main.tsx`
- Modify: `apps/frontend/src/app/layout/AppShell.tsx`
- Modify: `apps/frontend/src/app/layout/AppShell.test.tsx`

- [ ] **Step 1: Add the failing shell prefetch test**

Add a new test to `AppShell.test.tsx`:

```ts
import { prefetchDashboardRouteData } from "@/features/dashboard/lib/dashboard-route-prefetch";

vi.mock("@/features/dashboard/lib/dashboard-route-prefetch", () => ({
  prefetchDashboardRouteData: vi.fn(),
}));

it("prefetches dashboard data on hover and before dashboard navigation", async () => {
  const prefetchMock = vi.mocked(prefetchDashboardRouteData);
  renderShell();

  act(() => {
    vi.advanceTimersByTime(300);
  });

  const dashboardLink = screen.getByRole("link", { name: "Overview" });

  fireEvent.mouseEnter(dashboardLink);
  fireEvent.focus(dashboardLink);
  fireEvent.click(dashboardLink);

  await waitFor(() => expect(prefetchMock).toHaveBeenCalled());
});
```

- [ ] **Step 2: Run the shell test to confirm it fails**

Run:

```bash
cd apps/frontend
npm run test -- src/app/layout/AppShell.test.tsx
```

Expected: FAIL because dashboard links do not yet call the route prefetch helper.

- [ ] **Step 3: Add async pre-navigation support and link-level prefetch triggers**

`apps/frontend/src/app/navigation/ShellNavigationContext.tsx`

```ts
interface ShellNavigationContextValue {
  isRouteLoading: boolean;
  navigateWithTransition: (
    to: To,
    options?: NavigateOptions,
    beforeNavigate?: () => Promise<void> | void,
  ) => void;
  createLinkClickHandler: (
    to: To,
    onNavigate?: () => void,
    beforeNavigate?: () => Promise<void> | void,
  ) => (event: MouseEvent<HTMLAnchorElement>) => void;
}

const navigateWithTransition = useCallback(
  (to: To, options?: NavigateOptions, beforeNavigate?: () => Promise<void> | void): void => {
    const nextPathname = resolvePathname(to);
    if (nextPathname !== null && nextPathname === location.pathname) {
      setRouteLoading(false);
      setTargetPathname(null);
      return;
    }

    setRouteLoading(true);
    setTargetPathname(nextPathname);

    void Promise.resolve(beforeNavigate?.())
      .catch(() => undefined)
      .finally(() => {
        startTransition(() => {
          navigate(to, options);
        });
      });
  },
  [location.pathname, navigate, startTransition],
);
```

`apps/frontend/src/components/nav-main.tsx`

```ts
import { queryClient } from "@/lib/query/client";
import { prefetchDashboardRouteData } from "@/features/dashboard/lib/dashboard-route-prefetch";
import { useAuthStore } from "@/lib/store/auth-store";

const token = useAuthStore((state) => state.token);
const resolved = useAuthStore((state) => state.resolved);
const role = useAuthStore((state) => state.role);

function prefetchDashboard(): Promise<void> {
  return prefetchDashboardRouteData(queryClient, { resolved, token, role });
}

<Link
  to={subItem.url}
  onMouseEnter={subItem.url === "/dashboard" ? () => void prefetchDashboard() : undefined}
  onFocus={subItem.url === "/dashboard" ? () => void prefetchDashboard() : undefined}
  onClick={createLinkClickHandler(
    subItem.url,
    handleMobileNavClick,
    subItem.url === "/dashboard" ? prefetchDashboard : undefined,
  )}
>
```

`apps/frontend/src/app/layout/AppShell.tsx`

```ts
import { queryClient } from "@/lib/query/client";
import { prefetchDashboardRouteData } from "@/features/dashboard/lib/dashboard-route-prefetch";
import { useAuthStore } from "@/lib/store/auth-store";

const { token, resolved, role } = useAuthStore();
const prefetchDashboard = () =>
  prefetchDashboardRouteData(queryClient, { resolved, token, role });

<Link to="/dashboard" onClick={createLinkClickHandler("/dashboard", undefined, prefetchDashboard)}>
  {t("app.brand")}
</Link>
```

- [ ] **Step 4: Re-run the shell test**

Run:

```bash
cd apps/frontend
npm run test -- src/app/layout/AppShell.test.tsx
```

Expected: PASS with the new dashboard hover/focus/click prefetch assertions and no regression in the existing navigation tests.

- [ ] **Step 5: Commit the shell wiring**

```bash
git add apps/frontend/src/app/navigation/ShellNavigationContext.tsx apps/frontend/src/components/nav-main.tsx apps/frontend/src/app/layout/AppShell.tsx apps/frontend/src/app/layout/AppShell.test.tsx
git commit -m "feat: prefetch dashboard data from shell navigation"
```

## Task 5: Run the integrated frontend verification and final commit

**Files:**
- Modify: none

- [ ] **Step 1: Run the focused dashboard-prefetch regression set**

Run:

```bash
cd apps/frontend
npm run test -- src/features/dashboard/lib/query-keys.test.ts src/features/dashboard/lib/dashboard-route-prefetch.test.ts src/app/DashboardPrefetchBootstrap.test.tsx src/features/dashboard/hooks/use-market-overview-timeline.test.tsx src/features/dashboard/hooks/use-estimated-volume-timeline.test.tsx src/features/dashboard/hooks/use-participant-amplitude.test.tsx src/app/layout/AppShell.test.tsx
```

Expected: PASS with the full dashboard-prefetch slice green.

- [ ] **Step 2: Run frontend typecheck**

Run:

```bash
cd apps/frontend
npm run typecheck
```

Expected: PASS with no new type errors from the query contract or shell navigation callback signature changes.

- [ ] **Step 3: Run the full frontend test suite**

Run:

```bash
cd apps/frontend
npm run test
```

Expected: PASS with no regressions outside the dashboard-prefetch slice.

- [ ] **Step 4: Review the final diff**

Run:

```bash
git --no-pager diff --stat HEAD~4..HEAD
git --no-pager status --short
```

Expected: the diff shows only dashboard prefetch/query-contract related files, and `git status --short` is clean aside from any user-owned unrelated files outside this work.

- [ ] **Step 5: Create the final integration commit**

```bash
git add apps/frontend/src/app/DashboardPrefetchBootstrap.tsx apps/frontend/src/app/DashboardPrefetchBootstrap.test.tsx apps/frontend/src/app/providers.tsx apps/frontend/src/app/navigation/ShellNavigationContext.tsx apps/frontend/src/app/layout/AppShell.tsx apps/frontend/src/app/layout/AppShell.test.tsx apps/frontend/src/components/nav-main.tsx apps/frontend/src/features/dashboard/lib/query-keys.ts apps/frontend/src/features/dashboard/lib/query-keys.test.ts apps/frontend/src/features/dashboard/lib/dashboard-queries.ts apps/frontend/src/features/dashboard/lib/dashboard-route-prefetch.ts apps/frontend/src/features/dashboard/lib/dashboard-route-prefetch.test.ts apps/frontend/src/features/dashboard/hooks/use-order-flow-baseline.ts apps/frontend/src/features/dashboard/hooks/use-quote-timeline.ts apps/frontend/src/features/dashboard/hooks/use-estimated-volume-timeline.ts apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.ts apps/frontend/src/features/dashboard/hooks/use-market-overview-timeline.test.tsx apps/frontend/src/features/dashboard/hooks/use-estimated-volume-timeline.test.tsx apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.test.tsx
git commit -m "feat: add dashboard route prefetch"
```

## Self-review

- **Spec coverage:** The plan covers the dashboard query contract, route-prefetch helper, post-bootstrap warmup, hover/focus/click triggers, hook cache consumption, auth gating, and test coverage requested by the spec.
- **Placeholder scan:** No task uses TBD/TODO wording; each task names exact files, concrete commands, and code snippets.
- **Type consistency:** The plan uses one consistent naming scheme across tasks: `prefetchDashboardRouteData`, `DashboardPrefetchBootstrap`, and the `buildDashboard*QueryKey`/`dashboard*QueryOptions` helpers.
