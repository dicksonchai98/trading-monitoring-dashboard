import type { JSX } from "react";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { PageLayout } from "@/components/ui/page-layout";
import { PanelCard } from "@/components/ui/panel-card";
import { DealerPositionChart } from "@/features/dashboard/components/PanelCharts";
import { useT } from "@/lib/i18n";

const signalKeyPairs = [
  { title: "dashboard.analysis.signal.nightSurge.title", note: "dashboard.analysis.signal.nightSurge.note" },
  { title: "dashboard.analysis.signal.nightDrop.title", note: "dashboard.analysis.signal.nightDrop.note" },
  { title: "dashboard.analysis.signal.gapUp.title", note: "dashboard.analysis.signal.gapUp.note" },
  { title: "dashboard.analysis.signal.gapDown.title", note: "dashboard.analysis.signal.gapDown.note" },
  { title: "dashboard.analysis.signal.foreignNetBuy.title", note: "dashboard.analysis.signal.foreignNetBuy.note" },
  { title: "dashboard.analysis.signal.foreignNetSell.title", note: "dashboard.analysis.signal.foreignNetSell.note" },
  { title: "dashboard.analysis.signal.volumeSpike.title", note: "dashboard.analysis.signal.volumeSpike.note" },
  { title: "dashboard.analysis.signal.volumeDry.title", note: "dashboard.analysis.signal.volumeDry.note" },
  { title: "dashboard.analysis.signal.volumeUpDayOverDay.title", note: "dashboard.analysis.signal.volumeUpDayOverDay.note" },
  { title: "dashboard.analysis.signal.volumeDownDayOverDay.title", note: "dashboard.analysis.signal.volumeDownDayOverDay.note" },
  { title: "dashboard.analysis.signal.largeTraderExcess.title", note: "dashboard.analysis.signal.largeTraderExcess.note" },
  { title: "dashboard.analysis.signal.largeTraderLight.title", note: "dashboard.analysis.signal.largeTraderLight.note" },
  { title: "dashboard.analysis.signal.dayNightUp.title", note: "dashboard.analysis.signal.dayNightUp.note" },
  { title: "dashboard.analysis.signal.dayNightDown.title", note: "dashboard.analysis.signal.dayNightDown.note" },
] as const;

export function HistoricalDataAnalysisOverview(): JSX.Element {
  const t = useT();

  return (
    <PageLayout
      title={t("dashboard.analysis.title")}
      actions={<Badge variant="success">{t("dashboard.analysis.connected")}</Badge>}
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <BentoGridSection title={t("dashboard.analysis.sectionTitle")} gridClassName="h-full auto-rows-fr lg:grid-cols-8">
        {signalKeyPairs.map((panel) => (
          <PanelCard
            key={panel.title}
            title={t(panel.title)}
            note={t(panel.note)}
            span={2}
            units={1}
            className="h-full"
            contentClassName="pt-[var(--panel-gap)]"
            data-testid="historical-signal-panel"
          >
            <DealerPositionChart />
          </PanelCard>
        ))}
      </BentoGridSection>
    </PageLayout>
  );
}
