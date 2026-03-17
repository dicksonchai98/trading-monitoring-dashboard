import type { CSSProperties, JSX } from "react";
import type { PieProps, PieSectorDataItem } from "recharts";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import metricsConfig from "../../../../test.json";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { PanelCard } from "@/components/ui/panel-card";

interface MetricPanelConfig {
  key: string;
  label: string;
}

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
const numericValues = ["1.82%", "24.6K", "12"];
const gapKlineData: GapKlineDatum[] = [
  { symbol: "臺積電", prevClose: 966, open: 978, high: 990, low: 962, close: 985, current: 988 },
  { symbol: "臺達電", prevClose: 352, open: 347, high: 356, low: 342, close: 345, current: 344 },
  { symbol: "鴻海", prevClose: 204, open: 209, high: 214, low: 201, close: 212, current: 211 },
  { symbol: "聯發科", prevClose: 1260, open: 1238, high: 1276, low: 1228, close: 1268, current: 1272 },
  { symbol: "櫃買指數", prevClose: 262.1, open: 263.4, high: 265.2, low: 261.3, close: 264.6, current: 264.2 },
  { symbol: "日經指數", prevClose: 39280, open: 39540, high: 39810, low: 39180, close: 39720, current: 39660 },
];

export function getHalfGaugeGeometry(): HalfGaugeGeometry {
  return {
    width: 144,
    height: 60,
    cx: 67,
    cy: 40,
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

function getMetricConfigs(): MetricPanelConfig[] {
  return metricsConfig as MetricPanelConfig[];
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

function MetricNeedleChart({ index }: { index: number }): JSX.Element {
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
            className="relative h-[60px] w-[144px] shrink-0"
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
          {value}
        </div>
      </div>
    </div>
  );
}

function MetricValueCard({ index }: { index: number }): JSX.Element {
  const value = numericValues[index] ?? "--";

  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center py-2 text-center"
      data-testid="metric-value-card"
    >
      <div className="text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
    </div>
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
  let gaugeIndex = 0;
  let valueIndex = 0;

  return (
    <BentoGridSection
      title="LIVE METRICS"
      gridClassName="h-full auto-rows-fr lg:grid-cols-12"
    >
      {getMetricConfigs().map((panel) => {
        const content =
          panel.key === "piechart with needle" ? (
            <MetricNeedleChart index={gaugeIndex++} />
          ) : (
            <MetricValueCard index={valueIndex++} />
          );

        return (
          <PanelCard
            key={panel.label}
            title={panel.label}
            span={1}
            units={1}
            className="h-full"
            contentClassName="pt-[var(--panel-gap)]"
            data-testid="dashboard-metric-panel"
          >
            {content}
          </PanelCard>
        );
      })}
      <PanelCard
        title="6 Symbols Gap K"
        meta="Daily open/close + current"
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
