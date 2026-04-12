import type { CSSProperties, JSX } from "react";
import type { PieProps, PieSectorDataItem } from "recharts";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { Card } from "@/components/ui/card";
import { PanelCard } from "@/components/ui/panel-card";
import { Typography } from "@/components/ui/typography";
import { useT } from "@/lib/i18n";

interface GaugeSegment {
  name: string;
  value: number;
  fill: string;
}

interface HalfGaugeGeometry {
  width: number;
  height: number;
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
}

interface GapKlineDatum {
  symbol: string;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  close: number;
  current: number;
}

const KLINE_UP_COLOR = "#ef4444";
const KLINE_DOWN_COLOR = "#22c55e";

const NEEDLE_BASE_RADIUS_PX = 4;
const gaugeValues = [74, 66, 58, 82, 63];
const coreMetricValues = ["1.82%", "24.6K", "12"] as const;
const contributionMetricValues = ["+84", "+176", "612 / 356"] as const;
function buildOtcIntradaySeries(): Array<{
  time: string;
  value: number;
  change: number;
  upChange: number | null;
  downChange: number | null;
}> {
  const points: Array<{
    time: string;
    value: number;
    change: number;
    upChange: number | null;
    downChange: number | null;
  }> = [];

  const prevClose = 286.2;
  let value = prevClose + 0.35;
  const startHour = 9;
  const totalMinutes = 271;

  for (let i = 0; i < totalMinutes; i += 1) {
    const hour = startHour + Math.floor(i / 60);
    const minute = i % 60;
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

    const waveA = Math.sin((i + 1) * 0.085) * 0.24;
    const waveB = Math.cos((i + 1) * 0.032) * 0.17;
    const shock = i % 47 === 0 ? 0.32 : i % 53 === 0 ? -0.28 : 0;
    const drift = i < 120 ? 0.004 : i > 210 ? -0.003 : 0.001;
    value += waveA + waveB + shock + drift;
    value = Math.max(281.5, Math.min(294.8, value));

    const rounded = Number(value.toFixed(2));
    const change = Number((rounded - prevClose).toFixed(2));
    points.push({
      time,
      value: rounded,
      change,
      upChange: change >= 0 ? change : null,
      downChange: change < 0 ? change : null,
    });
  }

  return points;
}

const otcIndexSeries = buildOtcIntradaySeries();
const gapKlineData: GapKlineDatum[] = [
  { symbol: "TSMC", prevClose: 966, open: 978, high: 990, low: 962, close: 985, current: 988 },
  { symbol: "Delta", prevClose: 352, open: 347, high: 356, low: 342, close: 345, current: 344 },
  { symbol: "HonHai", prevClose: 204, open: 209, high: 214, low: 201, close: 212, current: 211 },
  { symbol: "MediaTek", prevClose: 1260, open: 1238, high: 1276, low: 1228, close: 1268, current: 1272 },
  { symbol: "OTC", prevClose: 262.1, open: 263.4, high: 265.2, low: 261.3, close: 264.6, current: 264.2 },
  { symbol: "Nikkei", prevClose: 39280, open: 39540, high: 39810, low: 39180, close: 39720, current: 39660 },
];

export function getHalfGaugeGeometry(): HalfGaugeGeometry {
  return {
    width: 144,
    height: 108,
    cx: 72,
    cy: 82,
    innerRadius: 24,
    outerRadius: 40,
  };
}

export function getNeedleStyle(
  midAngle: number,
  cx: number,
  cy: number,
): CSSProperties {
  return {
    transform: `rotate(-${midAngle}deg)`,
    transformOrigin: `${cx}px ${cy}px`,
  };
}

function Needle({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
}: PieSectorDataItem): JSX.Element | null {
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    typeof midAngle !== "number" ||
    typeof innerRadius !== "number" ||
    typeof outerRadius !== "number"
  ) {
    return null;
  }

  const needleLength = innerRadius + (outerRadius - innerRadius) / 2;

  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={NEEDLE_BASE_RADIUS_PX}
        fill="hsl(var(--foreground))"
        stroke="none"
      />
      <path
        d={`M${cx},${cy}l${needleLength},0`}
        strokeWidth={2}
        stroke="hsl(var(--foreground))"
        fill="hsl(var(--foreground))"
        style={getNeedleStyle(midAngle, cx, cy)}
      />
    </g>
  );
}

function HalfPie({
  data,
  isAnimationActive = false,
  ...props
}: PieProps & { data: GaugeSegment[] }): JSX.Element {
  const geometry = getHalfGaugeGeometry();

  return (
    <Pie
      {...props}
      stroke="none"
      dataKey="value"
      startAngle={180}
      endAngle={0}
      data={data}
      cx={geometry.cx}
      cy={geometry.cy}
      innerRadius={geometry.innerRadius}
      outerRadius={geometry.outerRadius}
      isAnimationActive={isAnimationActive}
    >
      {data.map((entry) => (
        <Cell key={entry.name} fill={entry.fill} />
      ))}
    </Pie>
  );
}

