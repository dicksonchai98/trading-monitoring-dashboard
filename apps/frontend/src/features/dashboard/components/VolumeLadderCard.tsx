import type { JSX } from "react";
import { MarketOverviewChartCard } from "@/features/dashboard/components/MarketOverviewChartCard";
import { VolumeLadderChart } from "@/features/dashboard/components/PanelCharts";
import type { OrderFlowSeriesPoint } from "@/features/dashboard/lib/market-overview-mapper";

interface VolumeLadderCardProps {
  series: OrderFlowSeriesPoint[];
  loading: boolean;
  error: string | null;
}

export function VolumeLadderCard({
  series,
  loading,
  error,
}: VolumeLadderCardProps): JSX.Element {
  return (
    <MarketOverviewChartCard
      title="Volume Ladder"
      testId="volume-ladder-card"
      span={4}
      meta="5m buckets"
      loading={loading}
      error={error}
      hasData={series.length > 0}
      loadingText="Loading volume ladder..."
      errorText="Unable to load volume ladder data."
      emptyText="No volume ladder data available."
    >
      <VolumeLadderChart data={series} />
    </MarketOverviewChartCard>
  );
}

