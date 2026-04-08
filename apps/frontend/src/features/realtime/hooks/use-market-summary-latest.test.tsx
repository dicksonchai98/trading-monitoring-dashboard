import { renderHook } from "@testing-library/react";
import { useMarketSummaryLatest } from "@/features/realtime/hooks/use-market-summary-latest";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";

describe("useMarketSummaryLatest", () => {
  beforeEach(() => {
    useRealtimeStore.getState().resetRealtime();
  });

  it("returns latest market summary payload by code", () => {
    useRealtimeStore.getState().upsertMarketSummaryLatest("TXFD6", {
      spread: 10,
      estimated_turnover: 2000,
    });

    const { result } = renderHook(() => useMarketSummaryLatest("TXFD6"));
    expect(result.current?.spread).toBe(10);
    expect(result.current?.estimated_turnover).toBe(2000);
  });

  it("returns null when no payload exists for code", () => {
    const { result } = renderHook(() => useMarketSummaryLatest("TXFD6"));
    expect(result.current).toBeNull();
  });
});
