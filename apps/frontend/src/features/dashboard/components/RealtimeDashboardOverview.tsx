import type { JSX } from "react";
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
import { DashboardMetricPanels } from "@/features/dashboard/components/DashboardMetricPanels";
import { RealtimeSseChartsSection } from "@/features/dashboard/components/RealtimeSseChartsSection";
import {
  BreadthDistributionChart,
  BidAskPressureChart,
  ProgramActivityChart,
  VolumeLadderChart,
} from "@/features/dashboard/components/PanelCharts";
import { EstimatedVolumeCard } from "@/features/dashboard/components/EstimatedVolumeCard";
import { useParticipantAmplitude } from "@/features/dashboard/hooks/use-participant-amplitude";
import { useMarketOverviewTimeline } from "@/features/dashboard/hooks/use-market-overview-timeline";
import { OrderFlowCard } from "@/features/dashboard/components/OrderFlowCard";

interface ParticipantSignalDatum {
  day: string;
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
  amplitude: number;
  isRealtime: boolean;
  wickColor: string;
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

  const range = Math.max(payload.high - payload.low, 1);
  const bodyHigh = Math.max(payload.open, payload.close);
  const bodyLow = Math.min(payload.open, payload.close);
  const bodyTop = y + ((payload.high - bodyHigh) / range) * height;
  const bodyBottom = y + ((payload.high - bodyLow) / range) * height;
  const bodyHeight = Math.max(2, bodyBottom - bodyTop);
  const centerX = x + width / 2;
  const bodyWidth = Math.max(6, width * 0.44);
  const bodyX = centerX - bodyWidth / 2;

  return (
    <g>
      <line x1={centerX} x2={centerX} y1={y} y2={y + height} stroke={payload.wickColor} strokeWidth={1.4} />
      <rect x={bodyX} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={payload.wickColor} stroke="none" />
    </g>
  );
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

  return (
    <PageLayout
      title="Futures Dashboard"
      actions={<Badge variant="success">SSE Connected</Badge>}
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <DashboardMetricPanels />

      <BentoGridSection title="MARKET OVERVIEW">
        <OrderFlowCard series={tickSeries} loading={tickLoading} error={tickError} />
        <PanelCard title="Volume Ladder" span={4} meta="5m buckets">
          <VolumeLadderChart tickSeries={tickSeries} />
        </PanelCard>
        <PanelCard title="Bid / Ask Pressure" span={4} meta="Depth skew">
          <BidAskPressureChart tickSeries={tickSeries} />
        </PanelCard>
        <PanelCard title="Program Activity" span={4} meta="Auto flow">
          <ProgramActivityChart tickSeries={tickSeries} />
        </PanelCard>
        <PanelCard title="漲跌家數" span={4} meta="Breadth distribution + swing">
          <BreadthDistributionChart />
        </PanelCard>
        <EstimatedVolumeCard />
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
        <PanelCard title="Participant Signals" span={10} units={2} meta="19日收盤 + 今日即時振幅">
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
                  <ComposedChart data={participantSignalData} margin={{ top: 8, right: 12, bottom: 0, left: -14 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border-strong))" strokeDasharray="3 3" />
                    <XAxis
                      axisLine={false}
                      dataKey="day"
                      tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="price"
                      axisLine={false}
                      tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 11 }}
                      tickLine={false}
                      width={56}
                      type="number"
                      domain={["dataMin - 40", "dataMax + 40"]}
                    />
                    <YAxis
                      yAxisId="amp"
                      axisLine={false}
                      orientation="right"
                      tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 11 }}
                      tickLine={false}
                      width={56}
                      type="number"
                      domain={["dataMin - 10", "dataMax + 10"]}
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
                    <Bar yAxisId="price" dataKey="high" shape={renderCandleShape} />
                    <Line yAxisId="amp" dataKey="amplitude" dot={false} stroke="#f59e0b" strokeWidth={2} type="linear" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[2px] w-4 bg-[#f59e0b]" />
                日振幅（點）
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[6px] w-[10px] rounded-[1px] bg-[#ef4444]" />
                上漲K
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[6px] w-[10px] rounded-[1px] bg-[#22c55e]" />
                下跌K
              </span>
            </div>
          </div>
        </PanelCard>
      </BentoGridSection>

      <RealtimeSseChartsSection />
    </PageLayout>
  );
}
