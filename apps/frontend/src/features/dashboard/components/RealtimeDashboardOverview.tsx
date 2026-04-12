import type { JSX } from "react";
import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { PageLayout } from "@/components/ui/page-layout";
import { PanelCard } from "@/components/ui/panel-card";
import { BidAskPressureCard } from "@/features/dashboard/components/BidAskPressureCard";
import { DashboardMetricPanels } from "@/features/dashboard/components/DashboardMetricPanels";
import { EstimatedVolumeCard } from "@/features/dashboard/components/EstimatedVolumeCard";
import { OrderFlowCard } from "@/features/dashboard/components/OrderFlowCard";
import {
  BreadthDistributionChart,
} from "@/features/dashboard/components/PanelCharts";
import { ProgramActivityCard } from "@/features/dashboard/components/ProgramActivityCard";
import { VolumeLadderCard } from "@/features/dashboard/components/VolumeLadderCard";
import { useBidAskPressureSeries } from "@/features/dashboard/hooks/use-bid-ask-pressure-series";
import { useEstimatedVolumeTimeline } from "@/features/dashboard/hooks/use-estimated-volume-timeline";
import { useParticipantAmplitude } from "@/features/dashboard/hooks/use-participant-amplitude";
import { useProgramActivitySeries } from "@/features/dashboard/hooks/use-program-activity-series";
import { useQuoteTimeline } from "@/features/dashboard/hooks/use-quote-timeline";
import { useVolumeLadderSeries } from "@/features/dashboard/hooks/use-volume-ladder-series";
import {
  type ParticipantSignalWithMaPoint,
  withAmplitudeMovingAverages,
} from "@/features/dashboard/lib/participant-signals";
import { useMarketOverviewTimeline } from "@/features/dashboard/hooks/use-market-overview-timeline";

interface ParticipantSignalDatum {
  day: string;
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  amplitude: number;
  ampOpen?: number;
  ampHigh?: number;
  ampLow?: number;
  ampClose?: number;
}

function formatAmplitude(value: number): string {
  if (!Number.isFinite(value)) {
    return "0 點";
  }
  return `${value.toFixed(1)} 點`;
}

function renderCandleShape(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: ParticipantSignalDatum;
}): JSX.Element | null {
  const { x, y, width, height, payload } = props;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number" ||
    !payload
  ) {
    return null;
  }

  const amplitudePayload = payload as ParticipantSignalDatum;
  const ampHigh =
    typeof amplitudePayload.ampHigh === "number" ? amplitudePayload.ampHigh : payload.amplitude;
  const ampLow = typeof amplitudePayload.ampLow === "number" ? amplitudePayload.ampLow : payload.amplitude;
  const ampOpen =
    typeof amplitudePayload.ampOpen === "number" ? amplitudePayload.ampOpen : payload.amplitude;
  const ampClose =
    typeof amplitudePayload.ampClose === "number" ? amplitudePayload.ampClose : payload.amplitude;

  const range = Math.max(ampHigh - ampLow, 1);
  const bodyHigh = Math.max(ampOpen, ampClose);
  const bodyLow = Math.min(ampOpen, ampClose);
  const bodyTop = y + ((ampHigh - bodyHigh) / range) * height;
  const bodyBottom = y + ((ampHigh - bodyLow) / range) * height;
  const bodyHeight = Math.max(2, bodyBottom - bodyTop);
  const centerX = x + width / 2;
  const bodyWidth = Math.max(6, width * 0.44);
  const bodyX = centerX - bodyWidth / 2;
  const color = "#ef4444";

  return (
    <g>
      <line x1={centerX} x2={centerX} y1={y} y2={y + height} stroke={color} strokeWidth={1.4} />
      <rect x={bodyX} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} stroke="none" />
    </g>
  );
}

