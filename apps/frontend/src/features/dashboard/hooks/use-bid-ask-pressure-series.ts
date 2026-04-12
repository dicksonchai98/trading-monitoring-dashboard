import { useMemo } from "react";
import type { OrderFlowSeriesPoint } from "@/features/dashboard/lib/market-overview-mapper";
import { buildSecondaryOverlaySeries } from "@/features/dashboard/lib/secondary-overlay-series";

export function useBidAskPressureSeries(
  tickSeries: OrderFlowSeriesPoint[],
  longShortForceByMinute: Record<number, number>,
): OrderFlowSeriesPoint[] {
  return useMemo(
    () => buildSecondaryOverlaySeries(tickSeries, longShortForceByMinute),
    [longShortForceByMinute, tickSeries],
  );
}

