import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getSpotMarketDistributionBaseline } from "@/features/dashboard/api/market-overview";
import { useSpotMarketDistributionBaseline } from "@/features/dashboard/hooks/use-spot-market-distribution";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import { useAuthStore } from "@/lib/store/auth-store";

vi.mock("@/features/dashboard/api/market-overview", () => ({
  getSpotMarketDistributionBaseline: vi.fn(),
}));

const mockedGet = vi.mocked(getSpotMarketDistributionBaseline);

describe("useSpotMarketDistributionBaseline", () => {
  const now = Date.now();
  function wrapper(qc: QueryClient) {
    return function Wrapper({ children }: any) {
      return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
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

  it("applies baseline to realtime store", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockedGet.mockResolvedValueOnce({ latest: { ts: now, up_count: 1, down_count: 0, flat_count: 0, total_count: 1, trend_index: 0 }, today: [ { ts: now, up_count: 1, down_count: 0, flat_count: 0, total_count: 1, trend_index: 0 } ] } as any);

    const { result } = renderHook(() => useSpotMarketDistributionBaseline(), { wrapper: wrapper(qc) });

    await waitFor(() => expect(result.current.loading).toBe(false));
    const store = useRealtimeStore.getState();
    expect(store.spotMarketDistributionLatest).toEqual(expect.objectContaining({ ts: now }));
    expect(store.spotMarketDistributionSeries).toBeTruthy();
    expect(store.spotMarketDistributionSeries?.items.length).toBeGreaterThanOrEqual(1);
  });
});
