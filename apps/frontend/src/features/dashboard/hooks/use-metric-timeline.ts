import { useEffect, useState, useRef, useMemo } from "react";
import { DEFAULT_ORDER_FLOW_CODE } from "@/features/dashboard/api/market-overview";
import type { MetricTodayPoint } from "@/features/dashboard/api/types";
import { minuteKeyFromEpochMs } from "@/features/dashboard/lib/market-overview-mapper";
import { useOrderFlowBaseline } from "@/features/dashboard/hooks/use-order-flow-baseline";
import { useMetricLatest } from "@/features/realtime/hooks/use-metric-latest";
import type { MetricLatestPayload } from "@/features/realtime/types/realtime.types";
import { upsertPoint } from "@/features/dashboard/lib/timeline-helpers";

interface UseMetricTimelineResult {
  chipDeltaByMinuteTs: Record<number, number>;
  loading: boolean;
  error: string | null;
}

interface MetricTimelineBaselineInput {
  metricToday: MetricTodayPoint[];
  loading: boolean;
  error: string | null;
  baselineReady: boolean;
}

interface MinuteMetricSample {
  minuteTs: number;
  ts: number;
  value: number;
}

function resolveMetricPointTs(point: {
  ts?: number;
  event_ts?: string;
}): number | null {
  if (typeof point.ts === "number" && Number.isFinite(point.ts)) {
    return point.ts;
  }

  if (typeof point.event_ts === "string") {
    const parsedTs = Date.parse(point.event_ts);
    if (Number.isFinite(parsedTs)) {
      return parsedTs;
    }
  }

  return null;
}

function toMetricSample(metric: MetricTodayPoint): MinuteMetricSample | null {
  if (typeof metric.main_force_big_order !== "number") {
    return null;
  }

  const ts = resolveMetricPointTs(metric);
  if (ts === null) {
    return null;
  }

  return {
    minuteTs: minuteKeyFromEpochMs(ts),
    ts,
    value: metric.main_force_big_order,
  };
}

function resolveMetricLatestSample(
  metricLatest: MetricLatestPayload | null,
): MinuteMetricSample | null {
  if (
    !metricLatest ||
    typeof metricLatest.main_force_big_order !== "number"
  ) {
    return null;
  }

  const ts = resolveMetricPointTs(metricLatest);
  if (ts === null) {
    return null;
  }

  return {
    minuteTs: minuteKeyFromEpochMs(ts),
    ts,
    value: metricLatest.main_force_big_order,
  };
}

type InternalPoint = { minuteTs: number; value: number };

export function useMetricTimelineFromBaseline(
  baseline: MetricTimelineBaselineInput,
  code: string = DEFAULT_ORDER_FLOW_CODE,
): UseMetricTimelineResult {
  const metricLatest = useMetricLatest(code);
  const [internalSeries, setInternalSeries] = useState<InternalPoint[]>([]);
  const indexRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const latestMetricByMinute = new Map<number, MinuteMetricSample>();

    for (const metric of baseline.metricToday) {
      const sample = toMetricSample(metric);
      if (!sample) continue;
      const current = latestMetricByMinute.get(sample.minuteTs);
      if (!current || sample.ts >= current.ts) latestMetricByMinute.set(sample.minuteTs, sample);
    }

    const series = Array.from(latestMetricByMinute.values())
      .map((s) => ({ minuteTs: s.minuteTs, value: s.value }))
      .sort((a, b) => a.minuteTs - b.minuteTs);

    const m = new Map<number, number>();
    for (let i = 0; i < series.length; ++i) m.set(series[i].minuteTs, i);
    indexRef.current = m;
    setInternalSeries(series);
  }, [baseline.metricToday]);

  useEffect(() => {
    if (!baseline.baselineReady) return;
    const realtimeSample = resolveMetricLatestSample(metricLatest);
    if (!realtimeSample) return;
    const point: InternalPoint = { minuteTs: realtimeSample.minuteTs, value: realtimeSample.value };
    setInternalSeries((current) => {
      const { nextSeries, nextIndexMap, didChange } = upsertPoint(current, indexRef.current, point as any);
      if (!didChange) return current;
      indexRef.current = nextIndexMap;
      return nextSeries as InternalPoint[];
    });
  }, [baseline.baselineReady, metricLatest]);

  const chipDeltaByMinuteTs = useMemo(() => {
    const out: Record<number, number> = {};
    for (const p of internalSeries) out[p.minuteTs] = p.value;
    return out;
  }, [internalSeries]);

  return {
    chipDeltaByMinuteTs,
    loading: baseline.loading,
    error: baseline.error,
  };
}

export function useMetricTimeline(
  code: string = DEFAULT_ORDER_FLOW_CODE,
): UseMetricTimelineResult {
  const baseline = useOrderFlowBaseline(code);
  return useMetricTimelineFromBaseline(baseline, code);
}
