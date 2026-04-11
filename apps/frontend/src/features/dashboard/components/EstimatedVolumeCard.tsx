import type { JSX } from "react";
import type { EstimatedVolumeSeriesPoint } from "@/features/dashboard/lib/estimated-volume-mapper";
import { MarketOverviewChartCard } from "@/features/dashboard/components/MarketOverviewChartCard";
import { EstimatedVolumeCompareChart } from "@/features/dashboard/components/PanelCharts";

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
  const diff = latest ? latest.todayEstimated - latest.yesterdayEstimated : 0;
  const diffClassName = diff >= 0 ? "text-[#ef4444]" : "text-[#22c55e]";

  return (
    <MarketOverviewChartCard
      title="成交量量比"
      testId="estimated-volume-card"
      span={4}
      meta="昨日 vs 今日預估成交量"
      loading={loading}
      error={error}
      hasData={series.length > 0}
      loadingText="Loading estimated volume timeline..."
      errorText="Unable to load estimated volume data."
      emptyText="No estimated volume data available."
    >
      <>
        {latest ? (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span>時間 {latest.time}</span>
            <span>今日 {formatEstimate(latest.todayEstimated)}</span>
            <span>昨日 {formatEstimate(latest.yesterdayEstimated)}</span>
            <span className={diffClassName}>差值 {formatEstimate(diff)}</span>
          </div>
        ) : null}
        <EstimatedVolumeCompareChart data={series} />
      </>
    </MarketOverviewChartCard>
  );
}

