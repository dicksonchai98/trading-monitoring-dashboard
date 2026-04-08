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
import type { OrderFlowSeriesPoint } from "@/features/dashboard/lib/market-overview-mapper";

const axisTick = { fill: "hsl(var(--subtle-foreground))", fontSize: 11 };
const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "4px",
  color: "hsl(var(--foreground))",
};

function ChartShell({ children, testId, compact = false }: { children: JSX.Element; testId: string; compact?: boolean }): JSX.Element {
  return (
    <div
      className={compact ? "mt-[var(--panel-gap)] min-h-[120px] w-full flex-1" : "mt-[var(--panel-gap)] min-h-[180px] w-full flex-1"}
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

function formatMinuteLabel(offsetMinutes: number): string {
  const totalMinutes = 9 * 60 + offsetMinutes;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function withSignedBars(data: MarketOverviewPoint[]): MarketOverviewDatum[] {
  return data.map((point) => ({
    ...point,
    buyVolume: point.chipDelta > 0 ? point.chipDelta : 0,
    sellVolume: point.chipDelta < 0 ? point.chipDelta : 0,
  }));
}

function toOrderFlowMarketData(data: OrderFlowSeriesPoint[]): MarketOverviewDatum[] {
  return withSignedBars(
    data.map((point) => ({
      time: point.time,
      indexPrice: point.indexPrice,
      chipDelta: point.chipDelta,
    })),
  );
}

const SESSION_MINUTES = 271;

function generateMarketOverviewData(
  basePrice: number,
  volatilityScale: number,
  pricePhase: number,
  volumePhase: number,
): MarketOverviewDatum[] {
  const generated: MarketOverviewPoint[] = [];
  let previousPrice = basePrice;

  for (let i = 0; i < SESSION_MINUTES; i += 1) {
    const progress = i / (SESSION_MINUTES - 1);
    const drift =
      progress < 0.22
        ? volatilityScale * 0.22
        : progress < 0.48
          ? volatilityScale * -0.16
          : progress < 0.74
            ? volatilityScale * 0.12
            : volatilityScale * -0.1;
    const openCloseRegime =
      progress < 0.16 || progress > 0.84 ? 1.45 : 1;
    const noise =
      (Math.sin((i + pricePhase) * 0.91) * 0.9 +
        Math.cos((i + pricePhase) * 0.37) * 0.7 +
        Math.sin((i + pricePhase) * 1.73) * 0.45) *
      volatilityScale *
      openCloseRegime;
    const tickJitter =
      (Math.sin((i + pricePhase) * 2.9) > 0 ? 1 : -1) *
      volatilityScale *
      0.22;
    const shockPulse =
      Math.exp(-((i - 45) ** 2) / 85) * volatilityScale * -3.2 +
      Math.exp(-((i - 132) ** 2) / 110) * volatilityScale * 2.6 +
      Math.exp(-((i - 218) ** 2) / 90) * volatilityScale * -2.9;
    const minuteMove = drift + noise + tickJitter + shockPulse;
    const indexPrice = Math.round(previousPrice + minuteMove);
    const chipDelta = Math.round(
      minuteMove * 38 +
        Math.sin((i + volumePhase) * 0.48) * 520 +
        Math.cos((i + volumePhase) * 0.21) * 310,
    );

    generated.push({
      time: formatMinuteLabel(i),
      indexPrice,
      chipDelta,
    });
    previousPrice = indexPrice;
  }

  return withSignedBars(generated);
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
      <ResponsiveContainer width="100%" height="100%" minHeight={180} minWidth={0}>
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -14 }}
          barCategoryGap={0}
          barGap={0}
        >
          <CartesianGrid vertical={false} stroke="hsl(var(--border-strong))" strokeDasharray="3 3" />
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
              (dataMin: number) => dataMin - Math.max(8, Math.round(Math.abs(dataMin) * 0.0005)),
              (dataMax: number) => dataMax + Math.max(8, Math.round(Math.abs(dataMax) * 0.0005)),
            ]}
            tick={axisTick}
            tickCount={10}
            tickFormatter={(value) => `${value}`}
            tickLine={false}
            type="number"
            width={58}
          />
          <YAxis yAxisId="chip" axisLine={false} orientation="right" tick={axisTick} tickFormatter={(value) => `${value}`} tickLine={false} type="number" width={56} />
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
          />
          <Area
            yAxisId="chip"
            dataKey="sellVolume"
            fill="#22c55e"
            fillOpacity={0.3}
            stroke="none"
            type="step"
          />
          <Line yAxisId="price" dataKey="indexPrice" dot={false} stroke="hsl(var(--primary))" strokeWidth={2} type="linear" />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

