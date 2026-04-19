import { upsertPoint } from "./timeline-helpers";

export function buildSeriesFromMaps<T extends { minuteTs?: number; ts?: number }>(
  baselineSeries: T[],
  baselineIndexMap: Map<number, number>,
  realtimeMap: Record<string, T | undefined>,
): { series: T[]; indexMap: Map<number, number> } {
  let series = baselineSeries;
  let indexMap = new Map<number, number>(baselineIndexMap);

  for (const k of Object.keys(realtimeMap)) {
    const point = realtimeMap[k];
    if (!point) continue;
    const minuteKey = (point as any).minuteTs ?? (point as any).ts;
    if (typeof minuteKey !== "number" || !Number.isFinite(minuteKey)) continue;

    const { nextSeries, nextIndexMap, didChange } = upsertPoint(
      series as any,
      indexMap as any,
      point as any,
    );

    if (didChange) {
      series = nextSeries as T[];
      indexMap = nextIndexMap as Map<number, number>;
    }
  }

  return { series, indexMap };
}
