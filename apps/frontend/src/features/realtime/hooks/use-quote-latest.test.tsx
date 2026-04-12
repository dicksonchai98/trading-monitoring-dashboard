import { renderHook } from "@testing-library/react";
import { useQuoteLatest } from "@/features/realtime/hooks/use-quote-latest";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";

describe("useQuoteLatest", () => {
  beforeEach(() => {
    useRealtimeStore.getState().resetRealtime();
  });

  it("returns latest quote payload by code", () => {
    useRealtimeStore.getState().upsertQuoteLatest("TXFD6", {
      main_chip: 11,
      long_short_force: -5,
    });

    const { result } = renderHook(() => useQuoteLatest("TXFD6"));
    expect(result.current?.main_chip).toBe(11);
    expect(result.current?.long_short_force).toBe(-5);
  });

  it("returns null when no payload exists for code", () => {
    const { result } = renderHook(() => useQuoteLatest("TXFD6"));
    expect(result.current).toBeNull();
  });
});
