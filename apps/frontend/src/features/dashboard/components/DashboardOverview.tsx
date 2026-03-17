import type { JSX } from "react";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { PageLayout } from "@/components/ui/page-layout";
import { PanelCard } from "@/components/ui/panel-card";
import { DashboardMetricPanels } from "@/features/dashboard/components/DashboardMetricPanels";
import {
  BidAskPressureChart,
  DealerPositionChart,
  ForeignParticipationChart,
  OrderFlowChart,
  ProgramActivityChart,
  RetailPulseChart,
  SentimentTrendChart,
  VolumeLadderChart,
} from "@/features/dashboard/components/PanelCharts";

interface DashboardOverviewProps {
  title: string;
}

export function DashboardOverview({ title }: DashboardOverviewProps): JSX.Element {
  return (
    <PageLayout
      title={title}
      actions={<Badge variant="success">SSE Connected</Badge>}
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <DashboardMetricPanels />

      <BentoGridSection title="MARKET OVERVIEW">
        <PanelCard
          title="Order Flow"
          note="Tracks near-month transaction imbalance and directional participation shifts."
          span={8}
          units={2}
        >
          <OrderFlowChart />
        </PanelCard>
        <PanelCard title="Volume Ladder" span={4} meta="5m buckets">
          <VolumeLadderChart />
        </PanelCard>
        <PanelCard title="Bid / Ask Pressure" span={6} meta="Depth skew">
          <BidAskPressureChart />
        </PanelCard>
        <PanelCard title="Program Activity" span={6} meta="Auto flow">
          <ProgramActivityChart />
        </PanelCard>
      </BentoGridSection>

      <BentoGridSection title="PARTICIPANT OVERVIEW">
        <PanelCard title="Foreign" span={3} meta="Participation">
          <ForeignParticipationChart />
        </PanelCard>
        <PanelCard title="Dealer" span={3} meta="Position mix">
          <DealerPositionChart />
        </PanelCard>
        <PanelCard title="Retail" span={3} meta="Pulse">
          <RetailPulseChart />
        </PanelCard>
        <PanelCard title="Sentiment" span={3} meta="5-day drift">
          <SentimentTrendChart />
        </PanelCard>
      </BentoGridSection>
    </PageLayout>
  );
}
