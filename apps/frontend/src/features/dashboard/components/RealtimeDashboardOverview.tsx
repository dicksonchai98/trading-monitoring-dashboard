import type { JSX } from "react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { PageLayout } from "@/components/ui/page-layout";
import { SpotMarketDistributionCard } from "@/features/dashboard/components/SpotMarketDistributionCard";
import { BidAskPressureCard } from "@/features/dashboard/components/BidAskPressureCard";
import { DashboardMetricPanels } from "@/features/dashboard/components/DashboardMetricPanels";
import { EstimatedVolumeCard } from "@/features/dashboard/components/EstimatedVolumeCard";
import { OrderFlowCard } from "@/features/dashboard/components/OrderFlowCard";
import { ParticipantAmplitudeSummaryCard } from "@/features/dashboard/components/ParticipantAmplitudeSummaryCard";
import { ParticipantSignalsCard } from "@/features/dashboard/components/ParticipantSignalsCard";
import { useRealtimeConnection } from "@/features/realtime/hooks/use-realtime-connection";
import { TrendIndexCard } from "@/features/dashboard/components/TrendIndexCard";
import { VolumeLadderCard } from "@/features/dashboard/components/VolumeLadderCard";
import { useBidAskPressureSeries } from "@/features/dashboard/hooks/use-bid-ask-pressure-series";
import { useEstimatedVolumeTimeline } from "@/features/dashboard/hooks/use-estimated-volume-timeline";
import { useParticipantAmplitude } from "@/features/dashboard/hooks/use-participant-amplitude";
import { useQuoteTimeline } from "@/features/dashboard/hooks/use-quote-timeline";
import { useVolumeLadderSeries } from "@/features/dashboard/hooks/use-volume-ladder-series";
import { toOrderFlowMarketData } from "@/features/dashboard/components/PanelCharts";
import { useMarketOverviewTimeline } from "@/features/dashboard/hooks/use-market-overview-timeline";
import { useT } from "@/lib/i18n";

function statusBadgeVariant(
  status: string,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "connected") {
    return "success";
  }
  if (status === "retrying" || status === "connecting") {
    return "warning";
  }
  if (status === "error") {
    return "danger";
  }
  return "neutral";
}

export function RealtimeDashboardOverview(): JSX.Element {
  const t = useT();
  const { connectionStatus } = useRealtimeConnection();

  const {
    series: tickSeries,
    loading: tickLoading,
    error: tickError,
  } = useMarketOverviewTimeline();
  const {
    summary,
    series: participantSignalData,
    loading: participantLoading,
    error: participantError,
  } = useParticipantAmplitude();
  const {
    series: estimatedVolumeSeries,
    latest: estimatedVolumeLatest,
    loading: estimatedVolumeLoading,
    error: estimatedVolumeError,
  } = useEstimatedVolumeTimeline();
  const {
    mainChipByMinute,
    longShortForceByMinute,
    loading: quoteLoading,
    error: quoteError,
  } = useQuoteTimeline();
  const volumeLadderSeries = useVolumeLadderSeries(
    tickSeries,
    mainChipByMinute,
  );
  const bidAskPressureSeries = useBidAskPressureSeries(
    tickSeries,
    longShortForceByMinute,
  );
  const orderFlowChartData = useMemo(
    () => toOrderFlowMarketData(tickSeries),
    [tickSeries],
  );
  const volumeLadderChartData = useMemo(
    () => toOrderFlowMarketData(volumeLadderSeries),
    [volumeLadderSeries],
  );
  const bidAskPressureChartData = useMemo(
    () => toOrderFlowMarketData(bidAskPressureSeries),
    [bidAskPressureSeries],
  );
  return (
    <PageLayout
      title={t("dashboard.realtime.title")}
      actions={
        <Badge variant={statusBadgeVariant(connectionStatus)}>
          {connectionStatus.toUpperCase()}
        </Badge>
      }
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <DashboardMetricPanels />

      <BentoGridSection title={t("dashboard.realtime.marketOverview")}>
        <OrderFlowCard
          chartData={orderFlowChartData}
          loading={tickLoading}
          error={tickError}
        />
        <VolumeLadderCard
          chartData={volumeLadderChartData}
          loading={tickLoading || quoteLoading}
          error={tickError ?? quoteError}
        />
        <BidAskPressureCard
          chartData={bidAskPressureChartData}
          loading={tickLoading || quoteLoading}
          error={tickError ?? quoteError}
        />
        <TrendIndexCard />
        <SpotMarketDistributionCard />
        <EstimatedVolumeCard
          series={estimatedVolumeSeries}
          latest={estimatedVolumeLatest}
          loading={estimatedVolumeLoading}
          error={estimatedVolumeError}
        />
      </BentoGridSection>

      <BentoGridSection
        tooltip={`此区块为显示N日的振幅统计`}
        title={t("dashboard.realtime.participantOverview")}
      >
        <ParticipantAmplitudeSummaryCard summary={summary} />
        <ParticipantSignalsCard
          series={participantSignalData}
          loading={participantLoading}
          error={participantError}
        />
      </BentoGridSection>
    </PageLayout>
  );
}
