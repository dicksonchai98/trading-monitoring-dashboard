import type { OrderFlowSeriesPoint } from "@/features/dashboard/lib/market-overview-mapper";

export function buildSecondaryOverlaySeries(
  tickSeries: OrderFlowSeriesPoint[],
  secondaryByMinuteTs: Record<number, number> = {},
): OrderFlowSeriesPoint[] {
  if (!tickSeries || tickSeries.length === 0) {
    return [];
  }

  const orderedTicks = [...tickSeries].sort((a, b) => a.minuteTs - b.minuteTs);
  let carrySecondary = 0;

  return orderedTicks.map((point) => {
    const secondary = secondaryByMinuteTs[point.minuteTs];
    if (typeof secondary === "number" && Number.isFinite(secondary)) {
      carrySecondary = secondary;
    }

    return {
      minuteTs: point.minuteTs,
      time: point.time,
      indexPrice: point.indexPrice,
      chipDelta: carrySecondary,
    };
  });
}

