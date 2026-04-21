import { describe, it, expect } from "vitest";
import { buildSeriesFromMaps } from "./build-series-from-maps";

describe("buildSeriesFromMaps", () => {
  it("updates existing point and inserts new point", () => {
    const baseline = [
      { minuteTs: 1, value: 10 },
      { minuteTs: 2, value: 20 },
    ];
    const indexMap = new Map<number, number>([[1, 0], [2, 1]]);

    const realtime: Record<string, any> = {
      a: { minuteTs: 2, value: 25 },
      b: { minuteTs: 3, value: 30 },
    };

    const { series, indexMap: nextMap } = buildSeriesFromMaps(baseline, indexMap, realtime);

    expect(series.length).toBe(3);
    // minuteTs 2 updated
    expect(series.find((s) => s.minuteTs === 2)?.value).toBe(25);
    // minuteTs 3 inserted
    expect(series.find((s) => s.minuteTs === 3)?.value).toBe(30);
    // indexMap reflects positions
    expect(nextMap.get(1)).toBeDefined();
    expect(nextMap.get(2)).toBeDefined();
    expect(nextMap.get(3)).toBeDefined();
  });
});
