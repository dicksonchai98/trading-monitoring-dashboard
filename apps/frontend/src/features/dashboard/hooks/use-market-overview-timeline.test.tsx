import { act, renderHook, waitFor } from "@testing-library/react";
import { DEFAULT_ORDER_FLOW_CODE, getOrderFlowBaseline } from "@/features/dashboard/api/market-overview";
import { useMarketOverviewTimeline } from "@/features/dashboard/hooks/use-market-overview-timeline";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import { useAuthStore } from "@/lib/store/auth-store";

vi.mock("@/features/dashboard/api/market-overview", () => ({
  DEFAULT_ORDER_FLOW_CODE: "TXF",
  getOrderFlowBaseline: vi.fn(),
}));

describe("useMarketOverviewTimeline", () => {
  const minute0 = Date.parse("2026-04-08T09:00:00+08:00");
  const minute1 = Date.parse("2026-04-08T09:01:00+08:00");
  const getOrderFlowBaselineMock = vi.mocked(getOrderFlowBaseline);

  beforeEach(() => {
    useAuthStore.setState({
      token: "token",
      role: "member",
      entitlement: "none",
      resolved: true,
      checkoutSessionId: null,
    });
    useRealtimeStore.getState().resetRealtime();
    getOrderFlowBaselineMock.mockReset();
  });

  afterEach(() => {
    useRealtimeStore.getState().resetRealtime();
    useAuthStore.setState({
      token: null,
      role: "visitor",
      entitlement: "none",
      resolved: false,
      checkoutSessionId: null,
    });
    vi.clearAllMocks();
  });

  it("builds baseline series from today's TXF kbar and bidask responses", async () => {
    getOrderFlowBaselineMock.mockResolvedValueOnce({
      kbarToday: [
        {
          code: "TXF",
          trade_date: "2026-04-08",
          minute_ts: minute0,
          open: 22300,
          high: 22310,
          low: 22290,
          close: 22305,
          volume: 12,
        },
        {
          code: "TXF",
          trade_date: "2026-04-08",
          minute_ts: minute1,
          open: 22305,
          high: 22315,
          low: 22300,
          close: 22312,
          volume: 15,
        },
      ],
      metricToday: [
        { main_force_big_order: 100, ts: minute0 + 1000 },
        { main_force_big_order: 240, ts: minute1 + 2000 },
      ],
    });

    const { result } = renderHook(() => useMarketOverviewTimeline());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getOrderFlowBaselineMock).toHaveBeenCalledWith("token", "TXF");
    expect(DEFAULT_ORDER_FLOW_CODE).toBe("TXF");
    expect(result.current.error).toBeNull();
    expect(result.current.series).toEqual([
      {
        minuteTs: minute0,
        time: "09:00",
        indexPrice: 22305,
        chipDelta: 100,
      },
      {
        minuteTs: minute1,
        time: "09:01",
        indexPrice: 22312,
        chipDelta: 240,
      },
    ]);
  });

  it("patches the current minute without recomputing the whole series", async () => {
    getOrderFlowBaselineMock.mockResolvedValueOnce({
      kbarToday: [
        {
          code: "TXF",
          trade_date: "2026-04-08",
          minute_ts: minute0,
          open: 22300,
          high: 22310,
          low: 22290,
          close: 22305,
          volume: 12,
        },
        {
          code: "TXF",
          trade_date: "2026-04-08",
          minute_ts: minute1,
          open: 22305,
          high: 22315,
          low: 22300,
          close: 22312,
          volume: 15,
        },
      ],
      metricToday: [
        { main_force_big_order: 100, ts: minute0 + 1000 },
        { main_force_big_order: 240, ts: minute1 + 2000 },
      ],
    });

    const { result } = renderHook(() => useMarketOverviewTimeline());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      useRealtimeStore.getState().upsertKbarCurrent({
        code: "TXF",
        trade_date: "2026-04-08",
        minute_ts: minute1,
        open: 22305,
        high: 22350,
        low: 22300,
        close: 22340,
        volume: 30,
      });
      useRealtimeStore.getState().upsertMetricLatest("TXF", {
        main_force_big_order: 999,
        ts: minute1 + 5000,
      });
    });

    await waitFor(() =>
      expect(result.current.series).toEqual([
        {
          minuteTs: minute0,
          time: "09:00",
          indexPrice: 22305,
          chipDelta: 100,
        },
        {
          minuteTs: minute1,
          time: "09:01",
          indexPrice: 22340,
          chipDelta: 999,
        },
      ]),
    );
  });

  it("retains metric chipDelta when metric arrives before the first kbar for a new minute", async () => {
    getOrderFlowBaselineMock.mockResolvedValueOnce({
      kbarToday: [
        {
          code: "TXF",
          trade_date: "2026-04-08",
          minute_ts: minute0,
          open: 22300,
          high: 22310,
          low: 22290,
          close: 22305,
          volume: 12,
        },
      ],
      metricToday: [
        { main_force_big_order: 100, ts: minute0 + 1000 },
      ],
    });

    const { result } = renderHook(() => useMarketOverviewTimeline());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      useRealtimeStore.getState().upsertMetricLatest("TXF", {
        main_force_big_order: 555,
        ts: minute1 + 3000,
      });
    });

    expect(result.current.series).toEqual([
      {
        minuteTs: minute0,
        time: "09:00",
        indexPrice: 22305,
        chipDelta: 100,
      },
    ]);

    act(() => {
      useRealtimeStore.getState().upsertKbarCurrent({
        code: "TXF",
        trade_date: "2026-04-08",
        minute_ts: minute1,
        open: 22312,
        high: 22360,
        low: 22305,
        close: 22350,
        volume: 21,
      });
    });

    await waitFor(() =>
      expect(result.current.series).toEqual([
        {
          minuteTs: minute0,
          time: "09:00",
          indexPrice: 22305,
          chipDelta: 100,
        },
        {
          minuteTs: minute1,
          time: "09:01",
          indexPrice: 22350,
          chipDelta: 555,
        },
      ]),
    );
  });

  it("skips baseline fetch when the user is a visitor", async () => {
    useAuthStore.setState({
      token: null,
      role: "visitor",
      entitlement: "none",
      resolved: true,
      checkoutSessionId: null,
    });

    const { result } = renderHook(() => useMarketOverviewTimeline());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getOrderFlowBaselineMock).not.toHaveBeenCalled();
    expect(result.current.series).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