const orderFlowData = generateMarketOverviewData(22380, 7.2, 0, 1);
const orderFlowFallbackSeries: OrderFlowSeriesPoint[] = orderFlowData.map((point, index) => ({
  minuteTs: index * 60_000,
  time: point.time,
  indexPrice: point.indexPrice,
  chipDelta: point.chipDelta,
}));

export function OrderFlowChart({
  data = orderFlowFallbackSeries,
}: {
  data?: OrderFlowSeriesPoint[];
}): JSX.Element {
  return <MarketOverviewHybridChart data={toOrderFlowMarketData(data)} priceLabel="TXF Near Month" testId="order-flow-chart" />;
}

const volumeLadderData = generateMarketOverviewData(22420, 6.8, 3, 6);

export function VolumeLadderChart(): JSX.Element {
  return <MarketOverviewHybridChart data={volumeLadderData} priceLabel="TXF Near Month" testId="volume-ladder-chart" />;
}

const pressureData = generateMarketOverviewData(1210, 1.8, 7, 2);

export function BidAskPressureChart(): JSX.Element {
  return <MarketOverviewHybridChart data={pressureData} priceLabel="TAIEX Electronics" testId="bid-ask-pressure-chart" />;
}

const programActivityData = generateMarketOverviewData(2085, 2.4, 11, 9);

export function ProgramActivityChart(): JSX.Element {
  return <MarketOverviewHybridChart data={programActivityData} priceLabel="TAIEX Finance" testId="program-activity-chart" />;
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
  return (
    <ChartShell testId="breadth-distribution-chart">
      <ResponsiveContainer width="100%" height="100%" minHeight={180} minWidth={0}>
        <ComposedChart data={breadthDistributionData} margin={{ top: 8, right: 10, bottom: 0, left: -10 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border-strong))" strokeDasharray="3 3" />
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
            label={{ value: "家數", angle: -90, position: "insideLeft", offset: 6, fill: "hsl(var(--subtle-foreground))", fontSize: 10 }}
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
              const normalized = typeof value === "number" ? value : Number(value ?? 0);
              if (name === "count") return [normalized, "漲跌家數"];
              return [normalized, "總漲跌家數變化"];
            }}
            labelFormatter={(value) => `漲跌幅度 ${String(value)}`}
          />
          <Bar yAxisId="count" dataKey="count" barSize={12} radius={[2, 2, 0, 0]}>
            {breadthDistributionData.map((entry) => (
              <Cell key={`${entry.bucket}-${entry.side}`} fill={entry.side === "up" ? "#ef4444" : "#22c55e"} />
            ))}
          </Bar>
          <Line yAxisId="breadth" dataKey="breadthSwing" dot={false} stroke="#f59e0b" strokeWidth={2} type="linear" />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

interface EstimatedVolumeDatum {
  minute: number;
  time: string;
  yesterdayEstimated: number;
  todayEstimated: number;
  positiveDiff: number;
  negativeDiff: number;
}

const estimatedVolumeData: EstimatedVolumeDatum[] = Array.from(
  { length: 28 },
  (_, index) => {
    const minute = index * 10;
    const hour = 9 + Math.floor(minute / 60);
    const clockMinute = minute % 60;
    const time = `${String(hour).padStart(2, "0")}:${String(clockMinute).padStart(2, "0")}`;
    const baseYesterday =
      4200 +
      minute * 36 +
      Math.sin(index * 0.58) * 520 +
      Math.cos(index * 0.21) * 420;
    const baseToday =
      4000 +
      minute * 38 +
      Math.sin((index + 1) * 0.53) * 640 +
      Math.cos((index + 1) * 0.24) * 470;

    return {
      minute,
      time,
      yesterdayEstimated: Math.max(0, Math.round(baseYesterday)),
      todayEstimated: Math.max(0, Math.round(baseToday)),
      positiveDiff: 0,
      negativeDiff: 0,
    };
  },
).map((row) => {
  const diff = row.todayEstimated - row.yesterdayEstimated;
  return {
    ...row,
    positiveDiff: diff > 0 ? diff : 0,
    negativeDiff: diff < 0 ? diff : 0,
  };
});

