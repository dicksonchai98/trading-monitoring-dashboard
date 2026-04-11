import { useMemo } from "react";
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

  const series = useMemo(
    () =>
      buildOrderFlowSeriesFromTimelineMaps(
        indexPriceByMinuteTs,
        chipDeltaByMinuteTs,
      ),
    [chipDeltaByMinuteTs, indexPriceByMinuteTs],
  );

  return {
    series,
    loading,
    error,
  };
}

interface UseMarketOverviewTimelineResult {
  series: OrderFlowSeriesPoint[];
  loading: boolean;
  error: string | null;
}
