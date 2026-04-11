import type { JSX } from "react";
import { MarketOverviewChartCard } from "@/features/dashboard/components/MarketOverviewChartCard";
import { OrderFlowChart } from "@/features/dashboard/components/PanelCharts";
import type { OrderFlowSeriesPoint } from "@/features/dashboard/lib/market-overview-mapper";

interface OrderFlowCardProps {
  series: OrderFlowSeriesPoint[];
  loading: boolean;
  error: string | null;
}

export function OrderFlowCard({ series, loading, error }: OrderFlowCardProps): JSX.Element {
  return (
    <MarketOverviewChartCard
      title="Order Flow"
      testId="order-flow-card"
      note="Tracks near-month transaction imbalance and directional participation shifts."
      span={4}
      units={2}
      loading={loading}
      error={error}
      hasData={series.length > 0}
      loadingText="Loading TXFD6 order flow..."
      errorText="Unable to load order flow data."
      emptyText="No order flow data available."
    >
      <OrderFlowChart data={series} />
    </MarketOverviewChartCard>
  );
}