export function EstimatedVolumeCompareChart(): JSX.Element {
  return (
    <ChartShell testId="estimated-volume-compare-chart">
      <ResponsiveContainer width="100%" height="100%" minHeight={180} minWidth={0}>
        <ComposedChart data={estimatedVolumeData} margin={{ top: 8, right: 10, bottom: 0, left: -6 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border-strong))" strokeDasharray="3 3" />
          <XAxis
            axisLine={false}
            dataKey="minute"
            tick={axisTick}
            tickFormatter={(value) => {
              const matched = estimatedVolumeData.find((item) => item.minute === value);
              return matched?.time ?? "";
            }}
            tickLine={false}
            type="number"
            domain={[0, 270]}
            ticks={[0, 60, 120, 180, 240]}
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
              const normalized = typeof value === "number" ? value : Number(value ?? 0);
              if (name === "yesterdayEstimated") return [normalized, "昨日預估成交量"];
              if (name === "todayEstimated") return [normalized, "今日即時預估成交量"];
              if (name === "positiveDiff") return [normalized, "高於昨日"];
              if (name === "negativeDiff") return [Math.abs(normalized), "低於昨日"];
              return [normalized, name];
            }}
            labelFormatter={(value) => {
              const matched = estimatedVolumeData.find((item) => item.minute === value);
              return `時間 ${matched?.time ?? value}`;
            }}
          />
          <Area yAxisId="diff" dataKey="positiveDiff" type="linear" stroke="none" fill="#ef4444" fillOpacity={0.3} />
          <Area yAxisId="diff" dataKey="negativeDiff" type="linear" stroke="none" fill="#22c55e" fillOpacity={0.3} />
          <Line yAxisId="volume" dataKey="yesterdayEstimated" dot={false} stroke="#94a3b8" strokeWidth={2} type="linear" />
          <Line yAxisId="volume" dataKey="todayEstimated" dot={false} stroke="#38bdf8" strokeWidth={2} type="linear" />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

const foreignData = [{ value: 76, fill: "hsl(var(--chart-2))" }];

export function ForeignParticipationChart(): JSX.Element {
  return (
    <ChartShell testId="foreign-chart" compact>
      <ResponsiveContainer width="100%" height="100%" minHeight={120} minWidth={0}>
        <RadialBarChart cx="50%" cy="55%" innerRadius="55%" outerRadius="95%" data={foreignData} startAngle={180} endAngle={0} barSize={14}>
          <RadialBar background cornerRadius={8} dataKey="value" />
          <text x="50%" y="58%" textAnchor="middle" className="fill-foreground text-xs font-semibold">
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
      <ResponsiveContainer width="100%" height="100%" minHeight={120} minWidth={0}>
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
      <ResponsiveContainer width="100%" height="100%" minHeight={120} minWidth={0}>
        <BarChart data={retailData} margin={{ top: 4, right: 0, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border-strong))" strokeDasharray="3 3" />
          <XAxis axisLine={false} dataKey="day" tick={axisTick} tickLine={false} />
          <YAxis hide />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="intensity" radius={[3, 3, 0, 0]} fill="hsl(var(--chart-4))" />
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
      <ResponsiveContainer width="100%" height="100%" minHeight={120} minWidth={0}>
        <LineChart data={sentimentData} margin={{ top: 8, right: 0, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border-strong))" strokeDasharray="3 3" />
          <XAxis axisLine={false} dataKey="step" tick={axisTick} tickLine={false} />
          <YAxis hide domain={[35, 70]} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line dataKey="score" dot={false} stroke="hsl(var(--info))" strokeWidth={2} type="monotone" />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}
