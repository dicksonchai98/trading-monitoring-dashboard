# Request Abort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AbortController support so page-init requests and shared layout/sidebar preflight requests are truly cancelled on route changes, dependency changes, or repeated clicks.

**Architecture:** Extend the shared API client to accept `AbortSignal`, thread that signal through feature API helpers, then wire callers in `useEffect`, React Query, and sidebar actions to create and cancel controllers at the right lifecycle boundaries. Treat aborted requests as non-errors so they do not trigger existing error UI or toast paths.

**Tech Stack:** React 19, TypeScript, TanStack React Query, Vite, Vitest, fetch API, AbortController

---

## File map

- `apps/frontend/src/lib/api/types.ts` — shared request option type, add `signal`
- `apps/frontend/src/lib/api/client.ts` — shared fetch wrapper, abort detection helper
- `apps/frontend/src/lib/api/client.test.ts` — shared client tests
- `apps/frontend/src/features/subscription/api/billing.ts` — billing helpers accept and pass `signal`
- `apps/frontend/src/features/dashboard/api/market-overview.ts` — dashboard read helpers accept and pass `signal`
- `apps/frontend/src/features/analytics/api/analytics.ts` — analytics read helpers accept and pass `signal`
- `apps/frontend/src/app/SessionBootstrap.tsx` — bootstrap effect aborts in-flight reads on cleanup
- `apps/frontend/src/features/auth/lib/auth-page-shared.ts` — authenticated session enrichment can pass `signal` when used from cancellable flows
- `apps/frontend/src/features/dashboard/hooks/use-order-flow-baseline.ts` — replace logical cancel flag with AbortController
- `apps/frontend/src/features/dashboard/hooks/use-quote-timeline.ts` — replace logical cancel flag with AbortController
- `apps/frontend/src/features/dashboard/hooks/use-estimated-volume-timeline.ts` — abort baseline fetch on cleanup
- `apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.ts` — abort both baseline requests on cleanup
- `apps/frontend/src/features/dashboard/hooks/use-otc-index-series.ts` — abort baseline request on cleanup
- `apps/frontend/src/features/subscription/pages/SubscriptionPage.tsx` — use React Query signal for status/plans and single-flight checkout click
- `apps/frontend/src/features/subscription/pages/CheckoutResultPage.tsx` — pass query signal through billing status reads
- `apps/frontend/src/components/nav-user-authenticated.tsx` — single-flight portal session request with abort

## Task 1: Add abort support to the shared API client

**Files:**
- Modify: `apps/frontend/src/lib/api/types.ts`
- Modify: `apps/frontend/src/lib/api/client.ts`
- Test: `apps/frontend/src/lib/api/client.test.ts`

- [ ] **Step 1: Write the failing client tests**

```ts
import { ApiError, getJson, isAbortError, postJson } from "@/lib/api/client";

it("passes AbortSignal through to fetch", async () => {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  const controller = new AbortController();

  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );

  await getJson("/billing/status", { signal: controller.signal });

  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringContaining("/billing/status"),
    expect.objectContaining({
      method: "GET",
      signal: controller.signal,
    }),
  );
});

it("recognizes abort errors without converting them to ApiError", () => {
  const abortError = new DOMException("The operation was aborted.", "AbortError");
  expect(isAbortError(abortError)).toBe(true);
  expect(isAbortError(new ApiError("api_request_failed", 500))).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/frontend
npm run test -- src/lib/api/client.test.ts
```

Expected: FAIL because `ApiRequestOptions` has no `signal` and `isAbortError` does not exist.

- [ ] **Step 3: Write the minimal implementation**

`apps/frontend/src/lib/api/types.ts`

```ts
export interface ApiRequestOptions {
  headers?: HeadersInit;
  signal?: AbortSignal;
}
```

`apps/frontend/src/lib/api/client.ts`

```ts
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function request<TResponse>(
  path: string,
  init: RequestInit,
): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
  });
  // existing response handling unchanged
}

export async function getJson<TResponse>(
  path: string,
  options?: ApiRequestOptions,
): Promise<TResponse> {
  return request<TResponse>(path, {
    method: "GET",
    headers: { ...options?.headers },
    signal: options?.signal,
  });
}

export async function postJson<TResponse, TBody extends object>(
  path: string,
  body: TBody,
  options?: ApiRequestOptions,
): Promise<TResponse> {
  return request<TResponse>(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: JSON.stringify(body),
    signal: options?.signal,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/frontend
npm run test -- src/lib/api/client.test.ts
```

