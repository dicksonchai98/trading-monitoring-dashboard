import { useEffect, useState, type CSSProperties, type JSX } from "react";
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
import metricsConfig from "../../../../test.json";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { Card } from "@/components/ui/card";
import { useKbarCurrent } from "@/features/realtime/hooks/use-kbar-current";
import { useMarketSummaryLatest } from "@/features/realtime/hooks/use-market-summary-latest";
import { useMetricLatest } from "@/features/realtime/hooks/use-metric-latest";
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
const GROUPED_INTEGER_FORMATTER = new Intl.NumberFormat("en-US");
const coreMetricLabels = ["振幅", "預估量", "價差"] as const;
const contributionMetrics = [
  { label: "臺積電貢獻點數", value: "+84" },
  { label: "權值前20貢獻點數", value: "+176" },
  { label: "上市漲跌家數", value: "612 / 356" },
];
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
  {
    symbol: "臺積電",
    prevClose: 966,
    open: 978,
    high: 990,
    low: 962,
    close: 985,
    current: 988,
  },
  {
    symbol: "臺達電",
    prevClose: 352,
    open: 347,
    high: 356,
    low: 342,
    close: 345,
    current: 344,
  },
  {
    symbol: "鴻海",
    prevClose: 204,
    open: 209,
    high: 214,
    low: 201,
    close: 212,
    current: 211,
  },
  {
    symbol: "聯發科",
    prevClose: 1260,
    open: 1238,
    high: 1276,
    low: 1228,
    close: 1268,
    current: 1272,
  },
  {
    symbol: "櫃買指數",
    prevClose: 262.1,
    open: 263.4,
    high: 265.2,
    low: 261.3,
    close: 264.6,
    current: 264.2,
  },
  {
    symbol: "日經指數",
    prevClose: 39280,
    open: 39540,
    high: 39810,
    low: 39180,
    close: 39720,
    current: 39660,
  },
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

function useStickyLatestNumber(
  value: number | null | undefined,
): number | null {
  const [latest, setLatest] = useState<number | null>(null);

  useEffect(() => {
    if (typeof value === "number" && Number.isFinite(value)) {
      setLatest(value);
    }
  }, [value]);

  return latest;
}

function formatFixed2(value: number): string {
  return value.toFixed(2);
}

function formatGroupedInteger(value: number): string {
  return GROUPED_INTEGER_FORMATTER.format(Math.trunc(value));
}

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCoreMetricValue(
  label: (typeof coreMetricLabels)[number],
  value: number | null,
): string {
  if (value === null) {
    return "--";
  }
  if (label === "預估量") {
    return formatGroupedInteger(value);
  }
  return formatFixed2(value);
}

function MainForceHalfGauge({
  percent,
}: {
  percent: number | null;
}): JSX.Element {
  const value = percent === null ? 0 : Math.max(0, Math.min(100, percent));
  const data: GaugeSegment[] = [
    { name: "active", value, fill: "#22c55e" },
    { name: "rest", value: 100 - value, fill: "rgba(148, 163, 184, 0.25)" },
  ];

  return (
    <div
      className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden"
      data-testid="live-metrics-main-force-gauge"
    >
      <div className="mx-auto w-full max-w-[240px]">
        <div className="flex justify-center">
          <PieChart width={240} height={132}>
            <Pie
              data={data}
              dataKey="value"
              startAngle={180}
              endAngle={0}
              cx={120}
              cy={120}
              innerRadius={66}
              outerRadius={96}
              stroke="none"
              isAnimationActive
              animationDuration={320}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </div>
      </div>
    </div>
  );
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

export function MetricNeedleChart({
  index,
  liveValue,
}: {
  index: number;
  liveValue?: number | null;
}): JSX.Element {
  const value = liveValue ?? gaugeValues[index] ?? 50;
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
        <p className="truncate text-[10px] text-muted-foreground">{title}</p>
        <p className="text-sm font-semibold tracking-tight text-foreground">
          {value}
        </p>
      </div>
    </Card>
  );
}

