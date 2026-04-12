import type { MarketSummaryPoint } from "@/features/dashboard/api/types";
import { minuteKeyFromEpochMs } from "@/features/dashboard/lib/market-overview-mapper";

const minuteLabelFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Taipei",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const minutePartsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Taipei",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatMinuteLabel(minuteTs: number): string {
  return minuteLabelFormatter.format(new Date(minuteTs));
}

function minuteOfDayFromEpochMs(ts: number): number {
  const parts = minutePartsFormatter.formatToParts(new Date(ts));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function toMinuteSample(
  point: MarketSummaryPoint,
): {
  minuteTs: number;
  minuteOfDay: number;
  estimated: number;
  yesterdayEstimated?: number | null;
  estimatedDiff?: number | null;
} | null {
  if (
    typeof point.minute_ts !== "number" ||
    !Number.isFinite(point.minute_ts) ||
    typeof point.estimated_turnover !== "number" ||
    !Number.isFinite(point.estimated_turnover)
  ) {
    return null;
  }

  const minuteTs = minuteKeyFromEpochMs(point.minute_ts);
  return {
    minuteTs,
    minuteOfDay: minuteOfDayFromEpochMs(minuteTs),
    estimated: point.estimated_turnover,
    yesterdayEstimated: point.yesterday_estimated_turnover,
    estimatedDiff: point.estimated_turnover_diff,
  };
}

export interface EstimatedVolumeSeriesPoint {
  minuteTs: number;
  minuteOfDay: number;
  time: string;
  yesterdayEstimated: number;
  todayEstimated: number;
  positiveDiff: number;
  negativeDiff: number;
}

export interface EstimatedVolumeRealtimePatch {
  minuteTs: number;
  todayEstimated: number;
  yesterdayEstimated?: number | null;
  estimatedDiff?: number | null;
}

export interface EstimatedVolumeBaseline {
  series: EstimatedVolumeSeriesPoint[];
  yesterdayByMinuteOfDay: Record<number, number>;
}

function withDiff(point: {
  minuteTs: number;
  minuteOfDay: number;
  time: string;
  yesterdayEstimated: number;
  todayEstimated: number;
}): EstimatedVolumeSeriesPoint {
  const diff = point.todayEstimated - point.yesterdayEstimated;
  return {
    ...point,
    positiveDiff: diff > 0 ? diff : 0,
    negativeDiff: diff < 0 ? diff : 0,
  };
}

export function buildEstimatedVolumeBaseline(
  today: MarketSummaryPoint[],
  yesterday: MarketSummaryPoint[],
): EstimatedVolumeBaseline {
  const yesterdayByMinuteOfDay = new Map<number, number>();
  for (const row of yesterday) {
    const sample = toMinuteSample(row);
    if (!sample) {
      continue;
    }
    yesterdayByMinuteOfDay.set(sample.minuteOfDay, sample.estimated);
  }

  const todayByMinuteTs = new Map<number, { minuteTs: number; minuteOfDay: number; todayEstimated: number }>();
  const todaySampleByMinuteTs = new Map<
    number,
    { yesterdayEstimated?: number | null; estimatedDiff?: number | null }
  >();
  for (const row of today) {
    const sample = toMinuteSample(row);
    if (!sample) {
      continue;
    }
    todayByMinuteTs.set(sample.minuteTs, {
      minuteTs: sample.minuteTs,
      minuteOfDay: sample.minuteOfDay,
      todayEstimated: sample.estimated,
    });
    todaySampleByMinuteTs.set(sample.minuteTs, {
      yesterdayEstimated: sample.yesterdayEstimated,
      estimatedDiff: sample.estimatedDiff,
    });
  }

  const series = Array.from(todayByMinuteTs.values())
    .sort((left, right) => left.minuteTs - right.minuteTs)
    .map((row) => {
      const todaySample = todaySampleByMinuteTs.get(row.minuteTs);
      const fallbackYesterday = yesterdayByMinuteOfDay.get(row.minuteOfDay) ?? 0;
      const yesterdayEstimated =
        typeof todaySample?.yesterdayEstimated === "number"
          ? todaySample.yesterdayEstimated
          : fallbackYesterday;

      const point = withDiff({
        minuteTs: row.minuteTs,
        minuteOfDay: row.minuteOfDay,
        time: formatMinuteLabel(row.minuteTs),
        yesterdayEstimated,
        todayEstimated: row.todayEstimated,
      });

      if (typeof todaySample?.estimatedDiff === "number") {
        if (todaySample.estimatedDiff >= 0) {
          return {
            ...point,
            positiveDiff: todaySample.estimatedDiff,
            negativeDiff: 0,
          };
        }
        return {
          ...point,
          positiveDiff: 0,
          negativeDiff: todaySample.estimatedDiff,
        };
      }

      return point;
    });

  return {
    series,
    yesterdayByMinuteOfDay: Object.fromEntries(yesterdayByMinuteOfDay.entries()),
  };
}

export function applyEstimatedVolumeRealtimePatch(
  series: EstimatedVolumeSeriesPoint[],
  patch: EstimatedVolumeRealtimePatch,
  yesterdayByMinuteOfDay: Record<number, number>,
): EstimatedVolumeSeriesPoint[] {
  const minuteTs = minuteKeyFromEpochMs(patch.minuteTs);
  const minuteOfDay = minuteOfDayFromEpochMs(minuteTs);
  const yesterdayEstimated =
    typeof patch.yesterdayEstimated === "number"
      ? patch.yesterdayEstimated
      : (yesterdayByMinuteOfDay[minuteOfDay] ?? 0);
  const next = [...series];
  const existingIndex = next.findIndex((point) => point.minuteTs === minuteTs);
  const patchedBase = withDiff({
    minuteTs,
    minuteOfDay,
    time: formatMinuteLabel(minuteTs),
    yesterdayEstimated,
    todayEstimated: patch.todayEstimated,
  });
  const patched =
    typeof patch.estimatedDiff === "number"
      ? patch.estimatedDiff >= 0
        ? { ...patchedBase, positiveDiff: patch.estimatedDiff, negativeDiff: 0 }
        : { ...patchedBase, positiveDiff: 0, negativeDiff: patch.estimatedDiff }
      : patchedBase;

  if (existingIndex >= 0) {
    next[existingIndex] = patched;
    return next.sort((left, right) => left.minuteTs - right.minuteTs);
  }

  next.push(patched);
  return next.sort((left, right) => left.minuteTs - right.minuteTs);
}
