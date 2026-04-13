import type { JSX } from "react";
import { MarketOverviewChartCard } from "@/features/dashboard/components/MarketOverviewChartCard";
import { OrderFlowChart } from "@/features/dashboard/components/PanelCharts";
import type { OrderFlowSeriesPoint } from "@/features/dashboard/lib/market-overview-mapper";
import { useT } from "@/lib/i18n";

interface OrderFlowCardProps {
  series: OrderFlowSeriesPoint[];
  loading: boolean;
  error: string | null;
}

export function OrderFlowCard({ series, loading, error }: OrderFlowCardProps): JSX.Element {
  const t = useT();
  return (
    <MarketOverviewChartCard
      title={t("dashboard.realtime.orderFlow.title")}
      testId="order-flow-card"
      note={t("dashboard.realtime.orderFlow.note")}
      span={4}
      units={2}
      loading={loading}
      error={error}
      hasData={series.length > 0}
      loadingText={t("dashboard.realtime.orderFlow.loading")}
      errorText={t("dashboard.realtime.orderFlow.error")}
      emptyText={t("dashboard.realtime.orderFlow.empty")}
    >
      <OrderFlowChart data={series} />
    </MarketOverviewChartCard>
  );
}
