import type {
  KbarTodayPoint,
  MetricTodayPoint,
} from "@/features/dashboard/api/types";

export interface OrderFlowSeriesPoint {
  minuteTs: number;
  time: string;
  indexPrice: number;
  chipDelta: number;
}

export interface OrderFlowRealtimePatch {
  minuteTs: number;
  indexPrice?: number;
  chipDelta?: number;
}

interface MinuteMetricSample {
  minuteTs: number;
  ts: number;
  value: number;
}

const minuteLabelFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Taipei",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatMinuteLabel(minuteTs: number): string {
  return minuteLabelFormatter.format(new Date(minuteTs));
}

function compareMinuteTs(left: OrderFlowSeriesPoint, right: OrderFlowSeriesPoint): number {
  return left.minuteTs - right.minuteTs;
}

function toMinuteMetricSample(metric: MetricTodayPoint): MinuteMetricSample | null {
  if (typeof metric.main_force_big_order !== "number") {
    return null;
  }

  const ts =
    typeof metric.ts === "number"
      ? metric.ts
      : typeof metric.event_ts === "string"
        ? Date.parse(metric.event_ts)
        : Number.NaN;

  if (!Number.isFinite(ts)) {
    return null;
  }

  return {
    minuteTs: minuteKeyFromEpochMs(ts),
    ts,
    value: metric.main_force_big_order,
  };
}

export function minuteKeyFromEpochMs(ts: number): number {
  return Math.floor(ts / 60_000) * 60_000;
}

export function buildOrderFlowSeries(
  kbars: KbarTodayPoint[],
  metrics: MetricTodayPoint[],
): OrderFlowSeriesPoint[] {
  const latestMetricByMinute = new Map<number, MinuteMetricSample>();

  for (const metric of metrics) {
    const sample = toMinuteMetricSample(metric);
    if (!sample) {
      continue;
    }

    const current = latestMetricByMinute.get(sample.minuteTs);
    if (!current || sample.ts >= current.ts) {
      latestMetricByMinute.set(sample.minuteTs, sample);
    }
  }

  const series = new Map<number, OrderFlowSeriesPoint>();

  for (const kbar of kbars) {
    const minuteTs = minuteKeyFromEpochMs(kbar.minute_ts);
    series.set(minuteTs, {
      minuteTs,
      time: formatMinuteLabel(minuteTs),
      indexPrice: kbar.close,
      chipDelta: latestMetricByMinute.get(minuteTs)?.value ?? 0,
    });
  }

  return Array.from(series.values()).sort(compareMinuteTs);
}

export function buildOrderFlowSeriesFromTimelineMaps(
  indexPriceByMinuteTs: Record<number, number>,
  chipDeltaByMinuteTs: Record<number, number>,
): OrderFlowSeriesPoint[] {
  const minuteTsList = Object.keys(indexPriceByMinuteTs)
    .map((minuteTs) => Number(minuteTs))
    .filter((minuteTs) => Number.isFinite(minuteTs))
    .sort((left, right) => left - right);

  return minuteTsList.map((minuteTs) => ({
    minuteTs,
    time: formatMinuteLabel(minuteTs),
    indexPrice: indexPriceByMinuteTs[minuteTs] ?? 0,
    chipDelta: chipDeltaByMinuteTs[minuteTs] ?? 0,
  }));
}

export function applyRealtimePatch(
  series: OrderFlowSeriesPoint[],
  patch: OrderFlowRealtimePatch,
): OrderFlowSeriesPoint[] {
  const minuteTs = minuteKeyFromEpochMs(patch.minuteTs);
  const nextSeries = [...series];
  const existingIndex = nextSeries.findIndex((point) => point.minuteTs === minuteTs);

  if (existingIndex >= 0) {
    const current = nextSeries[existingIndex];
    nextSeries[existingIndex] = {
      ...current,
      indexPrice: patch.indexPrice ?? current.indexPrice,
      chipDelta: patch.chipDelta ?? current.chipDelta,
    };
    return nextSeries.sort(compareMinuteTs);
  }

  if (typeof patch.indexPrice !== "number") {
    return nextSeries;
  }

  nextSeries.push({
    minuteTs,
    time: formatMinuteLabel(minuteTs),
    indexPrice: patch.indexPrice,
    chipDelta: patch.chipDelta ?? 0,
  });

  return nextSeries.sort(compareMinuteTs);
}
