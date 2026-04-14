import type { JSX } from "react";
import { MarketOverviewChartCard } from "@/features/dashboard/components/MarketOverviewChartCard";
import { VolumeLadderChart } from "@/features/dashboard/components/PanelCharts";
import type { MarketOverviewDatum } from "@/features/dashboard/components/PanelCharts";
import { useT } from "@/lib/i18n";

interface VolumeLadderCardProps {
  chartData: MarketOverviewDatum[];
  loading: boolean;
  error: string | null;
}

export function VolumeLadderCard({
  chartData,
  loading,
  error,
}: VolumeLadderCardProps): JSX.Element {
  const t = useT();
  return (
    <MarketOverviewChartCard
      title={t("dashboard.realtime.volumeLadder.title")}
      testId="volume-ladder-card"
      span={4}
      meta={t("dashboard.realtime.volumeLadder.meta")}
      loading={loading}
      error={error}
      hasData={chartData.length > 0}
      loadingText={t("dashboard.realtime.volumeLadder.loading")}
      errorText={t("dashboard.realtime.volumeLadder.error")}
      emptyText={t("dashboard.realtime.volumeLadder.empty")}
    >
      <VolumeLadderChart data={chartData} />
    </MarketOverviewChartCard>
  );
}