export function MetricNeedleChart({ index }: { index: number }): JSX.Element {
  const value = gaugeValues[index] ?? 50;
  const geometry = getHalfGaugeGeometry();
  const chartData: GaugeSegment[] = [
    { name: "active", value, fill: "hsl(var(--primary))" },
    { name: "rest", value: 100 - value, fill: "hsl(var(--muted))" },
  ];
  const needleLayerData: GaugeSegment[] = chartData.map((entry) => ({
    ...entry,
    fill: "transparent",
  }));

  return (
    <div
      className="flex min-h-0 flex-1 flex-col justify-center"
      data-testid="metric-needle-chart"
    >
      <div
        data-testid="panel-chart"
        className="flex min-h-0 flex-1 flex-col items-center justify-center py-2"
      >
        <div
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          data-testid="metric-needle-track"
        />
        <div
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          data-testid="metric-needle-active"
        />
        <div className="flex w-full justify-center">
          <div
            className="relative h-[108px] w-[144px] shrink-0"
            data-testid="metric-half-gauge"
          >
            <PieChart width={geometry.width} height={geometry.height}>
              <HalfPie data={chartData} />
              <HalfPie
                data={needleLayerData}
                activeIndex={0}
                activeShape={Needle}
              />
              <Tooltip defaultIndex={0} content={() => null} active />
            </PieChart>
          </div>
        </div>
        <div
          className="mt-1.5 text-center text-xs font-semibold leading-none text-foreground"
          data-testid="metric-needle-value"
        >
          <Typography as="p" variant="caption" className="font-mono font-semibold text-foreground">
            {value}
          </Typography>
        </div>
      </div>
    </div>
  );
}

function MetricMiniPanel({
  title,
  value,
  testId,
}: {
  title: string;
  value: string;
  testId: string;
}): JSX.Element {
  return (
    <Card
      className="flex h-full min-h-0 flex-col justify-center px-2 py-1.5"
      data-testid={testId}
    >
      <div className="space-y-0.5 text-center">
        <Typography as="p" variant="caption" className="truncate font-mono text-[10px] text-muted-foreground">
          {title}
        </Typography>
        <Typography as="p" variant="metric" className="text-foreground">
          {value}
        </Typography>
      </div>
    </Card>
  );
}

function OtcIndexLinePanel({ title }: { title: string }): JSX.Element {
  return (
    <PanelCard
      title={title}
      span={1}
      units={1}
      className="h-full"
      contentClassName="pt-[var(--panel-gap)]"
      data-testid="live-metrics-otc-line-panel"
    >
      <div className="h-[180px] min-h-[120px] w-full" data-testid="panel-chart">
        <ResponsiveContainer width="100%" aspect={2.4} minWidth={0} minHeight={120}>
          <AreaChart
            data={otcIndexSeries}
            margin={{ top: 8, right: 8, bottom: 2, left: -20 }}
          >
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 10 }}
              ticks={["09:00", "10:00", "11:00", "12:00", "13:00"]}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 10 }}
              domain={["dataMin - 0.3", "dataMax + 0.3"]}
              ticks={[0]}
              width={26}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border-strong))" strokeDasharray="3 3" />
            <Area
              dataKey="upChange"
              dot={false}
              fill="rgba(239, 68, 68, 0.18)"
              isAnimationActive={false}
              stroke="#ef4444"
              strokeWidth={1.8}
              type="linear"
            />
            <Area
              dataKey="downChange"
              dot={false}
              fill="rgba(34, 197, 94, 0.18)"
              isAnimationActive={false}
              stroke="#22c55e"
              strokeWidth={1.8}
              type="linear"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </PanelCard>
  );
}

