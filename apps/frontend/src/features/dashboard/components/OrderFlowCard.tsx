import type { JSX } from "react";
import { PanelCard } from "@/components/ui/panel-card";
import { OrderFlowChart } from "@/features/dashboard/components/PanelCharts";
import type { OrderFlowSeriesPoint } from "@/features/dashboard/lib/market-overview-mapper";

function OrderFlowState({ text }: { text: string }): JSX.Element {
  return (
    <div className="flex min-h-[180px] items-center justify-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

interface OrderFlowCardProps {
  series: OrderFlowSeriesPoint[];
  loading: boolean;
  error: string | null;
}

export function OrderFlowCard({ series, loading, error }: OrderFlowCardProps): JSX.Element {

  return (
    <PanelCard
      title="Order Flow"
      note="Tracks near-month transaction imbalance and directional participation shifts."
      span={4}
      units={2}
      data-testid="order-flow-card"
    >
      {loading ? (
        <OrderFlowState text="Loading TXFD6 order flow..." />
      ) : error ? (
        <OrderFlowState text="Unable to load order flow data." />
      ) : (
        <OrderFlowChart data={series} />
      )}
    </PanelCard>
  );
}
