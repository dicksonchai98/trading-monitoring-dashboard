import { renderHook } from "@testing-library/react";
import { useVolumeLadderSeries } from "@/features/dashboard/hooks/use-volume-ladder-series";
import { buildSecondaryOverlaySeries } from "@/features/dashboard/lib/secondary-overlay-series";

describe("useVolumeLadderSeries", () => {
  it("builds secondary overlay series from tickSeries and mainChipByMinute", () => {
    const tickSeries = [
      { minuteTs: 1_000, time: "09:00", indexPrice: 100, chipDelta: 0 },
      { minuteTs: 2_000, time: "09:01", indexPrice: 101, chipDelta: 0 },
    ];
    const mainChipByMinute: Record<number, number> = {
      1000: 10,
      2000: 12,
    };

    const { result } = renderHook(() => useVolumeLadderSeries(tickSeries as any, mainChipByMinute));

    const expected = buildSecondaryOverlaySeries(tickSeries as any, mainChipByMinute);
    expect(result.current).toEqual(expected);
  });
});