function statusBadgeVariant(status: string): "success" | "warning" | "danger" | "neutral" {
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
  const volumeLadderSeries = useVolumeLadderSeries(tickSeries, mainChipByMinute);
  const bidAskPressureSeries = useBidAskPressureSeries(
    tickSeries,
    longShortForceByMinute,
  );
  const programActivitySeries = useProgramActivitySeries(tickSeries);
  const participantChartData = useMemo(
    () => withAmplitudeMovingAverages(participantSignalData),
    [participantSignalData],
  );
  const participantAmplitudeMax = useMemo(() => {
    const maxValue = participantChartData.reduce((currentMax, point) => {
      const maMax = Math.max(point.ma3 ?? 0, point.ma5 ?? 0, point.ma10 ?? 0);
      return Math.max(currentMax, point.ampHigh, maMax);
    }, 0);
    return Math.max(10, Math.ceil(maxValue + 5));
  }, [participantChartData]);

  return (
    <PageLayout
      title="Futures Dashboard"
      actions={<Badge variant={statusBadgeVariant(connectionStatus)}>{connectionStatus.toUpperCase()}</Badge>}
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <DashboardMetricPanels />

      <BentoGridSection title="MARKET OVERVIEW">
        <OrderFlowCard series={tickSeries} loading={tickLoading} error={tickError} />
        <VolumeLadderCard
          series={volumeLadderSeries}
          loading={tickLoading || quoteLoading}
          error={tickError ?? quoteError}
        />
        <BidAskPressureCard
          series={bidAskPressureSeries}
          loading={tickLoading || quoteLoading}
          error={tickError ?? quoteError}
        />
        <ProgramActivityCard
          series={programActivitySeries}
          loading={tickLoading}
          error={tickError}
        />
        <PanelCard title="漲跌家數" span={4} meta="Breadth distribution + swing">
          <BreadthDistributionChart />
        </PanelCard>
        <EstimatedVolumeCard
          series={estimatedVolumeSeries}
          latest={estimatedVolumeLatest}
          loading={estimatedVolumeLoading}
          error={estimatedVolumeError}
        />
      </BentoGridSection>

      <BentoGridSection title="PARTICIPANT OVERVIEW">
        <PanelCard
          title="Amplitude Summary"
          span={2}
          note="Computed from closed trading days only."
        >
          <div className="space-y-2 pt-[var(--panel-gap)] text-xs" data-testid="participant-amplitude-summary">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">5日平均振幅</span>
              <span className="font-semibold text-foreground">{formatAmplitude(summary.avg5)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">10日平均振幅</span>
              <span className="font-semibold text-foreground">{formatAmplitude(summary.avg10)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">昨日振幅</span>
              <span className="font-semibold text-foreground">{formatAmplitude(summary.yesterday)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">5日最高振幅</span>
              <span className="font-semibold text-[#ef4444]">{formatAmplitude(summary.max5)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">10日最高振幅</span>
              <span className="font-semibold text-[#22c55e]">{formatAmplitude(summary.max10)}</span>
            </div>
          </div>
        </PanelCard>
        <PanelCard title="Participant Signals" span={10} units={2} meta="振幅K棒（影線=高低、實體=Open/Close）">
          <div className="mt-[var(--panel-gap)] w-full" data-testid="participant-amplitude-chart">
            {participantLoading ? (
              <div className="flex h-[240px] items-center justify-center text-xs text-muted-foreground">
                Loading participant amplitude...
              </div>
            ) : participantError ? (
              <div className="flex h-[240px] items-center justify-center text-xs text-muted-foreground">
                Unable to load participant amplitude.
              </div>
            ) : (
              <div data-testid="panel-chart" className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <ComposedChart
                    data={participantChartData as ParticipantSignalWithMaPoint[]}
                    margin={{ top: 8, right: 12, bottom: 0, left: -14 }}
                  >
                    <CartesianGrid vertical={false} stroke="hsl(var(--border-strong))" strokeDasharray="3 3" />
                    <XAxis
                      axisLine={false}
                      dataKey="day"
                      tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="amp"
                      axisLine={false}
                      tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 11 }}
                      tickFormatter={(value) => `${value}`}
                      tickLine={false}
                      width={56}
                      type="number"
                      domain={[0, participantAmplitudeMax]}
                      tickCount={8}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "4px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Bar
                      yAxisId="amp"
                      dataKey="ampHigh"
                      shape={renderCandleShape}
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="amp"
                      dataKey="ma3"
                      dot={false}
                      stroke="#38bdf8"
                      strokeWidth={1.5}
                      type="linear"
                      connectNulls
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="amp"
                      dataKey="ma5"
                      dot={false}
                      stroke="#22c55e"
                      strokeWidth={1.5}
                      type="linear"
                      connectNulls
                      isAnimationActive={false}
                    />
                    <Line
                      yAxisId="amp"
                      dataKey="ma10"
                      dot={false}
                      stroke="#a855f7"
                      strokeWidth={1.5}
                      type="linear"
                      connectNulls
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[6px] w-[10px] rounded-[1px] bg-[#ef4444]" />
                K棒（振幅）
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[2px] w-4 bg-[#38bdf8]" />
                MA3
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[2px] w-4 bg-[#22c55e]" />
                MA5
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[2px] w-4 bg-[#a855f7]" />
                MA10
              </span>
            </div>
          </div>
        </PanelCard>
      </BentoGridSection>
    </PageLayout>
  );
}

