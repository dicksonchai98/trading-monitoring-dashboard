import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { DEFAULT_ORDER_FLOW_CODE, getQuoteToday } from "@/features/dashboard/api/market-overview";
import { useQuoteTimeline } from "@/features/dashboard/hooks/use-quote-timeline";
import { buildDashboardQuoteTodayQueryKey } from "@/features/dashboard/lib/query-keys";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import { useAuthStore } from "@/lib/store/auth-store";

vi.mock("@/features/dashboard/api/market-overview", () => ({
  DEFAULT_ORDER_FLOW_CODE: "TXFD6",
  getQuoteToday: vi.fn(),
}));

describe("useQuoteTimeline", () => {
  const minute0 = Date.parse("2026-04-08T09:00:00+08:00");
  const minute1 = Date.parse("2026-04-08T09:01:00+08:00");
  const getQuoteTodayMock = vi.mocked(getQuoteToday);

  function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  }

  beforeEach(() => {
    act(() => {
      useAuthStore.setState({
        token: "token",
        role: "member",
        entitlement: "active",
        resolved: true,
        checkoutSessionId: null,
      });
      useRealtimeStore.getState().resetRealtime();
    });
    getQuoteTodayMock.mockReset();
  });

  afterEach(() => {
    act(() => {
      useAuthStore.setState({
        token: null,
        role: "visitor",
        entitlement: "none",
        resolved: false,
        checkoutSessionId: null,
      });
      useRealtimeStore.getState().resetRealtime();
    });
    vi.clearAllMocks();
  });

  it("hydrates quote baseline through the dashboard query cache", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getQuoteTodayMock.mockResolvedValueOnce([
      { ts: minute0, main_chip: 10, long_short_force: 20 },
      { ts: minute1, main_chip: 12, long_short_force: 18 },
    ]);

    const { result } = renderHook(() => useQuoteTimeline(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getQuoteTodayMock).toHaveBeenCalledWith(
      "token",
      "TXFD6",
      expect.any(AbortSignal),
    );
    expect(DEFAULT_ORDER_FLOW_CODE).toBe("TXFD6");
    expect(
      queryClient.getQueryData(buildDashboardQuoteTodayQueryKey("TXFD6")),
    ).toEqual([
      { ts: minute0, main_chip: 10, long_short_force: 20 },
      { ts: minute1, main_chip: 12, long_short_force: 18 },
    ]);
    expect(result.current.mainChipByMinute).toEqual({
      [minute0]: 10,
      [minute1]: 12,
    });
    expect(result.current.longShortForceByMinute).toEqual({
      [minute0]: 20,
      [minute1]: 18,
    });
  });

  it("applies realtime quote updates when latest payload uses a string ts", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getQuoteTodayMock.mockResolvedValueOnce([
      { ts: minute0, main_chip: 10, long_short_force: 20 },
    ]);

    const { result } = renderHook(() => useQuoteTimeline(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      useRealtimeStore.getState().upsertQuoteLatest("TXFD6", {
        ts: new Date(minute1).toISOString(),
        main_chip: 33,
        long_short_force: 44,
      });
    });

    await waitFor(() =>
      expect(result.current.mainChipByMinute).toEqual({
        [minute0]: 10,
        [minute1]: 33,
      }),
    );
    expect(result.current.longShortForceByMinute).toEqual({
      [minute0]: 20,
      [minute1]: 44,
    });
  });
});
