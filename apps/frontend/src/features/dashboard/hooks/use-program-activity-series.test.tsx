import { renderHook } from "@testing-library/react";
import { useProgramActivitySeries } from "@/features/dashboard/hooks/use-program-activity-series";
import { buildSecondaryOverlaySeries } from "@/features/dashboard/lib/secondary-overlay-series";

describe("useProgramActivitySeries", () => {
  it("maps tick series into secondary overlay series", () => {
    const tickSeries = [
      { minuteTs: 1000, time: "09:00", indexPrice: 50, chipDelta: 0 },
      { minuteTs: 2000, time: "09:01", indexPrice: 51, chipDelta: 0 },
    ];

    const { result } = renderHook(() => useProgramActivitySeries(tickSeries as any));
    const expected = buildSecondaryOverlaySeries(tickSeries as any);
    expect(result.current).toEqual(expected);
  });
});
