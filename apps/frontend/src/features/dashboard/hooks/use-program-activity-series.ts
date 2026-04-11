import { useMemo } from "react";
import type { OrderFlowSeriesPoint } from "@/features/dashboard/lib/market-overview-mapper";
import { buildSecondaryOverlaySeries } from "@/features/dashboard/lib/secondary-overlay-series";

export function useProgramActivitySeries(
  tickSeries: OrderFlowSeriesPoint[],
): OrderFlowSeriesPoint[] {
  return useMemo(() => buildSecondaryOverlaySeries(tickSeries), [tickSeries]);
}

