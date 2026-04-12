import type { JSX } from "react";
import { MarketOverviewChartCard } from "@/features/dashboard/components/MarketOverviewChartCard";
import { ProgramActivityChart } from "@/features/dashboard/components/PanelCharts";
import type { OrderFlowSeriesPoint } from "@/features/dashboard/lib/market-overview-mapper";

interface ProgramActivityCardProps {
  series: OrderFlowSeriesPoint[];
  loading: boolean;
  error: string | null;
}

export function ProgramActivityCard({
  series,
  loading,
  error,
}: ProgramActivityCardProps): JSX.Element {
  return (
    <MarketOverviewChartCard
      title="Program Activity"
      testId="program-activity-card"
      span={4}
      meta="Auto flow"
      loading={loading}
      error={error}
      hasData={series.length > 0}
      loadingText="Loading program activity..."
      errorText="Unable to load program activity data."
      emptyText="No program activity data available."
    >
      <ProgramActivityChart data={series} />
    </MarketOverviewChartCard>
  );
}