function OtcIndexLinePanel(): JSX.Element {
  return (
    <PanelCard
      title="OTC 櫃買指數"
      span={1}
      units={1}
      className="h-full"
      contentClassName="pt-[var(--panel-gap)]"
      data-testid="live-metrics-otc-line-panel"
    >
      <div className="h-full min-h-[120px] w-full" data-testid="panel-chart">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
            <ReferenceLine
              y={0}
              stroke="hsl(var(--border-strong))"
              strokeDasharray="3 3"
            />
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
    margin.top +
    ((paddedMax - valuePct) / (paddedMax - paddedMin)) * plotHeight;

  return (
    <div
      className="mt-[var(--panel-gap)] flex min-h-0 flex-1 flex-col"
      data-testid="live-metrics-gap-kline-chart"
    >
      <div data-testid="panel-chart" className="h-full w-full">
        <svg
          className="h-full w-full"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Six symbols gap candlestick overview"
        >
          <rect x={0} y={0} width={width} height={height} fill="transparent" />
          {Array.from({ length: tickCount }).map((_, index) => {
            const ratio = index / (tickCount - 1);
            const pct = paddedMax - (paddedMax - paddedMin) * ratio;
            const y = margin.top + plotHeight * ratio;

            return (
              <g key={`grid-${index}`}>
                <line
                  x1={margin.left}
                  x2={width - margin.right}
                  y1={y}
                  y2={y}
                  stroke="hsl(var(--border-strong))"
                  strokeDasharray="3 3"
                />
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
            const gapPct =
              ((item.open - item.prevClose) / item.prevClose) * 100;

            return (
              <g key={item.symbol}>
                <line
                  x1={centerX}
                  x2={centerX}
                  y1={highY}
                  y2={lowY}
                  stroke={fill}
                  strokeWidth={1.6}
                />
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
  const needlePanels = getMetricConfigs().filter(
    (panel) => panel.key === "piechart with needle",
  );
  const kbar = useKbarCurrent("TXFD6");
  const metric = useMetricLatest("TXFD6");
  const marketSummary = useMarketSummaryLatest("TXFD6");
  const stickyDayAmplitude = useStickyLatestNumber(kbar?.day_amplitude);
  const stickyEstimatedTurnover = useStickyLatestNumber(
    marketSummary?.estimated_turnover,
  );
  const stickySpread = useStickyLatestNumber(marketSummary?.spread);
  const stickyMainForceStrength = useStickyLatestNumber(
    metric?.main_force_big_order_strength,
  );
  let gaugeIndex = 0;
  const coreMetrics = [
    {
      label: "振幅",
      value: formatCoreMetricValue("振幅", stickyDayAmplitude),
    },
    {
      label: "預估量",
      value: formatCoreMetricValue("預估量", stickyEstimatedTurnover),
    },
    {
      label: "價差",
      value: formatCoreMetricValue("價差", stickySpread),
    },
  ];

  return (
    <BentoGridSection
      title="LIVE METRICS"
      gridClassName="h-full auto-rows-fr lg:grid-cols-12"
    >
      {needlePanels.map((panel, index) => {
        const mainForcePercent =
          stickyMainForceStrength === null
            ? null
            : stickyMainForceStrength * 100;
        const isMainForceCard = index === 0;
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
            {isMainForceCard ? (
              <MainForceHalfGauge percent={mainForcePercent} />
            ) : (
              <MetricNeedleChart index={gaugeIndex++} />
            )}
            {isMainForceCard ? (
              <p
                className="mt-0 text-center text-[10px] font-semibold leading-none text-muted-foreground"
                data-testid="live-metrics-main-force-strength"
              >
                {stickyMainForceStrength === null
                  ? "--"
                  : formatPercentage(stickyMainForceStrength)}
              </p>
            ) : null}
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
      <OtcIndexLinePanel />
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
