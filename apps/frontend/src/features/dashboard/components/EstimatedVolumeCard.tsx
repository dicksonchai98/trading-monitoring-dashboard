import type { JSX } from "react";
import { MarketOverviewChartCard } from "@/features/dashboard/components/MarketOverviewChartCard";
import { EstimatedVolumeCompareChart } from "@/features/dashboard/components/PanelCharts";
import type { EstimatedVolumeSeriesPoint } from "@/features/dashboard/lib/estimated-volume-mapper";
import { useT } from "@/lib/i18n";

interface EstimatedVolumeCardProps {
  series: EstimatedVolumeSeriesPoint[];
  latest: EstimatedVolumeSeriesPoint | null;
  loading: boolean;
  error: string | null;
}

function formatEstimate(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return `${Math.round(value)}`;
}

export function EstimatedVolumeCard({
  series,
  latest,
  loading,
  error,
}: EstimatedVolumeCardProps): JSX.Element {
  const t = useT();
  const diff = latest ? latest.todayEstimated - latest.yesterdayEstimated : 0;
  const diffClassName = diff >= 0 ? "text-[#ef4444]" : "text-[#22c55e]";

  return (
    <MarketOverviewChartCard
      title={t("dashboard.realtime.estimatedVolume.title")}
      testId="estimated-volume-card"
      span={4}
      meta={t("dashboard.realtime.estimatedVolume.meta")}
      loading={loading}
      error={error}
      hasData={series.length > 0}
      loadingText={t("dashboard.realtime.estimatedVolume.loading")}
      errorText={t("dashboard.realtime.estimatedVolume.error")}
      emptyText={t("dashboard.realtime.estimatedVolume.empty")}
    >
      <>
        {latest ? (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              {t("dashboard.realtime.estimatedVolume.latestTime")}:{" "}
              {latest.time}
            </span>
            <span>
              {t("dashboard.realtime.estimatedVolume.today")}:{" "}
              {formatEstimate(latest.todayEstimated)}
            </span>
            <span>
              {t("dashboard.realtime.estimatedVolume.yesterday")}:{" "}
              {formatEstimate(latest.yesterdayEstimated)}
            </span>
            <span className={diffClassName}>
              {t("dashboard.realtime.estimatedVolume.diff")}:{" "}
              {formatEstimate(diff)}
            </span>
          </div>
        ) : null}
        <EstimatedVolumeCompareChart data={series} />
      </>
    </MarketOverviewChartCard>
  );
}
