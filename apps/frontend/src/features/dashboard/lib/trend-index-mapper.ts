export interface TrendIndexDatum {
  ts: number;
  timeLabel: string;
  trendDelta: number;
  trendRatio: number;
}

const TREND_WINDOW_START_MINUTES = 9 * 60;
const TREND_WINDOW_END_MINUTES = 13 * 60 + 30;

const taipeiTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  timeZone: "Asia/Taipei",
});

const taipeiTimeLabelFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  timeZone: "Asia/Taipei",
});

function formatTrendLabel(ts: number): string {
  return taipeiTimeLabelFormatter.format(new Date(ts));
}

function getTaipeiMinutes(ts: number): number {
  const [hourText, minuteText] = taipeiTimeFormatter
    .format(new Date(ts))
    .split(":");
  return Number(hourText) * 60 + Number(minuteText);
}

function getTrendDelta(item: { up_count: number; down_count: number }): number {
  return item.up_count - item.down_count;
}

function getTrendRatio(item: {
  trend_index?: number | null;
  up_count: number;
  down_count: number;
  total_count: number;
}): number {
  if (typeof item.trend_index === "number") {
    return Number((item.trend_index * 100).toFixed(1));
  }

  const totalCount = Math.max(item.total_count, 1);
  return Number(((getTrendDelta(item) / totalCount) * 100).toFixed(1));
}

export function mapSpotMarketDistributionToTrendData(
  seriesItems: Array<any> | undefined,
  latest: any | undefined,
): TrendIndexDatum[] {
  const seriesItemsArr = seriesItems ?? [];
  const mapped = seriesItemsArr
    .filter(
      (item) =>
        typeof item.up_count === "number" &&
        typeof item.down_count === "number" &&
        getTaipeiMinutes(item.ts) >= TREND_WINDOW_START_MINUTES &&
        getTaipeiMinutes(item.ts) <= TREND_WINDOW_END_MINUTES,
    )
    .map((item) => ({
      ts: item.ts,
      timeLabel: formatTrendLabel(item.ts),
      trendDelta: getTrendDelta(item),
      trendRatio: getTrendRatio(item),
    }))
    .sort((left, right) => left.ts - right.ts);

  if (mapped.length > 0) return mapped;

  if (
    latest &&
    typeof latest.up_count === "number" &&
    typeof latest.down_count === "number" &&
    getTaipeiMinutes(latest.ts) >= TREND_WINDOW_START_MINUTES &&
    getTaipeiMinutes(latest.ts) <= TREND_WINDOW_END_MINUTES
  ) {
    return [
      {
        ts: latest.ts,
        timeLabel: formatTrendLabel(latest.ts),
        trendDelta: getTrendDelta(latest),
        trendRatio: getTrendRatio(latest),
      },
    ];
  }

  return [];
}
