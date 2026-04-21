import { useEffect, useState, useRef, useMemo } from "react";
import { DEFAULT_ORDER_FLOW_CODE } from "@/features/dashboard/api/market-overview";
import type { KbarTodayPoint } from "@/features/dashboard/api/types";
import { minuteKeyFromEpochMs } from "@/features/dashboard/lib/market-overview-mapper";
import { useOrderFlowBaseline } from "@/features/dashboard/hooks/use-order-flow-baseline";
import { useKbarCurrent } from "@/features/realtime/hooks/use-kbar-current";
import { upsertPoint } from "@/features/dashboard/lib/timeline-helpers";

interface UseKbarTimelineResult {
  indexPriceByMinuteTs: Record<number, number>;
  loading: boolean;
  error: string | null;
}

interface KbarTimelineBaselineInput {
  kbarToday: KbarTodayPoint[];
  loading: boolean;
  error: string | null;
  baselineReady: boolean;
}

type InternalPoint = { minuteTs: number; price: number };

export function useKbarTimelineFromBaseline(
  baseline: KbarTimelineBaselineInput,
  code: string = DEFAULT_ORDER_FLOW_CODE,
): UseKbarTimelineResult {
  const kbarCurrent = useKbarCurrent(code);
  const [internalSeries, setInternalSeries] = useState<InternalPoint[]>([]);
  const indexRef = useRef<Map<number, number>>(new Map());

  // Reset baseline
  useEffect(() => {
    const rows = (baseline.kbarToday ?? []).slice();
    // build ascending series by minuteTs
    const series: InternalPoint[] = rows
      .map((r) => ({ minuteTs: minuteKeyFromEpochMs(r.minute_ts), price: r.close }))
      .sort((a, b) => a.minuteTs - b.minuteTs);
    const m = new Map<number, number>();
    for (let i = 0; i < series.length; ++i) m.set(series[i].minuteTs, i);
    indexRef.current = m;
    setInternalSeries(series);
  }, [baseline.kbarToday]);

  // Patch realtime
  useEffect(() => {
    if (!baseline.baselineReady || !kbarCurrent) return;
    const minuteTs = minuteKeyFromEpochMs(kbarCurrent.minute_ts);
    const point: InternalPoint = { minuteTs, price: kbarCurrent.close };
    setInternalSeries((current) => {
      const { nextSeries, nextIndexMap, didChange } = upsertPoint(current, indexRef.current, point as any);
      if (!didChange) return current;
      indexRef.current = nextIndexMap;
      return nextSeries as InternalPoint[];
    });
  }, [baseline.baselineReady, kbarCurrent]);

  const indexPriceByMinuteTs = useMemo(() => {
    const out: Record<number, number> = {};
    for (const p of internalSeries) out[p.minuteTs] = p.price;
    return out;
  }, [internalSeries]);

  return {
    indexPriceByMinuteTs,
    loading: baseline.loading,
    error: baseline.error,
  };
}

export function useKbarTimeline(
  code: string = DEFAULT_ORDER_FLOW_CODE,
): UseKbarTimelineResult {
  const baseline = useOrderFlowBaseline(code);
  return useKbarTimelineFromBaseline(baseline, code);
}
