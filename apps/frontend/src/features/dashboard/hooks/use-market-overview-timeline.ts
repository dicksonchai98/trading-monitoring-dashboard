import { useEffect, useRef, useState } from "react";
import { DEFAULT_ORDER_FLOW_CODE, getOrderFlowBaseline } from "@/features/dashboard/api/market-overview";
import {
  applyRealtimePatch,
  buildOrderFlowSeries,
  minuteKeyFromEpochMs,
  type OrderFlowSeriesPoint,
} from "@/features/dashboard/lib/market-overview-mapper";
import { useKbarCurrent } from "@/features/realtime/hooks/use-kbar-current";
import { useMetricLatest } from "@/features/realtime/hooks/use-metric-latest";
import type { MetricLatestPayload } from "@/features/realtime/types/realtime.types";
import { useAuthStore } from "@/lib/store/auth-store";

interface UseMarketOverviewTimelineResult {
  series: OrderFlowSeriesPoint[];
  loading: boolean;
  error: string | null;
}

function resolveMetricMinuteTs(metric: MetricLatestPayload | null): number | null {
  if (!metric) {
    return null;
  }

  if (typeof metric.ts === "number") {
    return minuteKeyFromEpochMs(metric.ts);
  }

  if (typeof metric.event_ts === "string") {
    const parsedTs = Date.parse(metric.event_ts);
    if (Number.isFinite(parsedTs)) {
      return minuteKeyFromEpochMs(parsedTs);
    }
  }

  return null;
}

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "order_flow_baseline_load_failed";
}

export function useMarketOverviewTimeline(): UseMarketOverviewTimelineResult {
  const token = useAuthStore((state) => state.token);
  const resolved = useAuthStore((state) => state.resolved);
  const role = useAuthStore((state) => state.role);
  const kbarCurrent = useKbarCurrent(DEFAULT_ORDER_FLOW_CODE);
  const metricLatest = useMetricLatest(DEFAULT_ORDER_FLOW_CODE);

  const [series, setSeries] = useState<OrderFlowSeriesPoint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [baselineReady, setBaselineReady] = useState<boolean>(false);
  const pendingChipDeltaByMinuteRef = useRef<Record<number, number>>({});

  useEffect(() => {
    let cancelled = false;

    setBaselineReady(false);
    pendingChipDeltaByMinuteRef.current = {};

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

    void getOrderFlowBaseline(token, DEFAULT_ORDER_FLOW_CODE)
      .then(({ kbarToday, metricToday }) => {
        if (cancelled) {
          return;
        }
        setSeries(buildOrderFlowSeries(kbarToday, metricToday));
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
    if (!baselineReady) {
      return;
    }

    if (!metricLatest || typeof metricLatest.main_force_big_order !== "number") {
      return;
    }

    const metricMinuteTs = resolveMetricMinuteTs(metricLatest);
    if (metricMinuteTs === null) {
      return;
    }
    const metricMainForce = metricLatest.main_force_big_order;

    setSeries((currentSeries) => {
      const hasCurrentPoint = currentSeries.some((point) => point.minuteTs === metricMinuteTs);
      if (!hasCurrentPoint) {
        pendingChipDeltaByMinuteRef.current[metricMinuteTs] = metricMainForce;
        return currentSeries;
      }

      delete pendingChipDeltaByMinuteRef.current[metricMinuteTs];
      return applyRealtimePatch(currentSeries, {
        minuteTs: metricMinuteTs,
        chipDelta: metricMainForce,
      });
    });
  }, [baselineReady, metricLatest]);

  useEffect(() => {
    if (!baselineReady || !kbarCurrent) {
      return;
    }

    const minuteTs = minuteKeyFromEpochMs(kbarCurrent.minute_ts);
    const pendingChipDelta = pendingChipDeltaByMinuteRef.current[minuteTs];

    setSeries((currentSeries) => {
      if (typeof pendingChipDelta === "number") {
        delete pendingChipDeltaByMinuteRef.current[minuteTs];
        return applyRealtimePatch(currentSeries, {
          minuteTs,
          indexPrice: kbarCurrent.close,
          chipDelta: pendingChipDelta,
        });
      }

      return applyRealtimePatch(currentSeries, {
        minuteTs,
        indexPrice: kbarCurrent.close,
      });
    });
  }, [baselineReady, kbarCurrent]);

  return {
    series,
    loading,
    error,
  };
}
