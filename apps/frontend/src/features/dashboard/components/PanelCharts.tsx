import type { JSX } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useT } from "@/lib/i18n";
import type { EstimatedVolumeSeriesPoint } from "@/features/dashboard/lib/estimated-volume-mapper";
import type { OrderFlowSeriesPoint } from "@/features/dashboard/lib/market-overview-mapper";

const axisTick = { fill: "hsl(var(--subtle-foreground))", fontSize: 11 };
const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "4px",
  color: "hsl(var(--foreground))",
};

function ChartShell({
  children,
  testId,
  compact = false,
}: {
  children: JSX.Element;
  testId: string;
  compact?: boolean;
}): JSX.Element {
  return (
    <div
      className={
        compact
          ? "mt-[var(--panel-gap)] min-h-[120px] w-full flex-1"
          : "mt-[var(--panel-gap)] min-h-[180px] w-full flex-1"
      }
      data-testid={testId}
    >
      <div data-testid="panel-chart" className="h-full w-full">
        {children}
      </div>
    </div>
  );
}

interface MarketOverviewPoint {
  time: string;
  indexPrice: number;
  chipDelta: number;
}

interface MarketOverviewDatum extends MarketOverviewPoint {
  buyVolume: number;
  sellVolume: number;
}

function withSignedBars(data: MarketOverviewPoint[]): MarketOverviewDatum[] {
  return data.map((point) => ({
    ...point,
    buyVolume: point.chipDelta > 0 ? point.chipDelta : 0,
    sellVolume: point.chipDelta < 0 ? point.chipDelta : 0,
  }));
}

function toOrderFlowMarketData(
  data: OrderFlowSeriesPoint[],
): MarketOverviewDatum[] {
  return withSignedBars(
    data.map((point) => ({
      time: point.time,
      indexPrice: point.indexPrice,
      chipDelta: point.chipDelta,
    })),
  );
}

function MarketOverviewHybridChart({
  data,
  priceLabel,
  testId,
}: {
  data: MarketOverviewDatum[];
  priceLabel: string;
  testId: string;
}): JSX.Element {
  return (
    <ChartShell testId={testId}>
      <ResponsiveContainer
        width="100%"
        height="100%"
        minHeight={180}
        minWidth={0}
      >
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -14 }}
          barCategoryGap={0}
          barGap={0}
        >
          <CartesianGrid
            vertical={false}
            stroke="hsl(var(--border-strong))"
            strokeDasharray="3 3"
          />
          <XAxis
            axisLine={false}
            dataKey="time"
            height={52}
            interval={14}
            tick={{ ...axisTick, angle: -90, textAnchor: "end" }}
            tickLine={false}
            type="category"
          />
          <YAxis
            yAxisId="price"
            axisLine={false}
            domain={[
              (dataMin: number) =>
                dataMin - Math.max(8, Math.round(Math.abs(dataMin) * 0.0005)),
              (dataMax: number) =>
                dataMax + Math.max(8, Math.round(Math.abs(dataMax) * 0.0005)),
            ]}
            tick={axisTick}
            tickCount={10}
            tickFormatter={(value) => `${value}`}
            tickLine={false}
            type="number"
            width={58}
          />
          <YAxis
            yAxisId="chip"
            axisLine={false}
            orientation="right"
            tick={axisTick}
            tickFormatter={(value) => `${value}`}
            tickLine={false}
            type="number"
            width={56}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(value, name) => {
              const normalizedValue =
                typeof value === "number" ? value : Number(value ?? 0);

              if (name === "indexPrice") {
                return [normalizedValue, priceLabel];
              }

              return [normalizedValue, "Large Trader Delta (Bid-Ask)"];
            }}
          />
          <Area
            yAxisId="chip"
            dataKey="buyVolume"
            fill="#ef4444"
            fillOpacity={0.3}
            stroke="none"
            type="step"
            isAnimationActive={false}
          />
          <Area
            yAxisId="chip"
            dataKey="sellVolume"
            fill="#22c55e"
            fillOpacity={0.3}
            stroke="none"
            type="step"
            isAnimationActive={false}
          />
          <Line
            yAxisId="price"
            dataKey="indexPrice"
            dot={false}
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            type="linear"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function OrderFlowChart({
  data,
}: {
  data: OrderFlowSeriesPoint[];
}): JSX.Element {
  return (
    <MarketOverviewHybridChart
      data={toOrderFlowMarketData(data)}
      priceLabel="TXFD6 Near Month"
      testId="order-flow-chart"
    />
  );
}

