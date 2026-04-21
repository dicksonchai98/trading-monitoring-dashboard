import type { JSX } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
  const yAxisTicks = [10, 20, 30, 40, 50, 60, 70];

  return (
    <div
      className="mt-[var(--panel-gap)] min-h-[180px] w-full flex-1"
      data-testid="order-flow-chart"
    >
      <ResponsiveContainer width="100%" height="100%" minHeight={180} minWidth={0}>
        <LineChart data={orderFlowData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid
            horizontal
            stroke="hsl(var(--border-strong))"
            strokeDasharray="3 3"
            vertical
          />
          <XAxis
            axisLine={false}
            dataKey="time"
            tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            domain={[10, 70]}
            tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 11 }}
            tickLine={false}
            ticks={yAxisTicks}
            width={32}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "4px",
              color: "hsl(var(--foreground))",
            }}
            cursor={{ stroke: "hsl(var(--border-strong))", strokeDasharray: "4 4" }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
          />
          <Line
            dataKey="flow"
            dot={false}
            stroke="hsl(var(--chart-line))"
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
