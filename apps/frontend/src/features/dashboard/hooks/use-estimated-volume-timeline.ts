import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_ORDER_FLOW_CODE,
} from "@/features/dashboard/api/market-overview";
import {
  applyEstimatedVolumeRealtimePatch,
  buildEstimatedVolumeBaseline,
  type EstimatedVolumeSeriesPoint,
} from "@/features/dashboard/lib/estimated-volume-mapper";
import { dashboardEstimatedVolumeBaselineQueryOptions } from "@/features/dashboard/lib/dashboard-queries";
import { useMarketSummaryLatest } from "@/features/realtime/hooks/use-market-summary-latest";
import { useAuthStore } from "@/lib/store/auth-store";

interface UseEstimatedVolumeTimelineResult {
  series: EstimatedVolumeSeriesPoint[];
  latest: EstimatedVolumeSeriesPoint | null;
  loading: boolean;
  error: string | null;
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "estimated_volume_baseline_load_failed";
}

function resolveLatestPoint(series: EstimatedVolumeSeriesPoint[]): EstimatedVolumeSeriesPoint | null {
  if (series.length === 0) {
    return null;
  }

  return series[series.length - 1] ?? null;
}

function resolveRealtimeMinuteTs(payload: {
  minute_ts?: number;
  event_ts?: number;
}): number | null {
  if (typeof payload.minute_ts === "number" && Number.isFinite(payload.minute_ts)) {
    return payload.minute_ts;
  }
  if (typeof payload.event_ts === "number" && Number.isFinite(payload.event_ts)) {
    return payload.event_ts;
  }
  return null;
}

function resolveTaipeiDatePart(tsMs: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(tsMs));
}

function resolveSessionBoundsMs(tsMs: number): { sessionStartMs: number; sessionEndMs: number } {
  const datePart = resolveTaipeiDatePart(tsMs);
  const sessionStartMs = Date.parse(`${datePart}T09:00:00+08:00`);
  const sessionEndMs = Date.parse(`${datePart}T13:45:00+08:00`);
  return { sessionStartMs, sessionEndMs };
}

export function useEstimatedVolumeTimeline(): UseEstimatedVolumeTimelineResult {
  const token = useAuthStore((state) => state.token);
  const resolved = useAuthStore((state) => state.resolved);
  const role = useAuthStore((state) => state.role);
  const marketSummaryLatest = useMarketSummaryLatest(DEFAULT_ORDER_FLOW_CODE);
  const isEnabled = resolved && Boolean(token) && role !== "visitor";
  const baselineQuery = useQuery({
    ...dashboardEstimatedVolumeBaselineQueryOptions(
      token ?? "",
      DEFAULT_ORDER_FLOW_CODE,
    ),
    enabled: isEnabled,
  });

  const baseline = useMemo(
    () =>
      buildEstimatedVolumeBaseline(
        baselineQuery.data?.marketSummaryToday ?? [],
        baselineQuery.data?.marketSummaryYesterday ?? [],
      ),
    [baselineQuery.data],
  );

  const baselineSeries = useMemo(() => baseline.series, [baseline.series]);
  const [series, setSeries] = useState<EstimatedVolumeSeriesPoint[]>(baselineSeries);
  const indexRef = useRef<Map<number, number>>(new Map());

  // reset baseline when baseline changes
  useEffect(() => {
    setSeries(baselineSeries);
    const m = new Map<number, number>();
    for (let i = 0; i < baselineSeries.length; ++i) m.set(baselineSeries[i].minuteTs, i);
    indexRef.current = m;
  }, [baselineSeries]);
n  useEffect(() => {
    if (!marketSummaryLatest) return;
    if (
      typeof marketSummaryLatest.estimated_turnover !== "number" ||
      !Number.isFinite(marketSummaryLatest.estimated_turnover)
    ) {
      return;
    }
    const minuteTs = resolveRealtimeMinuteTs(marketSummaryLatest);
    if (minuteTs === null) return;
    const { sessionStartMs, sessionEndMs } = resolveSessionBoundsMs(Date.now());
    if (minuteTs < sessionStartMs || minuteTs > sessionEndMs) return;

    const patch = {
      minuteTs,
      todayEstimated: marketSummaryLatest.estimated_turnover,
      yesterdayEstimated: marketSummaryLatest.yesterday_estimated_turnover,
      estimatedDiff: marketSummaryLatest.estimated_turnover_diff,
    };
n    // construct a full point using existing mapper so formatting matches
    const point = (applyEstimatedVolumeRealtimePatch([], patch as any, baseline.yesterdayByMinuteOfDay)[0]) as EstimatedVolumeSeriesPoint;

    setSeries((current) => {
      const { nextSeries, nextIndexMap, didChange } = upsertPoint(current, indexRef.current, point as any);
      if (!didChange) return current;
      indexRef.current = nextIndexMap;
      return nextSeries as EstimatedVolumeSeriesPoint[];
    });
  }, [marketSummaryLatest, baseline.yesterdayByMinuteOfDay]);
n  return {
    series,
    latest: series.length ? series[series.length - 1] : null,
    loading: !resolved ? true : baselineQuery.isLoading,
    error:
      isEnabled && baselineQuery.error
        ? resolveErrorMessage(baselineQuery.error)
        : null,
  };
}
