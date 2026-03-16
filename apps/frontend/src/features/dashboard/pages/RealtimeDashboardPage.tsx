import type { JSX } from "react";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { PageLayout } from "@/components/ui/page-layout";
import { PanelCard } from "@/components/ui/panel-card";

export function RealtimeDashboardPage(): JSX.Element {
  return (
    <PageLayout
      title="Futures Dashboard"
      actions={<Badge variant="success">SSE Connected</Badge>}
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <BentoGridSection title="MARKET OVERVIEW">
        <PanelCard
          title="Order Flow"
          note="Tracks near-month transaction imbalance and directional participation shifts."
          span={8}
          units={2}
        />
        <PanelCard title="Volume Ladder" span={4} />
        <PanelCard title="Bid / Ask Pressure" span={6} />
        <PanelCard title="Program Activity" span={6} />
      </BentoGridSection>

      <BentoGridSection title="PARTICIPANT OVERVIEW">
        <PanelCard title="Foreign" span={3} />
        <PanelCard title="Dealer" span={3} />
        <PanelCard title="Retail" span={3} />
        <PanelCard title="Sentiment" span={3} />
      </BentoGridSection>
    </PageLayout>
  );
}
