import { renderHook } from "@testing-library/react";
import { useOtcSummaryLatest } from "@/features/realtime/hooks/use-otc-summary-latest";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";

describe("useOtcSummaryLatest", () => {
  beforeEach(() => {
    useRealtimeStore.getState().resetRealtime();
  });

  it("returns latest OTC summary payload by code", () => {
    useRealtimeStore.getState().upsertOtcSummaryLatest("OTC001", {
      index_value: 252.34,
      minute_ts: 1775710860000,
    });

    const { result } = renderHook(() => useOtcSummaryLatest("OTC001"));
    expect(result.current?.index_value).toBe(252.34);
  });

  it("returns null when no payload exists for code", () => {
    const { result } = renderHook(() => useOtcSummaryLatest("OTC001"));
    expect(result.current).toBeNull();
  });
});
