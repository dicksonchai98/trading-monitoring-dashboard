import type { JSX } from "react";
import { PanelCard } from "@/components/ui/panel-card";
import { OrderFlowChart } from "@/features/dashboard/components/PanelCharts";
import { useMarketOverviewTimeline } from "@/features/dashboard/hooks/use-market-overview-timeline";

function OrderFlowState({ text }: { text: string }): JSX.Element {
  return (
    <div className="flex min-h-[180px] items-center justify-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

export function OrderFlowCard(): JSX.Element {
  const { series, loading, error } = useMarketOverviewTimeline();

  return (
    <PanelCard
      title="Order Flow"
      note="Tracks near-month transaction imbalance and directional participation shifts."
      span={4}
      units={2}
      data-testid="order-flow-card"
    >
      {loading ? (
        <OrderFlowState text="Loading TXF order flow..." />
      ) : error ? (
        <OrderFlowState text="Unable to load order flow data." />
      ) : (
        <OrderFlowChart data={series} />
      )}
    </PanelCard>
  );
}