export function VolumeLadderChart({
  data,
}: {
  data: OrderFlowSeriesPoint[];
}): JSX.Element {
  return (
    <MarketOverviewHybridChart
      data={toOrderFlowMarketData(data)}
      priceLabel="TXFD6 Near Month"
      testId="volume-ladder-chart"
    />
  );
}

export function BidAskPressureChart({
  data,
}: {
  data: OrderFlowSeriesPoint[];
}): JSX.Element {
  return (
    <MarketOverviewHybridChart
      data={toOrderFlowMarketData(data)}
      priceLabel="TXFD6 Near Month"
      testId="bid-ask-pressure-chart"
    />
  );
}

export function ProgramActivityChart({
  data,
}: {
  data: OrderFlowSeriesPoint[];
}): JSX.Element {
  return (
    <MarketOverviewHybridChart
      data={toOrderFlowMarketData(data)}
      priceLabel="TXFD6 Near Month"
      testId="program-activity-chart"
    />
  );
}

interface BreadthDistributionDatum {
  bucket: string;
  changePct: number;
  count: number;
  side: "up" | "down";
  breadthSwing: number;
}

const breadthDistributionData: BreadthDistributionDatum[] = Array.from(
  { length: 16 },
  (_, index) => {
    const rangeStart = index - 8;
    const rangeEnd = rangeStart + 1;
    const bucket = rangeStart + 0.5;
    const upCount =
      bucket >= 0
        ? Math.max(
            0,
            Math.round(
              42 * Math.exp(-((bucket - 0.8) ** 2) / 5.6) +
                9 * Math.exp(-((bucket - 3.4) ** 2) / 6.8),
            ),
          )
        : 0;
    const downCount =
      bucket <= 0
        ? Math.max(
            0,
            Math.round(
              40 * Math.exp(-((bucket + 0.9) ** 2) / 5.8) +
                8 * Math.exp(-((bucket + 3.2) ** 2) / 7.2),
            ),
          )
        : 0;
    const breadthSwing = (upCount - downCount) * 0.9 + bucket * 1.8;

    return {
      bucket: `${rangeStart}~${rangeEnd}%`,
      changePct: bucket,
      count: bucket >= 0 ? upCount : downCount,
      side: bucket >= 0 ? "up" : "down",
      breadthSwing: Number(breadthSwing.toFixed(1)),
    };
  },
);

