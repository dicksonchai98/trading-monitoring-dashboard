import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getOtcSummaryToday, DEFAULT_OTC_CODE } from "@/features/dashboard/api/market-overview";
import { useOtcIndexSeries } from "@/features/dashboard/hooks/use-otc-index-series";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import { useAuthStore } from "@/lib/store/auth-store";

vi.mock("@/features/dashboard/api/market-overview", () => ({
  DEFAULT_OTC_CODE: "OTC001",
  getOtcSummaryToday: vi.fn(),
}));

const mockedGet = vi.mocked(getOtcSummaryToday);

describe("useOtcIndexSeries", () => {
  const minute0 = Date.parse("2026-04-08T09:00:00+08:00");
  const minute1 = Date.parse("2026-04-08T09:01:00+08:00");

  function wrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: any) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  }

  beforeEach(() => {
    act(() => {
      useAuthStore.setState({ token: "token", resolved: true, role: "member", checkoutSessionId: null });
      useRealtimeStore.getState().resetRealtime();
    });
    mockedGet.mockReset();
  });

  afterEach(() => {
    act(() => {
      useAuthStore.setState({ token: null, resolved: false, role: "visitor", checkoutSessionId: null });
      useRealtimeStore.getState().resetRealtime();
    });
    vi.clearAllMocks();
  });

  it("hydrates baseline and applies realtime otc updates", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockedGet.mockResolvedValueOnce([
      { minute_ts: minute0, index_value: 100 },
      { minute_ts: minute1, index_value: 102 },
    ] as any);

    const { result } = renderHook(() => useOtcIndexSeries(), { wrapper: wrapper(qc) });

    await waitFor(() => expect(result.current.series.length).toBe(2));
    expect(result.current.series[0].value).toBe(100);

    act(() => {
      useRealtimeStore.getState().upsertOtcSummaryLatest(DEFAULT_OTC_CODE, { minute_ts: minute1, index_value: 110, ts: minute1 } as any);
    });

    await waitFor(() => expect(result.current.series[1].value).toBe(110));
  });
});
