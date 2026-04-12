import { describe, expect, it } from "vitest";
import { withAmplitudeMovingAverages } from "@/features/dashboard/lib/participant-signals";

describe("withAmplitudeMovingAverages", () => {
  it("computes MA3/MA5/MA10 from amplitude series", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      day: `04/${String(i + 1).padStart(2, "0")}`,
      tradeDate: `2026-04-${String(i + 1).padStart(2, "0")}`,
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      amplitude: i + 1,
    }));

    const series = withAmplitudeMovingAverages(rows);
    const latest = series[series.length - 1];

    expect(latest?.ma3).toBeCloseTo((8 + 9 + 10) / 3, 6);
    expect(latest?.ma5).toBeCloseTo((6 + 7 + 8 + 9 + 10) / 5, 6);
    expect(latest?.ma10).toBeCloseTo(5.5, 6);
    expect(latest?.ampOpen).toBeCloseTo(0, 6);
    expect(latest?.ampClose).toBeCloseTo(5, 6);
    expect(latest?.ampHigh).toBeCloseTo(10, 6);
    expect(latest?.ampLow).toBeCloseTo(0, 6);
    expect(latest?.ampBody).toBeCloseTo(5, 6);
  });
});
