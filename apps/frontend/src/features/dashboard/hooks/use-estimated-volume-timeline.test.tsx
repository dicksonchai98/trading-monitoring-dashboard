import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  DEFAULT_ORDER_FLOW_CODE,
  getEstimatedVolumeBaseline,
} from "@/features/dashboard/api/market-overview";
import { useEstimatedVolumeTimeline } from "@/features/dashboard/hooks/use-estimated-volume-timeline";
import { buildDashboardEstimatedVolumeBaselineQueryKey } from "@/features/dashboard/lib/query-keys";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import { useAuthStore } from "@/lib/store/auth-store";

vi.mock("@/features/dashboard/api/market-overview", () => ({
  DEFAULT_ORDER_FLOW_CODE: "TXFD6",
  getEstimatedVolumeBaseline: vi.fn(),
}));

describe("useEstimatedVolumeTimeline", () => {
  const minute0 = Date.parse("2026-04-08T09:00:00+08:00");
  const minute1 = Date.parse("2026-04-08T09:01:00+08:00");
  const yesterdayMinute0 = Date.parse("2026-04-07T09:00:00+08:00");
  const yesterdayMinute1 = Date.parse("2026-04-07T09:01:00+08:00");
  const getEstimatedVolumeBaselineMock = vi.mocked(getEstimatedVolumeBaseline);

  function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  }

  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-04-08T10:00:00+08:00"));
    act(() => {
      useAuthStore.setState({
        token: "token",
        role: "member",
        entitlement: "none",
        resolved: true,
        checkoutSessionId: null,
      });
      useRealtimeStore.getState().resetRealtime();
    });
    getEstimatedVolumeBaselineMock.mockReset();
  });

  afterEach(() => {
    act(() => {
      useRealtimeStore.getState().resetRealtime();
      useAuthStore.setState({
        token: null,
        role: "visitor",
        entitlement: "none",
        resolved: false,
        checkoutSessionId: null,
      });
    });
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("builds estimated volume baseline with today and yesterday aligned by minute", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getEstimatedVolumeBaselineMock.mockResolvedValueOnce({
      marketSummaryToday: [
        { minute_ts: minute0, estimated_turnover: 1000 },
        { minute_ts: minute1, estimated_turnover: 1250 },
      ],
      marketSummaryYesterday: [
        { minute_ts: yesterdayMinute0, estimated_turnover: 900 },
        { minute_ts: yesterdayMinute1, estimated_turnover: 1200 },
      ],
    });

    const { result } = renderHook(() => useEstimatedVolumeTimeline(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getEstimatedVolumeBaselineMock).toHaveBeenCalledWith(
      "token",
      "TXFD6",
      expect.any(AbortSignal),
    );
    expect(DEFAULT_ORDER_FLOW_CODE).toBe("TXFD6");
    expect(
      queryClient.getQueryData(
        buildDashboardEstimatedVolumeBaselineQueryKey("TXFD6"),
      ),
    ).toEqual({
      marketSummaryToday: [
        { minute_ts: minute0, estimated_turnover: 1000 },
        { minute_ts: minute1, estimated_turnover: 1250 },
      ],
      marketSummaryYesterday: [
        { minute_ts: yesterdayMinute0, estimated_turnover: 900 },
        { minute_ts: yesterdayMinute1, estimated_turnover: 1200 },
      ],
    });
    expect(result.current.error).toBeNull();
    expect(result.current.series).toEqual([
      {
        minuteTs: minute0,
        minuteOfDay: 540,
        time: "09:00",
        yesterdayEstimated: 900,
        todayEstimated: 1000,
        positiveDiff: 100,
        negativeDiff: 0,
      },
      {
        minuteTs: minute1,
        minuteOfDay: 541,
        time: "09:01",
        yesterdayEstimated: 1200,
        todayEstimated: 1250,
        positiveDiff: 50,
        negativeDiff: 0,
      },
    ]);
  });

  it("aborts the baseline request when the hook unmounts", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let capturedSignal: AbortSignal | undefined;
    getEstimatedVolumeBaselineMock.mockImplementationOnce(
      async (_token, _code, signal?: AbortSignal) => {
        capturedSignal = signal;
        return new Promise(() => {});
      },
    );

    const { unmount } = renderHook(() => useEstimatedVolumeTimeline(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() =>
      expect(getEstimatedVolumeBaselineMock).toHaveBeenCalledWith(
        "token",
        "TXFD6",
        expect.any(AbortSignal),
      ),
    );

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  it("patches the current minute from market_summary_latest SSE event", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getEstimatedVolumeBaselineMock.mockResolvedValueOnce({
      marketSummaryToday: [
        { minute_ts: minute0, estimated_turnover: 1000 },
      ],
      marketSummaryYesterday: [
        { minute_ts: yesterdayMinute0, estimated_turnover: 900 },
      ],
    });

    const { result } = renderHook(() => useEstimatedVolumeTimeline(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      useRealtimeStore.getState().upsertMarketSummaryLatest("TXFD6", {
        minute_ts: minute0,
        estimated_turnover: 1300,
      });
    });

    await waitFor(() =>
      expect(result.current.latest).toEqual({
        minuteTs: minute0,
        minuteOfDay: 540,
        time: "09:00",
        yesterdayEstimated: 900,
        todayEstimated: 1300,
        positiveDiff: 400,
        negativeDiff: 0,
      }),
    );
  });

  it("ignores market_summary_latest SSE patch after 13:45", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getEstimatedVolumeBaselineMock.mockResolvedValueOnce({
      marketSummaryToday: [
        { minute_ts: minute0, estimated_turnover: 1000 },
      ],
      marketSummaryYesterday: [
        { minute_ts: yesterdayMinute0, estimated_turnover: 900 },
      ],
    });
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-04-08T15:12:00+08:00"));

    const { result } = renderHook(() => useEstimatedVolumeTimeline(), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      useRealtimeStore.getState().upsertMarketSummaryLatest("TXFD6", {
        minute_ts: Date.parse("2026-04-08T15:00:00+08:00"),
        estimated_turnover: 1300,
      });
    });

    await waitFor(() =>
      expect(result.current.latest).toEqual({
        minuteTs: minute0,
        minuteOfDay: 540,
        time: "09:00",
        yesterdayEstimated: 900,
        todayEstimated: 1000,
        positiveDiff: 100,
        negativeDiff: 0,
      }),
    );
  });

  it("keeps realtime patching when baseline is empty at session open", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    getEstimatedVolumeBaselineMock.mockResolvedValueOnce({
      marketSummaryToday: [],
      marketSummaryYesterday: [],
    });

    const { result } = renderHook(() => useEstimatedVolumeTimeline(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.series).toEqual([]);

    act(() => {
      useRealtimeStore.getState().upsertMarketSummaryLatest("TXFD6", {
        minute_ts: minute0,
        estimated_turnover: 1300,
      });
    });

    await waitFor(() =>
      expect(result.current.latest).toEqual({
        minuteTs: minute0,
        minuteOfDay: 540,
        time: "09:00",
        yesterdayEstimated: 0,
        todayEstimated: 1300,
        positiveDiff: 1300,
        negativeDiff: 0,
      }),
    );
  });
});
