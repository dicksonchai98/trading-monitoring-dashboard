import { useEffect, useState, type CSSProperties, type JSX } from "react";
import type { PieProps, PieSectorDataItem } from "recharts";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
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
import { useQuoteLatest } from "@/features/realtime/hooks/use-quote-latest";
import { useSpotLatestList } from "@/features/realtime/hooks/use-spot-latest-list";
import { useOtcIndexSeries } from "@/features/dashboard/hooks/use-otc-index-series";
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
  open: number;
  high: number;
  low: number;
  close: number;
  changePct: number;
}

const KLINE_UP_COLOR = "#ef4444";
const KLINE_DOWN_COLOR = "#22c55e";
const GAP_K_SYMBOLS = ["2330", "2317", "2454", "2308", "2881", "6505"] as const;

const NEEDLE_BASE_RADIUS_PX = 4;
const gaugeValues = [74, 66, 58, 82, 63];
const GROUPED_INTEGER_FORMATTER = new Intl.NumberFormat("en-US");
const coreMetricLabels = ["\u6210\u4ea4\u632f\u5e45", "\u9810\u4f30\u6210\u4ea4\u91cf", "\u50f9\u5dee"] as const;
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
const EMPTY_GAP_ROW: GapKlineDatum = {
  symbol: "",
  open: 0,
  high: 0,
  low: 0,
  close: 0,
  changePct: 0,
};

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

function formatYiUnit(value: number): string {
  return `${(value / 100_000_000).toFixed(2)}\u5104`;
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
  if (label === "\u9810\u4f30\u6210\u4ea4\u91cf") {
    return formatYiUnit(value);
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
              isAnimationActive={false}
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
  const { series } = useOtcIndexSeries();
  const chartData = series;
  const xTicks =
    chartData.length > 0
      ? [
          chartData[0]?.minuteTs,
          chartData.find((point) => point.time === "10:00")?.minuteTs,
          chartData.find((point) => point.time === "11:00")?.minuteTs,
          chartData.find((point) => point.time === "12:00")?.minuteTs,
          chartData.find((point) => point.time === "13:00")?.minuteTs,
          chartData[chartData.length - 1]?.minuteTs,
        ].filter((value): value is number => typeof value === "number")
      : [];
  const latest = chartData[chartData.length - 1];
  const latestValue =
    latest && Number.isFinite(latest.value) ? latest.value.toFixed(2) : "--";
  const latestChange =
    latest && Number.isFinite(latest.change)
      ? `${latest.change >= 0 ? "+" : ""}${latest.change.toFixed(2)}`
      : "--";
  const latestChangeColor =
    latest && Number.isFinite(latest.change)
      ? latest.change >= 0
        ? "text-red-500"
        : "text-green-500"
      : "text-muted-foreground";

  return (
    <PanelCard
      title="OTC Index"
      span={1}
      units={1}
      className="h-full"
      contentClassName="pt-[var(--panel-gap)]"
      data-testid="live-metrics-otc-line-panel"
    >
      <div className="mb-1 flex items-center justify-end gap-2 text-xs">
        <span className="font-semibold text-foreground" data-testid="otc-latest-value">
          {latestValue}
        </span>
        <span className={latestChangeColor} data-testid="otc-latest-change">
          {latestChange}
        </span>
      </div>
      {chartData.length === 0 ? (
        <div className="flex h-full min-h-[120px] items-center justify-center text-xs text-muted-foreground">
          No OTC data
        </div>
      ) : (
        <div className="h-full min-h-[120px] w-full" data-testid="panel-chart">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, bottom: 2, left: -8 }}
            >
              <XAxis
                dataKey="minuteTs"
                domain={["dataMin", "dataMax"]}
                scale="time"
                type="number"
                axisLine={false}
                tickLine={false}
                tick={false}
                ticks={xTicks}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 10 }}
                domain={["dataMin - 0.2", "dataMax + 0.2"]}
                width={32}
                tickFormatter={(value) => Number(value).toFixed(0)}
              />
              <Tooltip
                formatter={(value) => [Number(value).toFixed(2), "OTC"]}
                labelFormatter={(label) =>
                  new Date(Number(label)).toLocaleString("zh-TW", {
                    hour12: false,
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Taipei",
                  })
                }
                contentStyle={{
                  backgroundColor: "rgba(15, 23, 42, 0.94)",
                  border: "1px solid rgba(248, 250, 252, 0.16)",
                  borderRadius: 8,
                  padding: "8px 10px",
                }}
                labelStyle={{
                  color: "#f8fafc",
                  fontSize: 12,
                  lineHeight: "16px",
                  marginBottom: 4,
                }}
                itemStyle={{
                  color: "#fecaca",
                  fontSize: 12,
                  lineHeight: "16px",
                }}
              />
              <Area
                dataKey="value"
                dot={false}
                fill="rgba(239, 68, 68, 0.18)"
                isAnimationActive={false}
                stroke="#ef4444"
                strokeWidth={1.8}
                type="linear"
              />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      )}
    </PanelCard>
  );
}

