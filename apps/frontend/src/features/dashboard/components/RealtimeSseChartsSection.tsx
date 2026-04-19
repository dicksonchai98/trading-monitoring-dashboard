import type { JSX } from "react";
import { useEffect, useMemo, useState, useRef } from "react";
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
import { useRealtimeConnection } from "@/features/realtime/hooks/use-realtime-connection";
import { useThrottledSubscription } from '@/hooks/use-throttled-subscription';
import { useT } from "@/lib/i18n";

const ACTIVE_CODE = "TXFD6";

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

function appendPointInPlace<T extends { ts: number }>(
  list: T[],
  next: T,
  cap = 40,
): boolean {
  const last = list[list.length - 1];
  if (last && last.ts === next.ts) {
    // shallow compare keys to avoid unnecessary mutation
    const nextKeys = Object.keys(next) as (keyof T)[];
    let same = true;
    for (const k of nextKeys) {
      if ((last as any)[k] !== (next as any)[k]) {
        same = false;
        break;
      }
    }
    if (same) return false;
    list[list.length - 1] = next;
    return true;
  }
  list.push(next);
  if (list.length > cap) {
    // remove oldest excess items in-place
    list.splice(0, list.length - cap);
  }
  return true;
}

function statusBadgeVariant(
  status: string,
): "success" | "warning" | "danger" | "neutral" {
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

function EmptyState(): JSX.Element {
  return (
    <div
      className="flex h-full min-h-[180px] flex-col justify-center gap-3"
      data-testid="sse-panel-skeleton"
    >
      <div className="h-3 w-2/3 animate-pulse rounded-sm bg-muted/80" />
      <div className="h-3 w-1/2 animate-pulse rounded-sm bg-muted/70" />
      <div className="h-20 w-full animate-pulse rounded-md bg-muted/60" />
    </div>
  );
}

export function RealtimeSseChartsSection(): JSX.Element {
  const t = useT();
  const { connectionStatus } = useRealtimeConnection();
  const kbar = useThrottledSubscription((s) => s.kbarCurrentByCode?.[ACTIVE_CODE] ?? null, 100);
  const metric = useThrottledSubscription((s) => s.metricLatestByCode?.[ACTIVE_CODE] ?? null, 100);

  const closeSeriesRef = useRef<SeriesPoint[]>([]);
  const spreadSeriesRef = useRef<SpreadPoint[]>([]);
  const depthSeriesRef = useRef<DepthPoint[]>([]);
  const [, setTick] = useState(0);
  function triggerRender() {
    setTick((t) => t + 1);
  }

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
    const changed = appendPointInPlace(closeSeriesRef.current, point);
    if (changed) triggerRender();
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
      const changed = appendPointInPlace(spreadSeriesRef.current, point);
      if (changed) triggerRender();
    }
    if (
      typeof metric.bid_size === "number" &&
      typeof metric.ask_size === "number"
    ) {
      const point: DepthPoint = {
        ts: baseTs,
        label: formatLabel(baseTs),
        bidSize: metric.bid_size,
        askSize: metric.ask_size,
      };
      const changed = appendPointInPlace(depthSeriesRef.current, point);
      if (changed) triggerRender();
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
      title={t("dashboard.sse.title")}
      subtitle={t("dashboard.sse.subtitle")}
      actions={
        <Badge variant={statusBadgeVariant(connectionStatus)}>
          {connectionStatus.toUpperCase()}
        </Badge>
      }
    >
      <PanelCard
        title={t("dashboard.sse.close.title", { code: ACTIVE_CODE })}
        meta={
          latestPrice
            ? t("dashboard.sse.close.latest", { price: latestPrice })
            : t("dashboard.sse.close.waiting")
        }
        span={4}
        units={2}
        data-testid="sse-close-trend-panel"
      >
        {closeSeriesRef.current.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="h-[220px] w-full" data-testid="sse-close-trend-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={closeSeriesRef.current}
                margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border-strong))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
                <Tooltip />
                <Line
                  dataKey="value"
                  type="monotone"
                  stroke="hsl(var(--chart-line))"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </PanelCard>

      <PanelCard
        title={t("dashboard.sse.spread.title")}
        span={4}
        units={2}
        data-testid="sse-spread-panel"
      >
        {spreadSeriesRef.current.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="h-[220px] w-full" data-testid="sse-spread-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={spreadSeriesRef.current}
                margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border-strong))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
                <Tooltip />
                <Line
                  dataKey="mid"
                  type="monotone"
                  stroke="#38bdf8"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="spread"
                  type="monotone"
                  stroke="#f59e0b"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </PanelCard>

      <PanelCard
        title={t("dashboard.sse.depth.title")}
        span={4}
        units={2}
        data-testid="sse-depth-panel"
      >
        {depthSeriesRef.current.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="h-[220px] w-full" data-testid="sse-depth-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={depthSeriesRef.current}
                margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border-strong))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--subtle-foreground))", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
                <Tooltip />
                <Line
                  dataKey="bidSize"
                  type="monotone"
                  stroke="#22c55e"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="askSize"
                  type="monotone"
                  stroke="#ef4444"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </PanelCard>
    </BentoGridSection>
  );
}
