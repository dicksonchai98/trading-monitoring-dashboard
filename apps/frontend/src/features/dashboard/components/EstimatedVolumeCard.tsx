import type { JSX } from "react";
import { PanelCard } from "@/components/ui/panel-card";
import { EstimatedVolumeCompareChart } from "@/features/dashboard/components/PanelCharts";
import { useEstimatedVolumeTimeline } from "@/features/dashboard/hooks/use-estimated-volume-timeline";

function OrderFlowState({ text }: { text: string }): JSX.Element {
  return (
    <div className="flex min-h-[180px] items-center justify-center text-xs text-muted-foreground">
      {text}
    </div>
  );
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

export function EstimatedVolumeCard(): JSX.Element {
  const { series, latest, loading, error } = useEstimatedVolumeTimeline();
  const diff = latest ? latest.todayEstimated - latest.yesterdayEstimated : 0;
  const diffClassName = diff >= 0 ? "text-[#ef4444]" : "text-[#22c55e]";

  return (
    <PanelCard title="成交量量比" span={4} meta="昨日 vs 今日預估成交量" data-testid="estimated-volume-card">
      {loading ? (
        <OrderFlowState text="Loading estimated volume timeline..." />
      ) : error ? (
        <OrderFlowState text="Unable to load estimated volume data." />
      ) : (
        <>
          {latest ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span>目前時間 {latest.time}</span>
              <span>今日 {formatEstimate(latest.todayEstimated)}</span>
              <span>昨日 {formatEstimate(latest.yesterdayEstimated)}</span>
              <span className={diffClassName}>差值 {formatEstimate(diff)}</span>
            </div>
          ) : null}
          <EstimatedVolumeCompareChart data={series} />
        </>
      )}
    </PanelCard>
  );
}
