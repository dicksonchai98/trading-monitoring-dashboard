import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { BentoGridSection } from "@/components/ui/bento-grid";
import { PanelCard } from "@/components/ui/panel-card";
import { useKbarCurrent } from "@/features/realtime/hooks/use-kbar-current";
import { useMetricLatest } from "@/features/realtime/hooks/use-metric-latest";
import { useRealtimeConnection } from "@/features/realtime/hooks/use-realtime-connection";

interface SeriesPoint {
  ts: number;
  label: string;
  value: number;
}

interface SpreadPoint {
  ts: number;
  label: string;
  spread: number;
  mid: number;
}

interface DepthPoint {
  ts: number;
  label: string;
  bidSize: number;
  askSize: number;
}

function formatLabel(ts: number): string {
  const date = new Date(ts);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function appendPoint<T extends { ts: number }>(list: T[], next: T, cap = 40): T[] {
  if (list.length > 0 && list[list.length - 1]?.ts === next.ts) {
    const copied = [...list];
    copied[copied.length - 1] = next;
    return copied;
  }
  const merged = [...list, next];
  return merged.length > cap ? merged.slice(merged.length - cap) : merged;
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

function EmptyState({ text }: { text: string }): JSX.Element {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

export function RealtimeSseChartsSection(): JSX.Element {
  const { connectionStatus } = useRealtimeConnection();
  const kbar = useKbarCurrent("TXFD6");
  const metric = useMetricLatest("TXFD6");

  const [closeSeries, setCloseSeries] = useState<SeriesPoint[]>([]);
  const [spreadSeries, setSpreadSeries] = useState<SpreadPoint[]>([]);
  const [depthSeries, setDepthSeries] = useState<DepthPoint[]>([]);

  useEffect(() => {
    if (!kbar) {
      return;
    }
    const ts = Number(kbar.minute_ts);
    if (!Number.isFinite(ts)) {
      return;
    }
    const point: SeriesPoint = {
      ts,
      label: formatLabel(ts),
      value: kbar.close,
    };
    setCloseSeries((current) => appendPoint(current, point));
  }, [kbar]);

  useEffect(() => {
    if (!metric) {
      return;
    }
    const baseTs = typeof metric.ts === "number" ? metric.ts : Date.now();
    if (typeof metric.spread === "number" && typeof metric.mid === "number") {
      const point: SpreadPoint = {
        ts: baseTs,
        label: formatLabel(baseTs),
        spread: metric.spread,
        mid: metric.mid,
      };
      setSpreadSeries((current) => appendPoint(current, point));
    }
    if (typeof metric.bid_size === "number" && typeof metric.ask_size === "number") {
      const point: DepthPoint = {
        ts: baseTs,
        label: formatLabel(baseTs),
        bidSize: metric.bid_size,
        askSize: metric.ask_size,
      };
      setDepthSeries((current) => appendPoint(current, point));
    }
  }, [metric]);

  const latestPrice = useMemo(() => {
    if (!kbar) {
      return null;
    }
    return `${kbar.close.toFixed(2)}`;
  }, [kbar]);

  return (
    <BentoGridSection
      title="SSE LIVE STREAM"
      subtitle="Added for phase-2 integration validation"
      actions={<Badge variant={statusBadgeVariant(connectionStatus)}>{connectionStatus.toUpperCase()}</Badge>}
    >
      <PanelCard
        title="Near-Month Close (TXFD6)"
        meta={latestPrice ? `Latest ${latestPrice}` : "Waiting for ticks"}
        span={4}
        units={2}
        data-testid="sse-close-trend-panel"
      >
        {closeSeries.length === 0 ? (
          <EmptyState text="Waiting for SSE data..." />
        ) : (
          <div className="h-[220px] w-full" data-testid="sse-close-trend-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={closeSeries} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border-strong))" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} width={56} />
                <Tooltip />
                <Line dataKey="value" type="monotone" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </PanelCard>

      <PanelCard title="Spread & Mid" span={4} units={2} data-testid="sse-spread-panel">
        {spreadSeries.length === 0 ? (
          <EmptyState text="Waiting for spread/mid metrics..." />
        ) : (
          <div className="h-[220px] w-full" data-testid="sse-spread-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spreadSeries} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border-strong))" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} width={56} />
                <Tooltip />
                <Line dataKey="mid" type="monotone" stroke="#38bdf8" dot={false} strokeWidth={2} />
                <Line dataKey="spread" type="monotone" stroke="#f59e0b" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </PanelCard>

      <PanelCard title="Bid/Ask Size" span={4} units={2} data-testid="sse-depth-panel">
        {depthSeries.length === 0 ? (
          <EmptyState text="Waiting for depth size metrics..." />
        ) : (
          <div className="h-[220px] w-full" data-testid="sse-depth-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={depthSeries} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border-strong))" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 10 }} tickLine={false} axisLine={false} width={56} />
                <Tooltip />
                <Line dataKey="bidSize" type="monotone" stroke="#22c55e" dot={false} strokeWidth={2} />
                <Line dataKey="askSize" type="monotone" stroke="#ef4444" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </PanelCard>
    </BentoGridSection>
  );
}
