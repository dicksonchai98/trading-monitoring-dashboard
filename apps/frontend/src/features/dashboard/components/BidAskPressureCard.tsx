import type { JSX } from "react";
import { MarketOverviewChartCard } from "@/features/dashboard/components/MarketOverviewChartCard";
import { BidAskPressureChart } from "@/features/dashboard/components/PanelCharts";
import type { MarketOverviewDatum } from "@/features/dashboard/components/PanelCharts";
import { useT } from "@/lib/i18n";

interface BidAskPressureCardProps {
  chartData: MarketOverviewDatum[];
  loading: boolean;
  error: string | null;
}

export function BidAskPressureCard({
  chartData,
  loading,
  error,
}: BidAskPressureCardProps): JSX.Element {
  const t = useT();
  return (
    <MarketOverviewChartCard
      title={t("dashboard.realtime.bidAsk.title")}
      testId="bid-ask-pressure-card"
      span={4}
      meta={t("dashboard.realtime.bidAsk.meta")}
      loading={loading}
      error={error}
      hasData={chartData.length > 0}
      loadingText={t("dashboard.realtime.bidAsk.loading")}
      errorText={t("dashboard.realtime.bidAsk.error")}
      emptyText={t("dashboard.realtime.bidAsk.empty")}
    >
      <BidAskPressureChart data={chartData} />
    </MarketOverviewChartCard>
  );
}

