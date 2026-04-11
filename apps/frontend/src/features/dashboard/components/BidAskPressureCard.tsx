import type { JSX } from "react";
import { MarketOverviewChartCard } from "@/features/dashboard/components/MarketOverviewChartCard";
import { BidAskPressureChart } from "@/features/dashboard/components/PanelCharts";
import type { OrderFlowSeriesPoint } from "@/features/dashboard/lib/market-overview-mapper";

interface BidAskPressureCardProps {
  series: OrderFlowSeriesPoint[];
  loading: boolean;
  error: string | null;
}

export function BidAskPressureCard({
  series,
  loading,
  error,
}: BidAskPressureCardProps): JSX.Element {
  return (
    <MarketOverviewChartCard
      title="Bid / Ask Pressure"
      testId="bid-ask-pressure-card"
      span={4}
      meta="Depth skew"
      loading={loading}
      error={error}
      hasData={series.length > 0}
      loadingText="Loading bid / ask pressure..."
      errorText="Unable to load bid / ask pressure data."
      emptyText="No bid / ask pressure data available."
    >
      <BidAskPressureChart data={series} />
    </MarketOverviewChartCard>
  );
}