function GapKlinePanelChart(): JSX.Element {
  const width = 620;
  const height = 190;
  const margin = { top: 16, right: 10, bottom: 50, left: 44 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const normalizedData = gapKlineData.map((item) => {
    const toPct = (value: number): number =>
      ((value - item.prevClose) / item.prevClose) * 100;

    return {
      ...item,
      openPct: toPct(item.open),
      highPct: toPct(item.high),
      lowPct: toPct(item.low),
      closePct: toPct(item.close),
      currentPct: toPct(item.current),
    };
  });
  const pctMin = Math.min(...normalizedData.map((item) => item.lowPct));
  const pctMax = Math.max(...normalizedData.map((item) => item.highPct));
  const paddedMin = pctMin - (pctMax - pctMin) * 0.08;
  const paddedMax = pctMax + (pctMax - pctMin) * 0.08;
  const tickCount = 5;
  const step = plotWidth / normalizedData.length;
  const bodyWidth = Math.min(34, step * 0.56);

  const yScale = (valuePct: number): number =>
    margin.top + ((paddedMax - valuePct) / (paddedMax - paddedMin)) * plotHeight;

  return (
    <div className="mt-[var(--panel-gap)] flex min-h-0 flex-1 flex-col" data-testid="live-metrics-gap-kline-chart">
      <div data-testid="panel-chart" className="h-full w-full">
        <svg className="h-full w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Six symbols gap candlestick overview">
          <rect x={0} y={0} width={width} height={height} fill="transparent" />
          {Array.from({ length: tickCount }).map((_, index) => {
            const ratio = index / (tickCount - 1);
            const pct = paddedMax - (paddedMax - paddedMin) * ratio;
            const y = margin.top + plotHeight * ratio;

            return (
              <g key={`grid-${index}`}>
                <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="hsl(var(--border-strong))" strokeDasharray="3 3" />
                <text
                  x={margin.left - 8}
                  y={y + 4}
                  fill="hsl(var(--subtle-foreground))"
                  fontSize={10}
                  textAnchor="end"
                >
                  {`${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`}
                </text>
              </g>
            );
          })}
          {normalizedData.map((item, index) => {
            const centerX = margin.left + step * index + step / 2;
            const openY = yScale(item.openPct);
            const closeY = yScale(item.closePct);
            const highY = yScale(item.highPct);
            const lowY = yScale(item.lowPct);
            const isUp = item.close >= item.open;
            const bodyY = Math.min(openY, closeY);
            const bodyHeight = Math.max(2, Math.abs(closeY - openY));
            const fill = isUp ? KLINE_UP_COLOR : KLINE_DOWN_COLOR;
            const gapPct = ((item.open - item.prevClose) / item.prevClose) * 100;

            return (
              <g key={item.symbol}>
                <line x1={centerX} x2={centerX} y1={highY} y2={lowY} stroke={fill} strokeWidth={1.6} />
                <rect
                  x={centerX - bodyWidth / 2}
                  y={bodyY}
                  width={bodyWidth}
                  height={bodyHeight}
                  fill={fill}
                  stroke="none"
                />
                <text
                  x={centerX}
                  y={height - 24}
                  fill="hsl(var(--subtle-foreground))"
                  fontSize={10}
                  textAnchor="middle"
                >
                  {item.symbol}
                </text>
                <text
                  x={centerX}
                  y={height - 10}
                  fill={gapPct >= 0 ? KLINE_UP_COLOR : KLINE_DOWN_COLOR}
                  fontSize={9}
                  textAnchor="middle"
                >
                  {`${gapPct >= 0 ? "+" : ""}${gapPct.toFixed(1)}%`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function DashboardMetricPanels(): JSX.Element {
  const t = useT();
  const needlePanels = [
    t("dashboard.metrics.needle.bidPressure"),
    t("dashboard.metrics.needle.shortRatio"),
    t("dashboard.metrics.needle.volatility"),
    t("dashboard.metrics.needle.momentum"),
    t("dashboard.metrics.needle.continuity"),
  ];
  let gaugeIndex = 0;
  const coreMetrics = [
    { label: t("dashboard.metrics.core.amplitude"), value: coreMetricValues[0] },
    { label: t("dashboard.metrics.core.projectedVolume"), value: coreMetricValues[1] },
    { label: t("dashboard.metrics.core.spread"), value: coreMetricValues[2] },
  ];
  const contributionMetrics = [
    { label: t("dashboard.metrics.contrib.tsmc"), value: contributionMetricValues[0] },
    { label: t("dashboard.metrics.contrib.top20"), value: contributionMetricValues[1] },
    { label: t("dashboard.metrics.contrib.breadth"), value: contributionMetricValues[2] },
  ];

  return (
    <BentoGridSection
      title={t("dashboard.liveMetrics")}
      gridClassName="h-full auto-rows-fr lg:grid-cols-12"
    >
      {needlePanels.map((panelLabel) => {
        return (
          <PanelCard
            key={panelLabel}
            title={panelLabel}
            span={1}
            units={1}
            className="h-full"
            contentClassName="pt-[var(--panel-gap)]"
            data-testid="dashboard-metric-panel"
          >
            <MetricNeedleChart index={gaugeIndex++} />
          </PanelCard>
        );
      })}
      <div
        className="grid h-full min-h-[var(--panel-row-h)] grid-rows-3 gap-2 lg:col-span-1"
        data-testid="live-metrics-core-column"
      >
        {coreMetrics.map((item) => (
          <MetricMiniPanel
            key={item.label}
            title={item.label}
            value={item.value}
            testId="live-metrics-core-card"
          />
        ))}
      </div>
      <div
        className="grid h-full min-h-[var(--panel-row-h)] grid-rows-3 gap-2 lg:col-span-1"
        data-testid="live-metrics-contribution-column"
      >
        {contributionMetrics.map((item) => (
          <MetricMiniPanel
            key={item.label}
            title={item.label}
            value={item.value}
            testId="live-metrics-contribution-card"
          />
        ))}
      </div>
      <OtcIndexLinePanel title={t("dashboard.metrics.otc.title")} />
      <PanelCard
        title={t("dashboard.gapK.title")}
        meta={t("dashboard.gapK.meta")}
        span={4}
        units={1}
        className="h-full"
        contentClassName="pt-[var(--panel-gap)]"
        data-testid="live-metrics-gap-panel"
      >
        <GapKlinePanelChart />
      </PanelCard>
    </BentoGridSection>
  );
}
