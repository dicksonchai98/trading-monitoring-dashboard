import type { JSX } from "react";
import {
  Area,
  AreaChart,
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

const orderFlowData = [
  { time: "09:00", flow: 18 },
  { time: "09:05", flow: 34 },
  { time: "09:10", flow: 26 },
  { time: "09:15", flow: 48 },
  { time: "09:20", flow: 41 },
  { time: "09:25", flow: 57 },
  { time: "09:30", flow: 52 },
  { time: "09:35", flow: 64 },
];

export function OrderFlowChart(): JSX.Element {
  return (
    <ChartShell testId="order-flow-chart">
      <ResponsiveContainer width="100%" height="100%" minHeight={180} minWidth={0}>
        <LineChart data={orderFlowData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid horizontal stroke="hsl(var(--border-strong))" strokeDasharray="3 3" vertical />
          <XAxis axisLine={false} dataKey="time" tick={axisTick} tickLine={false} />
          <YAxis axisLine={false} domain={[10, 70]} tick={axisTick} tickLine={false} ticks={[10, 20, 30, 40, 50, 60, 70]} width={32} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "hsl(var(--border-strong))", strokeDasharray: "4 4" }} labelStyle={{ color: "hsl(var(--foreground))" }} />
          <Line dataKey="flow" dot={false} stroke="hsl(var(--primary))" strokeWidth={2} type="monotone" />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

const volumeLadderData = [
  { bucket: "09:00", volume: 42 },
  { bucket: "09:10", volume: 55 },
  { bucket: "09:20", volume: 68 },
  { bucket: "09:30", volume: 49 },
  { bucket: "09:40", volume: 72 },
];

export function VolumeLadderChart(): JSX.Element {
  return (
    <ChartShell testId="volume-ladder-chart">
      <ResponsiveContainer width="100%" height="100%" minHeight={180} minWidth={0}>
        <BarChart data={volumeLadderData} margin={{ top: 10, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border-strong))" strokeDasharray="3 3" />
          <XAxis axisLine={false} dataKey="bucket" tick={axisTick} tickLine={false} />
          <YAxis axisLine={false} tick={axisTick} tickLine={false} width={28} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="volume" radius={[3, 3, 0, 0]} fill="hsl(var(--chart-2))" />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

const pressureData = [
  { time: "09:00", bid: 38, ask: 21 },
  { time: "09:08", bid: 42, ask: 26 },
  { time: "09:16", bid: 35, ask: 31 },
  { time: "09:24", bid: 49, ask: 29 },
  { time: "09:32", bid: 44, ask: 24 },
];

export function BidAskPressureChart(): JSX.Element {
  return (
    <ChartShell testId="bid-ask-pressure-chart">
      <ResponsiveContainer width="100%" height="100%" minHeight={180} minWidth={0}>
        <AreaChart data={pressureData} margin={{ top: 8, right: 6, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="bidFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.45} />
              <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="askFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--danger))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--danger))" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="hsl(var(--border-strong))" strokeDasharray="3 3" />
          <XAxis axisLine={false} dataKey="time" tick={axisTick} tickLine={false} />
          <YAxis axisLine={false} tick={axisTick} tickLine={false} width={28} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area dataKey="bid" stroke="hsl(var(--chart-3))" fill="url(#bidFill)" strokeWidth={2} type="monotone" />
          <Area dataKey="ask" stroke="hsl(var(--danger))" fill="url(#askFill)" strokeWidth={2} type="monotone" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  );
}

const programActivityData = [
  { time: "09:00", long: 12, short: -8, net: 4 },
  { time: "09:10", long: 18, short: -10, net: 8 },
  { time: "09:20", long: 11, short: -6, net: 5 },
  { time: "09:30", long: 23, short: -14, net: 9 },
  { time: "09:40", long: 19, short: -7, net: 12 },
];

export function ProgramActivityChart(): JSX.Element {
  return (
    <ChartShell testId="program-activity-chart">
      <ResponsiveContainer width="100%" height="100%" minHeight={180} minWidth={0}>
        <ComposedChart data={programActivityData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border-strong))" strokeDasharray="3 3" />
          <XAxis axisLine={false} dataKey="time" tick={axisTick} tickLine={false} />
          <YAxis axisLine={false} tick={axisTick} tickLine={false} width={28} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="long" fill="hsl(var(--chart-5))" radius={[3, 3, 0, 0]} />
          <Bar dataKey="short" fill="hsl(var(--chart-6))" radius={[3, 3, 0, 0]} />
          <Line dataKey="net" dot={false} stroke="hsl(var(--primary))" strokeWidth={2} type="monotone" />
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
  { name: "Long", value: 41, fill: "hsl(var(--chart-3))" },
  { name: "Flat", value: 23, fill: "hsl(var(--chart-2))" },
  { name: "Short", value: 36, fill: "hsl(var(--warning))" },
];

export function DealerPositionChart(): JSX.Element {
  return (
    <ChartShell testId="dealer-chart" compact>
      <ResponsiveContainer width="100%" height="100%" minHeight={120} minWidth={0}>
        <PieChart>
          <Tooltip contentStyle={tooltipStyle} />
          <Pie data={dealerData} dataKey="value" innerRadius={28} outerRadius={46} paddingAngle={3} stroke="none">
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
