import { useMemo, useState, useEffect, useRef } from "react";
import { buildSeriesFromMaps } from "@/features/dashboard/lib/build-series-from-maps";
import { DEFAULT_ORDER_FLOW_CODE } from "@/features/dashboard/api/market-overview";
import {
  buildOrderFlowSeriesFromTimelineMaps,
  type OrderFlowSeriesPoint,
} from "@/features/dashboard/lib/market-overview-mapper";
import { useKbarTimelineFromBaseline } from "@/features/dashboard/hooks/use-kbar-timeline";
import { useMetricTimelineFromBaseline } from "@/features/dashboard/hooks/use-metric-timeline";
import { useOrderFlowBaseline } from "@/features/dashboard/hooks/use-order-flow-baseline";


export function useMarketOverviewTimeline(): UseMarketOverviewTimelineResult {
  const baseline = useOrderFlowBaseline(DEFAULT_ORDER_FLOW_CODE);
  const { indexPriceByMinuteTs, loading, error } = useKbarTimelineFromBaseline(
    baseline,
    DEFAULT_ORDER_FLOW_CODE,
  );
  const { chipDeltaByMinuteTs } = useMetricTimelineFromBaseline(
    baseline,
    DEFAULT_ORDER_FLOW_CODE,
  );

  const [series, setSeries] = useState<OrderFlowSeriesPoint[]>([]);
  const seriesRef = useRef<OrderFlowSeriesPoint[]>([]);
  const indexRef = useRef<Map<number, number>>(new Map());
  const prevIndexPriceRef = useRef<Record<number, number> | null>(null);
  const prevChipDeltaRef = useRef<Record<number, number> | null>(null);

  // Initial/baseline build or when baseline maps replaced entirely
  useEffect(() => {
    if (!indexPriceByMinuteTs && !chipDeltaByMinuteTs) return;
    const full = buildOrderFlowSeriesFromTimelineMaps(
      indexPriceByMinuteTs,
      chipDeltaByMinuteTs,
    );
    setSeries(full);
    seriesRef.current = full;

    const idxMap = new Map<number, number>();
    for (let i = 0; i < full.length; i++) {
      idxMap.set(full[i].minuteTs, i);
    }
    indexRef.current = idxMap;
    prevIndexPriceRef.current = { ...indexPriceByMinuteTs };
    prevChipDeltaRef.current = { ...chipDeltaByMinuteTs };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexPriceByMinuteTs, chipDeltaByMinuteTs]);

  useEffect(() => {
    const prevIndexPrice = prevIndexPriceRef.current;
    const prevChipDelta = prevChipDeltaRef.current;

    // If no previous, baseline effect handled it
    if (!prevIndexPrice || !prevChipDelta) return;

    // collect changed minute keys
    const changed = new Set<number>();

    for (const k of Object.keys(indexPriceByMinuteTs)) {
      const key = Number(k);
      if (prevIndexPrice[key] !== indexPriceByMinuteTs[key]) changed.add(key);
    }
    for (const k of Object.keys(prevIndexPrice)) {
      const key = Number(k);
      if (!(key in indexPriceByMinuteTs)) changed.add(key);
    }

    for (const k of Object.keys(chipDeltaByMinuteTs)) {
      const key = Number(k);
      if (prevChipDelta[key] !== chipDeltaByMinuteTs[key]) changed.add(key);
    }
    for (const k of Object.keys(prevChipDelta)) {
      const key = Number(k);
      if (!(key in chipDeltaByMinuteTs)) changed.add(key);
    }

    if (changed.size === 0) {
      prevIndexPriceRef.current = { ...indexPriceByMinuteTs };
      prevChipDeltaRef.current = { ...chipDeltaByMinuteTs };
      return;
    }

    let nextSeries = seriesRef.current.slice();
    const idxMap = new Map(indexRef.current);

    // Build a map of minuteTs -> full OrderFlowSeriesPoint for changed minutes
    const realtimePointMap: Record<string, OrderFlowSeriesPoint | undefined> = {};
    for (const minuteTs of Array.from(changed).sort((a, b) => a - b)) {
      const pointArr = buildOrderFlowSeriesFromTimelineMaps(
        { [minuteTs]: indexPriceByMinuteTs[minuteTs] ?? 0 },
        { [minuteTs]: chipDeltaByMinuteTs[minuteTs] ?? 0 },
      );
      const point = pointArr[0];
      if (!point) continue;
      realtimePointMap[String(minuteTs)] = point;
    }

    // Apply all changed points using shared helper to keep upsert logic consistent
    const { series: appliedSeries, indexMap: appliedIndexMap } = buildSeriesFromMaps(nextSeries, idxMap, realtimePointMap as any);

    // commit if changed
    if (appliedSeries !== nextSeries) {
      setSeries(appliedSeries as OrderFlowSeriesPoint[]);
      seriesRef.current = appliedSeries as OrderFlowSeriesPoint[];
      indexRef.current = appliedIndexMap as Map<number, number>;
    }

    prevIndexPriceRef.current = { ...indexPriceByMinuteTs };
    prevChipDeltaRef.current = { ...chipDeltaByMinuteTs };
  }, [indexPriceByMinuteTs, chipDeltaByMinuteTs]);

  const memoSeries = useMemo(() => series, [series]);

  return {
    series: memoSeries,
    loading,
    error,
  };
}

interface UseMarketOverviewTimelineResult {
  series: OrderFlowSeriesPoint[];
  loading: boolean;
  error: string | null;
}
