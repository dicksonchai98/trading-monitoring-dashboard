import type { JSX } from "react";
import { MarketOverviewChartCard } from "@/features/dashboard/components/MarketOverviewChartCard";
import { ProgramActivityChart } from "@/features/dashboard/components/PanelCharts";
import type { MarketOverviewDatum } from "@/features/dashboard/components/PanelCharts";
import { useT } from "@/lib/i18n";

interface ProgramActivityCardProps {
  chartData: MarketOverviewDatum[];
  loading: boolean;
  error: string | null;
}

export function ProgramActivityCard({
  chartData,
  loading,
  error,
}: ProgramActivityCardProps): JSX.Element {
  const t = useT();
  return (
    <MarketOverviewChartCard
      title={t("dashboard.realtime.programActivity.title")}
      testId="program-activity-card"
      span={4}
      meta={t("dashboard.realtime.programActivity.meta")}
      loading={loading}
      error={error}
      hasData={chartData.length > 0}
      loadingText={t("dashboard.realtime.programActivity.loading")}
      errorText={t("dashboard.realtime.programActivity.error")}
      emptyText={t("dashboard.realtime.programActivity.empty")}
    >
      <ProgramActivityChart data={chartData} />
    </MarketOverviewChartCard>
  );
}