Expected: PASS with the new abort assertions green.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/lib/api/types.ts apps/frontend/src/lib/api/client.ts apps/frontend/src/lib/api/client.test.ts
git commit -m "feat: add abort support to api client"
```

## Task 2: Thread `signal` through feature API helpers

**Files:**
- Modify: `apps/frontend/src/features/subscription/api/billing.ts`
- Modify: `apps/frontend/src/features/dashboard/api/market-overview.ts`
- Modify: `apps/frontend/src/features/analytics/api/analytics.ts`
- Test: `apps/frontend/src/lib/api/client.test.ts`

- [ ] **Step 1: Write the failing helper passthrough test**

Add one spy-based test near the shared client tests:

```ts
it("forwards signal from billing helper into the shared client", async () => {
  const controller = new AbortController();
  const getJsonMock = vi.spyOn(await import("@/lib/api/client"), "getJson");
  getJsonMock.mockResolvedValueOnce({ status: "active" } as never);

  const { getBillingStatus } = await import("@/features/subscription/api/billing");
  await getBillingStatus("token", controller.signal);

  expect(getJsonMock).toHaveBeenCalledWith(
    "/billing/status",
    expect.objectContaining({
      signal: controller.signal,
    }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/frontend
npm run test -- src/lib/api/client.test.ts
```

Expected: FAIL because helper signatures do not yet accept `signal`.

- [ ] **Step 3: Write the minimal implementation**

`apps/frontend/src/features/subscription/api/billing.ts`

```ts
export function getBillingStatus(
  token: string,
  signal?: AbortSignal,
): Promise<BillingStatusResponse> {
  return getJson<BillingStatusResponse>("/billing/status", {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
}

export function startCheckout(
  token: string,
  signal?: AbortSignal,
): Promise<BillingCheckoutResponse> {
  return postJson<BillingCheckoutResponse, Record<string, never>>(
    "/billing/checkout",
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    },
  );
}

export function createPortalSession(
  token: string,
  signal?: AbortSignal,
): Promise<BillingPortalResponse> {
  return postJson<BillingPortalResponse, Record<string, never>>(
    "/billing/portal-session",
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    },
  );
}
```

Apply the same pattern to:

```ts
getEstimatedVolumeBaseline(token, code, signal?)
getDailyAmplitudeHistory(token, code, n, signal?)
getOrderFlowBaseline(token, code, signal?)
getQuoteToday(token, code, signal?)
getOtcSummaryToday(token, code, signal?)
getAnalyticsEvents(token, signal?)
getAnalyticsMetrics(token, signal?)
getEventStats(token, params, signal?)
getEventSamples(token, params, signal?)
getDistributionStats(token, params, signal?)
```

- [ ] **Step 4: Run tests to verify helper wiring passes**

Run:

```bash
cd apps/frontend
npm run test -- src/lib/api/client.test.ts
```

Expected: PASS with helper passthrough covered.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/subscription/api/billing.ts apps/frontend/src/features/dashboard/api/market-overview.ts apps/frontend/src/features/analytics/api/analytics.ts apps/frontend/src/lib/api/client.test.ts
git commit -m "feat: thread abort signals through api helpers"
```

## Task 3: Abort page-init reads in effect-based callers

**Files:**
- Modify: `apps/frontend/src/app/SessionBootstrap.tsx`
- Modify: `apps/frontend/src/features/dashboard/hooks/use-order-flow-baseline.ts`
- Modify: `apps/frontend/src/features/dashboard/hooks/use-quote-timeline.ts`
- Modify: `apps/frontend/src/features/dashboard/hooks/use-estimated-volume-timeline.ts`
- Modify: `apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.ts`
- Modify: `apps/frontend/src/features/dashboard/hooks/use-otc-index-series.ts`
- Modify: `apps/frontend/src/features/auth/lib/auth-page-shared.ts`
- Test: `apps/frontend/src/lib/api/client.test.ts`

- [ ] **Step 1: Write the failing abort-handling test**

Add a focused unit test for the shared abort guard:

```ts
it("treats fetch AbortError as silent cancellation", async () => {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockRejectedValueOnce(
    new DOMException("The operation was aborted.", "AbortError"),
  );

  await expect(
    getJson("/billing/status", { signal: new AbortController().signal }),
  ).rejects.toBeInstanceOf(DOMException);

  expect(isAbortError(fetchMock.mock.results[0]?.value)).toBe(false);
});
```

Then add a component-level test in the nearest existing hook/page test file you touch, asserting the effect cleanup aborts and no error state is rendered.

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:

```bash
cd apps/frontend
npm run test -- src/lib/api/client.test.ts
```

Expected: FAIL because the call sites do not yet create controllers or branch on abort.

- [ ] **Step 3: Write the minimal implementation**

Use this pattern in each effect-based caller:

```ts
useEffect(() => {
  const controller = new AbortController();

  void getOrderFlowBaseline(token, code, controller.signal)
    .then((result) => {
      setKbarToday(result.kbarToday);
      setMetricToday(result.metricToday);
    })
    .catch((error: unknown) => {
      if (isAbortError(error)) {
        return;
      }
      setError(resolveErrorMessage(error));
    });

  return () => {
    controller.abort();
  };
}, [code, resolved, role, token]);
```

Apply the same rule to:

- `resolveSessionBootstrap()` / `getBootstrapPromise()` so the billing status leg accepts `signal`
- `applyAuthenticatedSession()` so cancellable callers can pass a `signal`
- all dashboard baseline loaders currently using `cancelled = true`

Important: keep existing `setLoading` / `setResolved` semantics unchanged for non-abort paths.

- [ ] **Step 4: Run targeted tests to verify they pass**

Run:

```bash
cd apps/frontend
npm run test -- src/lib/api/client.test.ts
```

If you add hook/page-specific tests, run them explicitly too:

```bash
npm run test -- src/features/dashboard/components/RealtimeDashboardPage.test.tsx
```

Expected: PASS; no abort should surface as UI error.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/app/SessionBootstrap.tsx apps/frontend/src/features/auth/lib/auth-page-shared.ts apps/frontend/src/features/dashboard/hooks/use-order-flow-baseline.ts apps/frontend/src/features/dashboard/hooks/use-quote-timeline.ts apps/frontend/src/features/dashboard/hooks/use-estimated-volume-timeline.ts apps/frontend/src/features/dashboard/hooks/use-participant-amplitude.ts apps/frontend/src/features/dashboard/hooks/use-otc-index-series.ts apps/frontend/src/lib/api/client.test.ts
git commit -m "feat: abort page initialization requests"
```

## Task 4: Wire React Query request cancellation

**Files:**
- Modify: `apps/frontend/src/features/subscription/pages/SubscriptionPage.tsx`
- Modify: `apps/frontend/src/features/subscription/pages/CheckoutResultPage.tsx`
- Modify: `apps/frontend/src/features/analytics/pages/EventAnalyticsPage.tsx`
- Modify: `apps/frontend/src/features/analytics/pages/DistributionAnalyticsPage.tsx`
- Test: nearest existing page tests under `apps/frontend/src/features/subscription/pages/*.test.tsx` and `apps/frontend/src/features/analytics/pages/*.test.tsx`

- [ ] **Step 1: Write the failing React Query signal test**

Use an existing subscription page test and mock the billing helper:

```ts
it("passes React Query signal into billing status query", async () => {
  const getBillingStatusMock = vi.fn().mockResolvedValue({ status: "active" });
  vi.mock("@/features/subscription/api/billing", () => ({
    getBillingPlans: vi.fn().mockResolvedValue([]),
    getBillingStatus: getBillingStatusMock,
    startCheckout: vi.fn(),
  }));

  render(<SubscriptionPage />);

  await waitFor(() =>
    expect(getBillingStatusMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(AbortSignal),
    ),
  );
});
```

- [ ] **Step 2: Run the page test to verify it fails**

Run:

```bash
cd apps/frontend
npm run test -- src/features/subscription/pages/SubscriptionPage.test.tsx
```

Expected: FAIL because current queryFns ignore the React Query signal.

- [ ] **Step 3: Write the minimal implementation**

React Query pattern:

```ts
const statusQuery = useQuery({
  queryKey: ["billing", "status", token],
  queryFn: ({ signal }) => getBillingStatus(token ?? "", signal),
  enabled: Boolean(token),
});
```

Apply the same to:

- billing plans query
- checkout result billing status query
- analytics registry / stats / samples / distribution queries

Do not change retry / enabled behavior unless a failing test requires it.

- [ ] **Step 4: Run targeted tests to verify they pass**

Run:

```bash
cd apps/frontend
npm run test -- src/features/subscription/pages/SubscriptionPage.test.tsx src/features/subscription/pages/CheckoutResultPage.test.tsx src/features/analytics/pages/EventAnalyticsPage.test.tsx src/features/analytics/pages/DistributionAnalyticsPage.test.tsx
```

Expected: PASS with queryFns now receiving `AbortSignal`.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/features/subscription/pages/SubscriptionPage.tsx apps/frontend/src/features/subscription/pages/CheckoutResultPage.tsx apps/frontend/src/features/analytics/pages/EventAnalyticsPage.tsx apps/frontend/src/features/analytics/pages/DistributionAnalyticsPage.tsx
git commit -m "feat: hook react query requests into abort signals"
```

## Task 5: Make sidebar portal and checkout preflight single-flight

**Files:**
- Modify: `apps/frontend/src/components/nav-user-authenticated.tsx`
- Modify: `apps/frontend/src/features/subscription/pages/SubscriptionPage.tsx`
- Test: create `apps/frontend/src/components/nav-user-authenticated.test.tsx`

- [ ] **Step 1: Write the failing sidebar single-flight test**

```tsx
it("aborts the previous portal request when the user clicks twice", async () => {
  const firstAbort = vi.fn();
  const secondAbort = vi.fn();
  const controllers: AbortController[] = [];

  vi.spyOn(window, "open").mockImplementation(() => null);
  const createPortalSessionMock = vi.fn()
    .mockImplementationOnce((_token: string, signal?: AbortSignal) => {
      signal?.addEventListener("abort", firstAbort);
      return new Promise(() => undefined);
    })
    .mockImplementationOnce(async () => ({ portal_url: "https://billing.example.com" }));

  render(<NavUserAuthenticated user={{ name: "A", email: "a@example.com", avatar: "" }} />);

  await user.click(screen.getByText("Billing Portal"));
  await user.click(screen.getByText("Billing Portal"));

  expect(firstAbort).toHaveBeenCalled();
  expect(createPortalSessionMock).toHaveBeenNthCalledWith(
    2,
    expect.any(String),
    expect.any(AbortSignal),
  );
});
```

- [ ] **Step 2: Run the sidebar test to verify it fails**

Run:

```bash
cd apps/frontend
npm run test -- src/components/nav-user-authenticated.test.tsx
```

Expected: FAIL because the component keeps only `portalLoading`, not an abortable in-flight controller.

- [ ] **Step 3: Write the minimal implementation**

`apps/frontend/src/components/nav-user-authenticated.tsx`

```ts
const portalControllerRef = useRef<AbortController | null>(null);

async function handleOpenPortal(): Promise<void> {
  if (!token || portalLoading) {
    return;
  }

  portalControllerRef.current?.abort();
  const controller = new AbortController();
  portalControllerRef.current = controller;
  setPortalLoading(true);

  try {
    const result = await createPortalSession(token, controller.signal);
    if (controller.signal.aborted) {
      return;
    }
    toast.success(t("user.portalOpened"));
    if (typeof window !== "undefined" && result.portal_url) {
      window.open(result.portal_url, "_blank", "noopener,noreferrer");
    }
  } catch (error) {
    if (!isAbortError(error)) {
      toast.error(t("user.portalOpenFailed"));
    }
  } finally {
    if (portalControllerRef.current === controller) {
      portalControllerRef.current = null;
      setPortalLoading(false);
    }
  }
}

useEffect(() => () => portalControllerRef.current?.abort(), []);
```

Mirror the same single-flight rule for `startCheckout()` inside `SubscriptionPage` if repeated clicks can overlap before navigation.

- [ ] **Step 4: Run targeted tests to verify they pass**

Run:

```bash
cd apps/frontend
npm run test -- src/components/nav-user-authenticated.test.tsx src/features/subscription/pages/SubscriptionPage.test.tsx
```

Expected: PASS; repeated clicks abort prior requests and only the last successful response navigates.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/components/nav-user-authenticated.tsx apps/frontend/src/components/nav-user-authenticated.test.tsx apps/frontend/src/features/subscription/pages/SubscriptionPage.tsx
git commit -m "feat: abort stale sidebar billing requests"
```

## Task 6: Final verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused frontend tests**

```bash
cd apps/frontend
npm run test -- src/lib/api/client.test.ts src/features/subscription/pages/SubscriptionPage.test.tsx src/features/subscription/pages/CheckoutResultPage.test.tsx src/features/analytics/pages/EventAnalyticsPage.test.tsx src/features/analytics/pages/DistributionAnalyticsPage.test.tsx src/components/nav-user-authenticated.test.tsx
```

Expected: PASS for the new abort coverage and touched page flows.

- [ ] **Step 2: Run frontend typecheck**

```bash
cd apps/frontend
npm run typecheck
```

Expected: If pre-existing repo errors remain outside touched files, record them explicitly and confirm no new abort-related errors were introduced.

- [ ] **Step 3: Run frontend build if typecheck is clean enough to proceed**

```bash
cd apps/frontend
npm run build
```

Expected: Build succeeds, or any failure is confirmed as pre-existing and unrelated to abort changes.

- [ ] **Step 4: Final commit**

```bash
git add apps/frontend
git commit -m "feat: cancel stale frontend api requests on navigation"
```
