import { useMemo } from "react";
import type { OrderFlowSeriesPoint } from "@/features/dashboard/lib/market-overview-mapper";
import { buildSecondaryOverlaySeries } from "@/features/dashboard/lib/secondary-overlay-series";

export function useVolumeLadderSeries(
  tickSeries: OrderFlowSeriesPoint[],
  mainChipByMinute: Record<number, number>,
): OrderFlowSeriesPoint[] {
  return useMemo(
    () => buildSecondaryOverlaySeries(tickSeries, mainChipByMinute),
    [mainChipByMinute, tickSeries],
  );
}

