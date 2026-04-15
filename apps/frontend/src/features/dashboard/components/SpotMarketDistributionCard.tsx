import type { JSX } from "react";
import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PanelCard } from "@/components/ui/panel-card";
import { CardDataState } from "@/features/dashboard/components/CardDataState";
import { useSpotMarketDistributionBaseline } from "@/features/dashboard/hooks/use-spot-market-distribution";
import { useRealtimeStore } from "@/features/realtime/store/realtime.store";
import { useT } from "@/lib/i18n";

interface MarketDistributionChartDatum {
  bucketLabel: string;
  count: number;
  trendIndex: number;
  lowerPct: number;
  upperPct: number;
}

function formatTrendIndex(value: number): string {
  return `${value.toFixed(1)}%`;
}

function bucketFill(lowerPct: number, upperPct: number): string {
  if (upperPct <= 0) {
    return "#22c55e";
  }
  if (lowerPct >= 0) {
    return "#ef4444";
  }
  return "#f59e0b";
}

export function SpotMarketDistributionCard(): JSX.Element {
  const t = useT();
  const { loading, error } = useSpotMarketDistributionBaseline();
  const spotMarketDistributionLatest = useRealtimeStore(
    (state) => state.spotMarketDistributionLatest,
  );
  const spotMarketDistributionSeries = useRealtimeStore(
    (state) => state.spotMarketDistributionSeries,
  );

  const trendIndexReference = useMemo(() => {
    const seriesItems = spotMarketDistributionSeries?.items ?? [];
    const latestSeriesTrendIndex =
      seriesItems.length > 0 ? seriesItems[seriesItems.length - 1]?.trend_index : undefined;
    const latestSnapshotTrendIndex = spotMarketDistributionLatest?.trend_index;
    const rawValue =
      typeof latestSeriesTrendIndex === "number"
        ? latestSeriesTrendIndex
        : typeof latestSnapshotTrendIndex === "number"
          ? latestSnapshotTrendIndex
          : null;
    return rawValue === null ? null : Number((rawValue * 100).toFixed(1));
  }, [spotMarketDistributionLatest?.trend_index, spotMarketDistributionSeries?.items]);

  const chartData = useMemo<MarketDistributionChartDatum[]>(() => {
    const buckets = spotMarketDistributionLatest?.distribution_buckets ?? [];
    return buckets
      .slice()
      .sort((left, right) => left.lower_pct - right.lower_pct)
      .map((bucket) => ({
        bucketLabel: bucket.label,
        count: bucket.count,
        trendIndex: trendIndexReference ?? 0,
        lowerPct: bucket.lower_pct,
        upperPct: bucket.upper_pct,
      }));
  }, [spotMarketDistributionLatest?.distribution_buckets, trendIndexReference]);

  const hasData = chartData.length > 0;
  const state = hasData
    ? "ready"
    : loading
      ? "loading"
      : error
        ? "error"
        : "empty";

  return (
    <PanelCard
      title={t("dashboard.realtime.breadth.title")}
      meta={t("dashboard.realtime.breadth.meta")}
      note={t("dashboard.realtime.breadth.note")}
      span={4}
      units={1}
      data-testid="spot-market-distribution-card"
    >
      {state === "loading" ? (
        <CardDataState text={t("dashboard.realtime.breadth.loading")} />
      ) : null}
      {state === "error" ? (
        <CardDataState text={t("dashboard.realtime.breadth.error")} />
      ) : null}
      {state === "empty" ? (
        <CardDataState text={t("dashboard.realtime.breadth.empty")} />
      ) : null}
      {state === "ready" ? (
        <div className="mt-[var(--panel-gap)] h-[180px] w-full">
          <div className="h-full w-full" data-testid="spot-market-distribution-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ComposedChart
                data={chartData}
                margin={{ top: 8, right: 10, bottom: 0, left: -8 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border-strong))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  axisLine={false}
                  dataKey="bucketLabel"
                  height={56}
                  interval={0}
                  tick={{
                    fill: "hsl(var(--subtle-foreground))",
                    fontSize: 11,
                    angle: -30,
                    textAnchor: "end",
                  }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="count"
                  axisLine={false}
                  tick={{
                    fill: "hsl(var(--subtle-foreground))",
                    fontSize: 11,
                  }}
                  tickLine={false}
                  width={42}
                />
                <YAxis
                  yAxisId="trend"
                  orientation="right"
                  axisLine={false}
                  domain={[-100, 100]}
                  tick={{
                    fill: "hsl(var(--subtle-foreground))",
                    fontSize: 11,
                  }}
                  tickFormatter={(value) => formatTrendIndex(Number(value))}
                  tickLine={false}
                  width={54}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "4px",
                    color: "hsl(var(--foreground))",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value, name) => {
                    const normalized =
                      typeof value === "number" ? value : Number(value ?? 0);
                    if (name === "count") {
                      return [normalized, t("dashboard.realtime.breadth.count")];
                    }
                    return [formatTrendIndex(normalized), t("dashboard.realtime.breadth.trend")];
                  }}
                />
                <Bar
                  yAxisId="count"
                  dataKey="count"
                  barSize={16}
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={false}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.bucketLabel}
                      fill={bucketFill(entry.lowerPct, entry.upperPct)}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="trend"
                  dataKey="trendIndex"
                  dot={false}
                  stroke="#38bdf8"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  type="linear"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </PanelCard>
  );
}
