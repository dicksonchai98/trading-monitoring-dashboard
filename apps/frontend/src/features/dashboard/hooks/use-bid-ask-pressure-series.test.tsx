import { renderHook } from "@testing-library/react";
import { useBidAskPressureSeries } from "@/features/dashboard/hooks/use-bid-ask-pressure-series";
import { buildSecondaryOverlaySeries } from "@/features/dashboard/lib/secondary-overlay-series";

describe("useBidAskPressureSeries", () => {
  it("computes overlay series using longShortForceByMinute", () => {
    const tickSeries = [
      { minuteTs: 1000, time: "09:00", indexPrice: 200, chipDelta: 0 },
      { minuteTs: 2000, time: "09:01", indexPrice: 201, chipDelta: 0 },
    ];
    const longShortForceByMinute: Record<number, number> = { 1000: 5, 2000: 7 };

    const { result } = renderHook(() => useBidAskPressureSeries(tickSeries as any, longShortForceByMinute));
    const expected = buildSecondaryOverlaySeries(tickSeries as any, longShortForceByMinute);
    expect(result.current).toEqual(expected);
  });
});
