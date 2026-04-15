import { act, renderHook, waitFor } from "@testing-library/react";
import {
  DEFAULT_ORDER_FLOW_CODE,
  getDailyAmplitudeHistory,
  getOrderFlowBaseline,
} from "@/features/dashboard/api/market-overview";
import { useParticipantAmplitude } from "@/features/dashboard/hooks/use-participant-amplitude";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import { useAuthStore } from "@/lib/store/auth-store";

vi.mock("@/features/dashboard/api/market-overview", () => ({
  DEFAULT_ORDER_FLOW_CODE: "TXFD6",
  getDailyAmplitudeHistory: vi.fn(),
  getOrderFlowBaseline: vi.fn(),
}));

describe("useParticipantAmplitude", () => {
  const getDailyAmplitudeHistoryMock = vi.mocked(getDailyAmplitudeHistory);
  const getOrderFlowBaselineMock = vi.mocked(getOrderFlowBaseline);

  beforeEach(() => {
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
    getDailyAmplitudeHistoryMock.mockReset();
    getOrderFlowBaselineMock.mockReset();
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
    vi.clearAllMocks();
  });

  it("computes summary from closed-day amplitudes only", async () => {
    getDailyAmplitudeHistoryMock.mockResolvedValueOnce([
      { code: "TXFD6", trade_date: "2026-04-03", open: 205, high: 255, low: 205, close: 250, day_amplitude: 50 },
      { code: "TXFD6", trade_date: "2026-04-02", open: 140, high: 210, low: 140, close: 205, day_amplitude: 70 },
      { code: "TXFD6", trade_date: "2026-04-01", open: 150, high: 180, low: 130, close: 140, day_amplitude: 50 },
      { code: "TXFD6", trade_date: "2026-03-31", open: 120, high: 160, low: 120, close: 150, day_amplitude: 40 },
      { code: "TXFD6", trade_date: "2026-03-28", open: 100, high: 130, low: 100, close: 120, day_amplitude: 30 },
    ]);
    getOrderFlowBaselineMock.mockResolvedValueOnce({
      kbarToday: [],
      metricToday: [],
    });

    const { result } = renderHook(() => useParticipantAmplitude());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getDailyAmplitudeHistoryMock).toHaveBeenCalledWith(
      "token",
      "TXFD6",
      19,
      expect.any(AbortSignal),
    );
    expect(getOrderFlowBaselineMock).toHaveBeenCalledWith(
      "token",
      "TXFD6",
      expect.any(AbortSignal),
    );
    expect(DEFAULT_ORDER_FLOW_CODE).toBe("TXFD6");
    expect(result.current.summary.avg5).toBe(48);
    expect(result.current.summary.yesterday).toBe(50);
    expect(result.current.summary.max5).toBe(70);
    expect(result.current.summary.avg10).toBe(48);
    expect(result.current.summary.max10).toBe(70);
  });

  it("renders 19 closed candles plus one realtime today candle when realtime arrives", async () => {
    const closedRows = Array.from({ length: 19 }, (_, index) => ({
      code: "TXFD6",
      trade_date: `2026-03-${String(index + 1).padStart(2, "0")}`,
      open: 100 + index,
      high: 110 + index,
      low: 95 + index,
      close: 103 + index,
      day_amplitude: 15,
    }));
    getDailyAmplitudeHistoryMock.mockResolvedValueOnce(closedRows);
    getOrderFlowBaselineMock.mockResolvedValueOnce({
      kbarToday: [],
      metricToday: [],
    });

    const { result } = renderHook(() => useParticipantAmplitude());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.series).toHaveLength(19);

    act(() => {
      useRealtimeStore.getState().upsertKbarCurrent({
        code: "TXFD6",
        trade_date: "2026-04-08",
        minute_ts: Date.parse("2026-04-08T09:01:00+08:00"),
        open: 35000,
        high: 35030,
        low: 34980,
        close: 35020,
        volume: 10,
      });
    });

    await waitFor(() => expect(result.current.series).toHaveLength(20));
    const latest = result.current.series[result.current.series.length - 1];
    expect(latest.tradeDate).toBe("2026-04-08");
    expect(latest.amplitude).toBe(50);
    expect(latest.isRealtime).toBe(true);
  });

  it("keeps closed-day amplitude visible when intraday baseline request fails", async () => {
    getDailyAmplitudeHistoryMock.mockResolvedValueOnce([
      { code: "TXFD6", trade_date: "2026-04-03", open: 205, high: 255, low: 205, close: 250, day_amplitude: 50 },
      { code: "TXFD6", trade_date: "2026-04-02", open: 140, high: 210, low: 140, close: 205, day_amplitude: 70 },
    ]);
    getOrderFlowBaselineMock.mockRejectedValueOnce(new Error("metric_not_found"));

    const { result } = renderHook(() => useParticipantAmplitude());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.series).toHaveLength(2);
    expect(result.current.series[0]?.tradeDate).toBe("2026-04-02");
    expect(result.current.series[1]?.tradeDate).toBe("2026-04-03");
  });

  it("prefers latest day_amplitude from today baseline over computed high-low", async () => {
    getDailyAmplitudeHistoryMock.mockResolvedValueOnce([]);
    getOrderFlowBaselineMock.mockResolvedValueOnce({
      kbarToday: [
        {
          code: "TXFD6",
          trade_date: "2026-04-08",
          minute_ts: Date.parse("2026-04-08T09:01:00+08:00"),
          open: 35000,
          high: 35030,
          low: 34980,
          close: 35020,
          volume: 10,
          day_amplitude: 12,
        },
        {
          code: "TXFD6",
          trade_date: "2026-04-08",
          minute_ts: Date.parse("2026-04-08T09:02:00+08:00"),
          open: 35020,
          high: 35080,
          low: 34970,
          close: 35070,
          volume: 8,
          day_amplitude: 18,
        },
      ],
      metricToday: [],
    });

    const { result } = renderHook(() => useParticipantAmplitude());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const latest = result.current.series[result.current.series.length - 1];
    expect(latest?.isRealtime).toBe(true);
    expect(latest?.amplitude).toBe(18);
  });
});
