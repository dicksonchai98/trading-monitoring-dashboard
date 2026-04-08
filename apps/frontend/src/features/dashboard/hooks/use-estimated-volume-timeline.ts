import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_ORDER_FLOW_CODE,
  getEstimatedVolumeBaseline,
} from "@/features/dashboard/api/market-overview";
import {
  applyEstimatedVolumeRealtimePatch,
  buildEstimatedVolumeBaseline,
  type EstimatedVolumeSeriesPoint,
} from "@/features/dashboard/lib/estimated-volume-mapper";
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

export function useEstimatedVolumeTimeline(): UseEstimatedVolumeTimelineResult {
  const token = useAuthStore((state) => state.token);
  const resolved = useAuthStore((state) => state.resolved);
  const role = useAuthStore((state) => state.role);
  const marketSummaryLatest = useMarketSummaryLatest(DEFAULT_ORDER_FLOW_CODE);

  const [series, setSeries] = useState<EstimatedVolumeSeriesPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [baselineReady, setBaselineReady] = useState<boolean>(false);
  const yesterdayByMinuteOfDayRef = useRef<Record<number, number>>({});

  useEffect(() => {
    let cancelled = false;

    setBaselineReady(false);
    yesterdayByMinuteOfDayRef.current = {};

    if (!resolved) {
      setSeries([]);
      setLoading(true);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    if (!token || role === "visitor") {
      setSeries([]);
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    setSeries([]);
    setLoading(true);
    setError(null);

    void getEstimatedVolumeBaseline(token, DEFAULT_ORDER_FLOW_CODE)
      .then(({ marketSummaryToday, marketSummaryYesterday }) => {
        if (cancelled) {
          return;
        }

        const baseline = buildEstimatedVolumeBaseline(
          marketSummaryToday,
          marketSummaryYesterday,
        );
        yesterdayByMinuteOfDayRef.current = baseline.yesterdayByMinuteOfDay;
        setSeries(baseline.series);
        setBaselineReady(true);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }

        setSeries([]);
        setError(resolveErrorMessage(err));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resolved, role, token]);

  useEffect(() => {
    if (!baselineReady || !marketSummaryLatest) {
      return;
    }
    if (
      typeof marketSummaryLatest.estimated_turnover !== "number" ||
      !Number.isFinite(marketSummaryLatest.estimated_turnover)
    ) {
      return;
    }

    const minuteTs = resolveRealtimeMinuteTs(marketSummaryLatest);
    if (minuteTs === null) {
      return;
    }
    const estimatedTurnover = marketSummaryLatest.estimated_turnover;
    if (typeof estimatedTurnover !== "number" || !Number.isFinite(estimatedTurnover)) {
      return;
    }

    setSeries((currentSeries) =>
      applyEstimatedVolumeRealtimePatch(
        currentSeries,
        {
          minuteTs,
          todayEstimated: estimatedTurnover,
          yesterdayEstimated: marketSummaryLatest.yesterday_estimated_turnover,
          estimatedDiff: marketSummaryLatest.estimated_turnover_diff,
        },
        yesterdayByMinuteOfDayRef.current,
      ),
    );
  }, [baselineReady, marketSummaryLatest]);

  return {
    series,
    latest: resolveLatestPoint(series),
    loading,
    error,
  };
}
