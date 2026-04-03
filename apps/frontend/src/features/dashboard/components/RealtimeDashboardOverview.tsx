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
import { useRealtimeConnection } from "@/features/realtime/hooks/use-realtime-connection";
import {
  BreadthDistributionChart,
  BidAskPressureChart,
  EstimatedVolumeCompareChart,
  OrderFlowChart,
  ProgramActivityChart,
  VolumeLadderChart,
} from "@/features/dashboard/components/PanelCharts";

interface ParticipantSignalDatum {
  day: string;
  open: number;
  high: number;
  low: number;
  close: number;
  amplitude: number;
  amplitude3: number;
  amplitude5: number;
  wickColor: string;
}

const participantRawData = [
  { day: "W1-D1", open: 22310, high: 22560, low: 22180, close: 22450 },
  { day: "W1-D2", open: 22420, high: 22690, low: 22330, close: 22410 },
  { day: "W1-D3", open: 22380, high: 22610, low: 22240, close: 22310 },
  { day: "W1-D4", open: 22310, high: 22480, low: 22090, close: 22160 },
  { day: "W1-D5", open: 22200, high: 22510, low: 22100, close: 22430 },
  { day: "W2-D1", open: 22390, high: 22710, low: 22280, close: 22580 },
  { day: "W2-D2", open: 22470, high: 22820, low: 22360, close: 22690 },
  { day: "W2-D3", open: 22600, high: 22920, low: 22480, close: 22740 },
  { day: "W2-D4", open: 22620, high: 22810, low: 22460, close: 22580 },
  { day: "W2-D5", open: 22630, high: 22980, low: 22520, close: 22890 },
];

function movingAverage(values: number[], index: number, windowSize: number): number {
  const from = Math.max(0, index - windowSize + 1);
  const slice = values.slice(from, index + 1);
  const total = slice.reduce((sum, current) => sum + current, 0);

  return Number((total / slice.length).toFixed(2));
}

const participantSignalData: ParticipantSignalDatum[] = participantRawData.map(
  (item, index, all) => {
    const amplitudes = all.slice(0, index + 1).map((x, i, arr) => {
      return x.high - x.low;
    });
    const amplitude = item.high - item.low;
    const amplitude3 = Math.round(
      movingAverage(amplitudes, amplitudes.length - 1, 3),
    );
    const amplitude5 = Math.round(
      movingAverage(amplitudes, amplitudes.length - 1, 5),
    );

    return {
      ...item,
      amplitude,
      amplitude3,
      amplitude5,
      wickColor: item.close >= item.open ? "#ef4444" : "#22c55e",
    };
  },
);

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
  const { connectionStatus } = useRealtimeConnection();

  return (
    <PageLayout
      title="Futures Dashboard"
      actions={<Badge variant={statusBadgeVariant(connectionStatus)}>{connectionStatus.toUpperCase()}</Badge>}
      bodyClassName="space-y-[var(--section-gap)]"
    >
      <DashboardMetricPanels />

      <BentoGridSection title="MARKET OVERVIEW">
        <PanelCard
          title="Order Flow"
          note="Tracks near-month transaction imbalance and directional participation shifts."
          span={4}
          units={2}
        >
          <OrderFlowChart />
        </PanelCard>
        <PanelCard title="Volume Ladder" span={4} meta="5m buckets">
          <VolumeLadderChart />
        </PanelCard>
        <PanelCard title="Bid / Ask Pressure" span={4} meta="Depth skew">
          <BidAskPressureChart />
        </PanelCard>
        <PanelCard title="Program Activity" span={4} meta="Auto flow">
          <ProgramActivityChart />
        </PanelCard>
        <PanelCard title="漲跌家數" span={4} meta="Breadth distribution + swing">
          <BreadthDistributionChart />
        </PanelCard>
        <PanelCard title="成交量量比" span={4} meta="昨日 vs 今日預估成交量">
          <EstimatedVolumeCompareChart />
        </PanelCard>
      </BentoGridSection>

      <BentoGridSection title="PARTICIPANT OVERVIEW">
        <PanelCard
          title="Amplitude Summary"
          span={2}
          note="Displays key amplitude references for short-term volatility context."
        >
          <div className="space-y-2 pt-[var(--panel-gap)] text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">5日均振幅</span>
              <span className="font-semibold text-foreground">2.48%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">10日平均振幅</span>
              <span className="font-semibold text-foreground">2.13%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">昨日振幅</span>
              <span className="font-semibold text-foreground">2.92%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">5日最高振幅</span>
              <span className="font-semibold text-[#ef4444]">3.34%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">5日最低振幅</span>
              <span className="font-semibold text-[#22c55e]">1.76%</span>
            </div>
          </div>
        </PanelCard>
        <PanelCard title="Participant Signals" span={10} units={2} meta="Foreign / Dealer / Retail / Sentiment">
          <div className="mt-[var(--panel-gap)] w-full" data-testid="participant-amplitude-chart">
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
                    domain={["dataMin - 20", "dataMax + 20"]}
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
                  <Line yAxisId="amp" dataKey="amplitude5" dot={false} stroke="#38bdf8" strokeWidth={2} type="linear" />
                  <Line yAxisId="amp" dataKey="amplitude3" dot={false} stroke="#a78bfa" strokeWidth={2} type="linear" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[2px] w-4 bg-[#f59e0b]" />
                當日振幅
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[2px] w-4 bg-[#38bdf8]" />
                5日平均振幅
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-[2px] w-4 bg-[#a78bfa]" />
                3日平均振幅
              </span>
            </div>
          </div>
        </PanelCard>
      </BentoGridSection>

      <RealtimeSseChartsSection />
    </PageLayout>
  );
}