function GapKlinePanelChart(): JSX.Element {
  const spotLatestList = useSpotLatestList();
  const [sessionOpenBySymbol, setSessionOpenBySymbol] = useState<
    Record<string, number>
  >({});
  const spotBySymbol = new Map(
    (spotLatestList?.items ?? []).map((item) => [item.symbol, item]),
  );

  useEffect(() => {
    const incoming = spotLatestList?.items ?? [];
    if (incoming.length === 0) {
      return;
    }
    setSessionOpenBySymbol((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const item of incoming) {
        if (
          typeof item.last_price === "number" &&
          Number.isFinite(item.last_price) &&
          next[item.symbol] === undefined
        ) {
          next[item.symbol] = item.last_price;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [spotLatestList]);

  const gapKlineData: GapKlineDatum[] = GAP_K_SYMBOLS.map((symbol) => {
    const latest = spotBySymbol.get(symbol);
    const close = latest?.last_price;
    const openFromSse = latest?.open;
    const highFromSse = latest?.high;
    const lowFromSse = latest?.low;
    const closeFromSse = latest?.close;
    const sessionHigh = latest?.session_high;
    const sessionLow = latest?.session_low;
    const sessionOpen = sessionOpenBySymbol[symbol];
    const resolvedClose =
      typeof closeFromSse === "number" && Number.isFinite(closeFromSse)
        ? closeFromSse
        : close;
    if (typeof resolvedClose !== "number" || !Number.isFinite(resolvedClose)) {
      return { ...EMPTY_GAP_ROW, symbol };
    }

    const open =
      typeof openFromSse === "number" && Number.isFinite(openFromSse)
        ? openFromSse
        : typeof sessionOpen === "number" && Number.isFinite(sessionOpen)
          ? sessionOpen
          : resolvedClose;
    const highBase =
      typeof highFromSse === "number" && Number.isFinite(highFromSse)
        ? highFromSse
        : typeof sessionHigh === "number" && Number.isFinite(sessionHigh)
          ? sessionHigh
          : Math.max(open, resolvedClose);
    const lowBase =
      typeof lowFromSse === "number" && Number.isFinite(lowFromSse)
        ? lowFromSse
        : typeof sessionLow === "number" && Number.isFinite(sessionLow)
          ? sessionLow
          : Math.min(open, resolvedClose);

    const high = Math.max(highBase, open, resolvedClose);
    const low = Math.min(lowBase, open, resolvedClose);
    const changePct = open === 0 ? 0 : ((resolvedClose - open) / open) * 100;

    return {
      symbol,
      open,
      high,
      low,
      close: resolvedClose,
      changePct,
    };
  });

  const width = 620;
  const height = 190;
  const margin = { top: 16, right: 10, bottom: 50, left: 44 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const validRows = gapKlineData.filter(
    (item) =>
      item.high > 0 &&
      Number.isFinite(item.open) &&
      Number.isFinite(item.high) &&
      Number.isFinite(item.low) &&
      Number.isFinite(item.close),
  );
  const baseMin = validRows.length > 0 ? Math.min(...validRows.map((item) => item.low)) : 0;
  const baseMax = validRows.length > 0 ? Math.max(...validRows.map((item) => item.high)) : 1;
  const range = Math.max(baseMax - baseMin, 1);
  const paddedMin = baseMin - range * 0.08;
  const paddedMax = baseMax + range * 0.08;
  const tickCount = 5;
  const step = plotWidth / gapKlineData.length;
  const bodyWidth = Math.min(34, step * 0.56);

  const yScale = (price: number): number =>
    margin.top +
    ((paddedMax - price) / (paddedMax - paddedMin)) * plotHeight;

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
                  {`${pct.toFixed(1)}`}
                </text>
              </g>
            );
          })}
          {gapKlineData.map((item, index) => {
            if (item.high <= 0) {
              const centerX = margin.left + step * index + step / 2;
              return (
                <g key={item.symbol}>
                  <text
                    x={centerX}
                    y={height / 2}
                    fill="hsl(var(--subtle-foreground))"
                    fontSize={9}
                    textAnchor="middle"
                  >
                    --
                  </text>
                  <text
                    x={centerX}
                    y={height - 24}
                    fill="hsl(var(--subtle-foreground))"
                    fontSize={10}
                    textAnchor="middle"
                  >
                    {item.symbol}
                  </text>
                </g>
              );
            }
            const centerX = margin.left + step * index + step / 2;
            const openY = yScale(item.open);
            const closeY = yScale(item.close);
            const highY = yScale(item.high);
            const lowY = yScale(item.low);
            const isUp = item.close >= item.open;
            const bodyY = Math.min(openY, closeY);
            const bodyHeight = Math.max(2, Math.abs(closeY - openY));
            const fill = isUp ? KLINE_UP_COLOR : KLINE_DOWN_COLOR;

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
                  fill={item.changePct >= 0 ? KLINE_UP_COLOR : KLINE_DOWN_COLOR}
                  fontSize={9}
                  textAnchor="middle"
                >
                  {`${item.changePct >= 0 ? "+" : ""}${item.changePct.toFixed(1)}%`}
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
  const quote = useQuoteLatest("TXFD6");
  const stickyDayAmplitude = useStickyLatestNumber(kbar?.day_amplitude);
  const stickyEstimatedTurnover = useStickyLatestNumber(
    marketSummary?.estimated_turnover,
  );
  const stickySpread = useStickyLatestNumber(marketSummary?.spread);
  const stickyMainForceStrength = useStickyLatestNumber(
    metric?.main_force_big_order_strength,
  );
  const stickyMainChipStrength = useStickyLatestNumber(
    quote?.main_chip_strength,
  );
  const stickyLongShortForceStrength = useStickyLatestNumber(
    quote?.long_short_force_strength,
  );
  let gaugeIndex = 0;
  const coreMetrics = [
    {
      label: "\u6210\u4ea4\u632f\u5e45",
      value: formatCoreMetricValue("\u6210\u4ea4\u632f\u5e45", stickyDayAmplitude),
    },
    {
      label: "\u9810\u4f30\u6210\u4ea4\u91cf",
      value: formatCoreMetricValue("\u9810\u4f30\u6210\u4ea4\u91cf", stickyEstimatedTurnover),
    },
    {
      label: "\u50f9\u5dee",
      value: formatCoreMetricValue("\u50f9\u5dee", stickySpread),
    },
  ];
  const contributionMetrics = [
    {
      label: "\u4e3b\u529b\u7c4c\u78bc",
      value:
        stickyMainChipStrength === null
          ? "--"
          : formatPercentage(stickyMainChipStrength),
      testId: "live-metrics-main-chip-strength",
    },
    { label: "\u6563\u6236\u5c0f\u55ae", value: "+176", testId: "live-metrics-retail-small-order" },
    {
      label: "\u591a\u7a7a\u529b\u9053",
      value:
        stickyLongShortForceStrength === null
          ? "--"
          : formatPercentage(stickyLongShortForceStrength),
      testId: "live-metrics-long-short-force-strength",
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
            testId={item.testId}
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