export function BreadthDistributionChart(): JSX.Element {
  const t = useT();

  return (
    <ChartShell testId="breadth-distribution-chart">
      <ResponsiveContainer
        width="100%"
        height="100%"
        minHeight={180}
        minWidth={0}
      >
        <ComposedChart
          data={breadthDistributionData}
          margin={{ top: 8, right: 10, bottom: 0, left: -10 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="hsl(var(--border-strong))"
            strokeDasharray="3 3"
          />
          <XAxis
            axisLine={false}
            dataKey="bucket"
            tick={axisTick}
            tickLine={false}
            interval={1}
          />
          <YAxis
            yAxisId="count"
            axisLine={false}
            tick={axisTick}
            tickLine={false}
            width={44}
            label={{
              value: t("dashboard.chart.breadth.countAxis"),
              angle: -90,
              position: "insideLeft",
              offset: 6,
              fill: "hsl(var(--subtle-foreground))",
              fontSize: 10,
            }}
          />
          <YAxis
            yAxisId="breadth"
            axisLine={false}
            orientation="right"
            tick={axisTick}
            tickLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(value, name) => {
              const normalized =
                typeof value === "number" ? value : Number(value ?? 0);
              if (name === "count")
                return [normalized, t("dashboard.chart.breadth.count")];
              return [normalized, t("dashboard.chart.breadth.swing")];
            }}
            labelFormatter={(value) =>
              `${t("dashboard.chart.breadth.labelPrefix")} ${String(value)}`
            }
          />
          <Bar
            yAxisId="count"
            dataKey="count"
            barSize={12}
            radius={[2, 2, 0, 0]}
          >
            {breadthDistributionData.map((entry) => (
              <Cell
                key={`${entry.bucket}-${entry.side}`}
                fill={entry.side === "up" ? "#ef4444" : "#22c55e"}
              />
            ))}
          </Bar>
          <Line
            yAxisId="breadth"
            dataKey="breadthSwing"
            dot={false}
            stroke="#f59e0b"
            strokeWidth={2}
            type="linear"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

export function EstimatedVolumeCompareChart({
  data,
}: {
  data: EstimatedVolumeSeriesPoint[];
}): JSX.Element {
  const t = useT();

  return (
    <ChartShell testId="estimated-volume-compare-chart">
      <ResponsiveContainer
        width="100%"
        height="100%"
        minHeight={180}
        minWidth={0}
      >
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 10, bottom: 0, left: -6 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="hsl(var(--border-strong))"
            strokeDasharray="3 3"
          />
          <XAxis
            axisLine={false}
            dataKey="minuteOfDay"
            tick={axisTick}
            tickFormatter={(value) => {
              const matched = data.find((item) => item.minuteOfDay === value);
              return matched?.time ?? "";
            }}
            tickLine={false}
            type="number"
            domain={[9 * 60, 13 * 60 + 30]}
            ticks={[9 * 60, 10 * 60, 11 * 60, 12 * 60, 13 * 60]}
          />
          <YAxis
            yAxisId="volume"
            axisLine={false}
            domain={[0, "auto"]}
            tick={axisTick}
            tickFormatter={(value) => `${Math.round(value / 1000)}k`}
            tickLine={false}
            width={44}
          />
          <YAxis
            yAxisId="diff"
            axisLine={false}
            orientation="right"
            domain={["dataMin", "dataMax"]}
            tickLine={false}
            tick={axisTick}
            width={44}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(value, name) => {
              const normalized =
                typeof value === "number" ? value : Number(value ?? 0);
              if (name === "yesterdayEstimated")
                return [normalized, t("dashboard.chart.volume.yesterday")];
              if (name === "todayEstimated")
                return [normalized, t("dashboard.chart.volume.today")];
              if (name === "positiveDiff")
                return [normalized, t("dashboard.chart.volume.aboveYesterday")];
              if (name === "negativeDiff")
                return [
                  Math.abs(normalized),
                  t("dashboard.chart.volume.belowYesterday"),
                ];
              return [normalized, name];
            }}
            labelFormatter={(value) => {
              const matched = estimatedVolumeData.find(
                (item) => item.minute === value,
              );
              return `${t("dashboard.chart.volume.timePrefix")} ${matched?.time ?? value}`;
            }}
          />
          <Area
            yAxisId="diff"
            dataKey="positiveDiff"
            type="linear"
            stroke="none"
            fill="#ef4444"
            fillOpacity={0.3}
            isAnimationActive={false}
          />
          <Area
            yAxisId="diff"
            dataKey="negativeDiff"
            type="linear"
            stroke="none"
            fill="#22c55e"
            fillOpacity={0.3}
            isAnimationActive={false}
          />
          <Line
            yAxisId="volume"
            dataKey="yesterdayEstimated"
            dot={false}
            stroke="#94a3b8"
            strokeWidth={2}
            type="linear"
            isAnimationActive={false}
          />
          <Line
            yAxisId="volume"
            dataKey="todayEstimated"
            dot={false}
            stroke="#38bdf8"
            strokeWidth={2}
            type="linear"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

const foreignData = [{ value: 76, fill: "hsl(var(--chart-2))" }];

export function ForeignParticipationChart(): JSX.Element {
  return (
    <ChartShell testId="foreign-chart" compact>
      <ResponsiveContainer
        width="100%"
        height="100%"
        minHeight={120}
        minWidth={0}
      >
        <RadialBarChart
          cx="50%"
          cy="55%"
          innerRadius="55%"
          outerRadius="95%"
          data={foreignData}
          startAngle={180}
          endAngle={0}
          barSize={14}
        >
          <RadialBar
            background
            cornerRadius={8}
            dataKey="value"
            isAnimationActive={false}
          />
          <text
            x="50%"
            y="58%"
            textAnchor="middle"
            className="fill-foreground text-xs font-semibold"
          >
            76%
          </text>
        </RadialBarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

const dealerData = [
  { name: "Long", value: 41, fill: "#ef4444" },
  { name: "Flat", value: 23, fill: "#9ca3af" },
  { name: "Short", value: 36, fill: "#22c55e" },
];

function renderDealerLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  name,
  value,
}: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  name?: string;
  value?: number;
}): JSX.Element | null {
  if (
    typeof cx !== "number" ||
    typeof cy !== "number" ||
    typeof midAngle !== "number" ||
    typeof innerRadius !== "number" ||
    typeof outerRadius !== "number" ||
    typeof name !== "string" ||
    typeof value !== "number"
  ) {
    return null;
  }

  const radius = innerRadius + (outerRadius - innerRadius) * 0.62;
  const x = cx + radius * Math.cos((-midAngle * Math.PI) / 180);
  const y = cy + radius * Math.sin((-midAngle * Math.PI) / 180);

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      fontSize={10}
      fontWeight={600}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {`${name} ${value}%`}
    </text>
  );
}

export function DealerPositionChart(): JSX.Element {
  return (
    <ChartShell testId="dealer-chart" compact>
      <ResponsiveContainer
        width="100%"
        height="100%"
        minHeight={120}
        minWidth={0}
      >
        <PieChart>
          <Tooltip contentStyle={tooltipStyle} />
          <Pie
            data={dealerData}
            dataKey="value"
            innerRadius={28}
            outerRadius={46}
            paddingAngle={3}
            stroke="none"
            label={renderDealerLabel}
            labelLine={false}
            isAnimationActive={false}
          >
            {dealerData.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

const retailData = [
  { day: "Mon", intensity: 14 },
  { day: "Tue", intensity: 22 },
  { day: "Wed", intensity: 19 },
  { day: "Thu", intensity: 28 },
  { day: "Fri", intensity: 24 },
];

export function RetailPulseChart(): JSX.Element {
  return (
    <ChartShell testId="retail-chart" compact>
      <ResponsiveContainer
        width="100%"
        height="100%"
        minHeight={120}
        minWidth={0}
      >
        <BarChart
          data={retailData}
          margin={{ top: 4, right: 0, bottom: 0, left: -18 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="hsl(var(--border-strong))"
            strokeDasharray="3 3"
          />
          <XAxis
            axisLine={false}
            dataKey="day"
            tick={axisTick}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <Bar
            dataKey="intensity"
            radius={[3, 3, 0, 0]}
            fill="hsl(var(--chart-4))"
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

const sentimentData = [
  { step: "1", score: 42 },
  { step: "2", score: 55 },
  { step: "3", score: 48 },
  { step: "4", score: 63 },
  { step: "5", score: 58 },
];

export function SentimentTrendChart(): JSX.Element {
  return (
    <ChartShell testId="sentiment-chart" compact>
      <ResponsiveContainer
        width="100%"
        height="100%"
        minHeight={120}
        minWidth={0}
      >
        <LineChart
          data={sentimentData}
          margin={{ top: 8, right: 0, bottom: 0, left: -18 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="hsl(var(--border-strong))"
            strokeDasharray="3 3"
          />
          <XAxis
            axisLine={false}
            dataKey="step"
            tick={axisTick}
            tickLine={false}
          />
          <YAxis hide domain={[35, 70]} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line
            dataKey="score"
            dot={false}
            stroke="hsl(var(--info))"
            strokeWidth={2}
            type="monotone"
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
